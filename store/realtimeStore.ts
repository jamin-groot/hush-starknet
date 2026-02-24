'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction } from '@/lib/blockchain';
import {
  getEncryptedMessagesForWallet,
  decryptTransactionNote,
  resolveOutgoingMessagePreview,
  type StoredEncryptedNote,
} from '@/lib/privacy';
import { parseStealthMessageBody, type StealthClaimStatus, type StealthMetadata } from '@/lib/stealth';
import {
  getTransactionHistoryForWallet,
  upsertTransactionHistory,
} from '@/lib/transaction-history';
import { CallData } from 'starknet';
import { buildRpcProviders } from '@/lib/rpc-router';

type LifecycleState = 'pending' | 'confirmed' | 'failed';
type RequestStatus = 'pending' | 'paid' | 'expired' | 'rejected';
type NotificationLifecycle = LifecycleState | RequestStatus | StealthClaimStatus;
type NotificationType =
  | 'incoming_transfer'
  | 'outgoing_pending'
  | 'outgoing_confirmed'
  | 'outgoing_failed'
  | 'encrypted_note'
  | 'private_message'
  | 'tx_confirmed'
  | 'tx_failed'
  | 'payment_request_arrived'
  | 'payment_request_paid'
  | 'payment_request_rejected'
  | 'payment_request_expired'
  | 'stealth_payment_detected'
  | 'stealth_claim_succeeded'
  | 'stealth_claim_failed';

interface RealtimeMessage {
  id: string;
  txHash?: string;
  kind: 'payment_note' | 'chat' | 'request';
  requestId?: string;
  amount?: string;
  requestStatus?: RequestStatus;
  expiresAt?: number;
  paidTxHash?: string;
  isStealth?: boolean;
  stealthAddress?: string;
  claimStatus?: StealthClaimStatus;
  claimTxHash?: string;
  stealthDeployTxHash?: string;
  rawPlaintext?: string;
  stealthMetadata?: StealthMetadata;
  from: string;
  to: string;
  counterparty: string;
  direction: 'sent' | 'received';
  isPaymentLinked: boolean;
  createdAt: number;
  plaintext: string;
}

interface ConversationThread {
  counterparty: string;
  messages: RealtimeMessage[];
  lastMessageAt: number;
  lastMessagePreview: string;
  unreadCount: number;
}

interface RealtimeNotification {
  id: string;
  dedupeKey: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  txHash?: string;
  metadata?: {
    messagePreview?: string;
    amount?: string;
    address?: string;
    lifecycle?: NotificationLifecycle;
  };
}

interface RealtimeStats {
  totalSent: number;
  totalReceived: number;
  totalTransactions: number;
  privateTransactions: number;
}

interface RealtimeState {
  walletAddress: string | null;
  transactions: Transaction[];
  messages: RealtimeMessage[];
  conversations: ConversationThread[];
  notifications: RealtimeNotification[];
  lifecycleByHash: Record<string, LifecycleState>;
  balance: string;
  isSyncing: boolean;
  stats: RealtimeStats;
  initialize: (address: string, account?: unknown) => void;
  stop: () => void;
  refreshNow: (account?: unknown) => Promise<void>;
  addOptimisticOutgoing: (tx: Transaction, balanceAfterSend?: string) => void;
  mapPendingHash: (pendingHash: string, realHash: string) => void;
  confirmTransaction: (txHash: string, realTx?: Transaction, balanceAfterConfirm?: string) => void;
  failTransaction: (txHash: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
}

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STRK_DECIMALS = 18;
const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941';
const POLL_INTERVAL_MS = 12000;
const MAX_NOTIFICATIONS = 100;

type ContractCaller = {
  callContract: (request: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }) => Promise<unknown>;
};

let pollHandle: ReturnType<typeof setInterval> | null = null;
let inflight = false;

const normalize = (value: string): string => value.trim().toLowerCase();

const emptyStats = (): RealtimeStats => ({
  totalSent: 0,
  totalReceived: 0,
  totalTransactions: 0,
  privateTransactions: 0,
});

const computeStats = (transactions: Transaction[]): RealtimeStats => {
  const sent = transactions
    .filter((tx) => tx.type === 'send' && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + Number.parseFloat(tx.amount || '0'), 0);

  const received = transactions
    .filter((tx) => tx.type === 'receive' && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + Number.parseFloat(tx.amount || '0'), 0);

  return {
    totalSent: sent,
    totalReceived: received,
    totalTransactions: transactions.length,
    privateTransactions: transactions.filter((tx) => tx.isPrivate).length,
  };
};

const appendNotification = (
  notifications: RealtimeNotification[],
  notification: Omit<RealtimeNotification, 'id' | 'read' | 'timestamp'> & { timestamp?: number }
): RealtimeNotification[] => {
  if (notifications.some((entry) => entry.dedupeKey === notification.dedupeKey)) {
    return notifications;
  }

  const next: RealtimeNotification = {
    ...notification,
    id: `${notification.dedupeKey}-${Date.now()}`,
    read: false,
    timestamp: notification.timestamp ?? Date.now(),
  };

  return [next, ...notifications].slice(0, MAX_NOTIFICATIONS);
};

const parseUint256FromCall = (result: unknown): bigint => {
  if (Array.isArray(result) && result.length >= 2) {
    return (BigInt(result[1]) << BigInt(128)) + BigInt(result[0]);
  }

  if (result && typeof result === 'object') {
    const value = result as Record<string, unknown>;

    if (value.low !== undefined && value.high !== undefined) {
      return (BigInt(value.high as string | number | bigint) << BigInt(128)) + BigInt(value.low as string | number | bigint);
    }

    if (value.balance && typeof value.balance === 'object') {
      const balance = value.balance as Record<string, unknown>;
      if (balance.low !== undefined && balance.high !== undefined) {
        return (BigInt(balance.high as string | number | bigint) << BigInt(128)) + BigInt(balance.low as string | number | bigint);
      }
    }
  }

  throw new Error('Unexpected Uint256 response');
};

const formatTokenBalance = (rawBalance: bigint, decimals: number): string => {
  const raw = rawBalance.toString().padStart(decimals + 1, '0');
  const whole = raw.slice(0, raw.length - decimals);
  const fractional = raw.slice(raw.length - decimals, raw.length - decimals + 4);
  return `${whole}.${fractional}`;
};

const fetchBalanceWithCaller = async (caller: ContractCaller, address: string): Promise<bigint> => {
  const calldata = CallData.compile({ account: address });

  for (const entrypoint of ['balance_of', 'balanceOf'] as const) {
    try {
      const result = await caller.callContract({
        contractAddress: STRK_ADDRESS,
        entrypoint,
        calldata,
      });
      return parseUint256FromCall(result);
    } catch {
      // try next entrypoint
    }
  }

  throw new Error('Failed to read STRK balance');
};

const mergeHistoryWithMessages = (
  address: string,
  history: Transaction[],
  messages: RealtimeMessage[]
): Transaction[] => {
  const byHash = new Map(
    messages
      .filter((item) => item.txHash)
      .map((item) => [item.txHash as string, item])
  );
  const merged = history.map((tx) => {
    const linked = byHash.get(tx.hash);
    if (!linked) {
      return tx;
    }
    return {
      ...tx,
      isPrivate: true,
      encryptedNote: tx.encryptedNote ?? 'Encrypted note',
      decryptedNote: linked.plaintext,
    } satisfies Transaction;
  });

  for (const note of messages) {
    if (!note.txHash || note.direction !== 'received') {
      continue;
    }
    if (merged.some((tx) => tx.hash === note.txHash)) {
      continue;
    }
    merged.push({
      id: `inbox-${note.id}`,
      from: note.from,
      to: address,
      amount: '0',
      token: 'STRK',
      encryptedNote: 'Encrypted note',
      decryptedNote: note.plaintext,
      timestamp: note.createdAt,
      status: 'confirmed',
      type: 'receive',
      isPrivate: true,
      hash: note.txHash,
    });
  }

  merged.sort((a, b) => b.timestamp - a.timestamp);
  return merged;
};

const loadMessages = async (address: string): Promise<RealtimeMessage[]> => {
  let encryptedNotes: StoredEncryptedNote[] = [];
  try {
    encryptedNotes = await getEncryptedMessagesForWallet(address);
  } catch {
    return [];
  }

  const decrypted = await Promise.all(
    encryptedNotes.map(async (entry) => {
      try {
        const payload = entry.payload as StoredEncryptedNote['payload'] & {
          meta?: {
            type?: 'payment_note' | 'chat' | 'request';
            requestId?: string;
            amount?: string;
            status?: 'pending' | 'paid' | 'expired' | 'rejected';
            expiresAt?: number;
            paidTxHash?: string;
            isStealth?: boolean;
            stealthAddress?: string;
            claimStatus?: StealthClaimStatus;
            claimTxHash?: string;
            stealthDeployTxHash?: string;
            stealthSalt?: string;
            stealthClassHash?: string;
            stealthPublicKey?: string;
            derivationTag?: string;
          };
        };
        if (!payload?.senderAddress || !payload?.recipientAddress) {
          return null;
        }
        const plaintext = await decryptTransactionNote(entry.payload, address);
        const senderAddress = payload.senderAddress;
        const recipientAddress = payload.recipientAddress;
        const direction = normalize(senderAddress) === normalize(address) ? 'sent' : 'received';
        const counterparty = direction === 'sent' ? recipientAddress : senderAddress;
        const requestStatus = entry.status ?? payload.meta?.status;
        const requestKind = entry.kind ?? payload.meta?.type ?? (entry.txHash ? 'payment_note' : 'chat');
        const requestId = entry.requestId ?? payload.meta?.requestId;
        const amount = entry.amount ?? payload.meta?.amount;
        const expiresAt = entry.expiresAt ?? payload.meta?.expiresAt;
        const paidTxHash = entry.paidTxHash ?? payload.meta?.paidTxHash;
        const parsedStealth = parseStealthMessageBody(plaintext);
        const isStealth = entry.isStealth ?? payload.meta?.isStealth ?? Boolean(parsedStealth);
        const stealthAddress =
          entry.stealthAddress ?? payload.meta?.stealthAddress ?? parsedStealth?.stealth.stealthAddress;
        const claimStatusRaw = entry.claimStatus ?? payload.meta?.claimStatus;
        const claimStatus: StealthClaimStatus | undefined =
          isStealth
            ? claimStatusRaw === 'claimed' || claimStatusRaw === 'failed'
              ? claimStatusRaw
              : entry.txHash
                ? 'claimable'
                : 'pending'
            : undefined;
        const claimTxHash = entry.claimTxHash ?? payload.meta?.claimTxHash;
        const stealthDeployTxHash = entry.stealthDeployTxHash ?? payload.meta?.stealthDeployTxHash;
        const plaintextForDisplay = parsedStealth?.note?.trim()
          ? parsedStealth.note
          : isStealth
            ? `Stealth payment: ${amount ?? parsedStealth?.amount ?? '0'} STRK`
            : plaintext;
        const derivedRequestStatus: RequestStatus | undefined =
          requestKind === 'request'
            ? requestStatus === 'paid' || requestStatus === 'rejected'
              ? requestStatus
              : typeof expiresAt === 'number' && expiresAt < Date.now()
                ? 'expired'
                : 'pending'
            : undefined;

        return {
          id: entry.id ?? entry.txHash ?? `msg-${entry.createdAt}`,
          txHash: entry.txHash,
          kind: requestKind,
          requestId,
          amount,
          requestStatus: derivedRequestStatus,
          expiresAt,
          paidTxHash,
          isStealth,
          stealthAddress,
          claimStatus,
          claimTxHash,
          stealthDeployTxHash,
          rawPlaintext: plaintext,
          stealthMetadata: parsedStealth?.stealth,
          from: senderAddress,
          to: recipientAddress,
          counterparty,
          direction,
          isPaymentLinked: Boolean(entry.txHash),
          createdAt: entry.createdAt,
          plaintext: plaintextForDisplay,
        } satisfies RealtimeMessage;
      } catch {
        const payload = entry.payload as StoredEncryptedNote['payload'] & {
          senderAddress?: string;
          recipientAddress?: string;
        };
        if (!payload?.senderAddress || !payload?.recipientAddress) {
          return null;
        }

        const senderAddress = payload.senderAddress;
        const recipientAddress = payload.recipientAddress;
        const direction = normalize(senderAddress) === normalize(address) ? 'sent' : 'received';
        if (direction !== 'sent') {
          return null;
        }

        const preview = resolveOutgoingMessagePreview(payload, address);
        if (!preview) {
          return null;
        }

        const requestStatus = entry.status ?? (payload as { meta?: { status?: RequestStatus } }).meta?.status;
        const requestKind =
          entry.kind ??
          (payload as { meta?: { type?: 'payment_note' | 'chat' | 'request' } }).meta?.type ??
          (entry.txHash ? 'payment_note' : 'chat');
        const requestId = entry.requestId ?? (payload as { meta?: { requestId?: string } }).meta?.requestId;
        const amount = entry.amount ?? (payload as { meta?: { amount?: string } }).meta?.amount;
        const expiresAt = entry.expiresAt ?? (payload as { meta?: { expiresAt?: number } }).meta?.expiresAt;
        const paidTxHash = entry.paidTxHash ?? (payload as { meta?: { paidTxHash?: string } }).meta?.paidTxHash;
        const isStealth = entry.isStealth ?? (payload as { meta?: { isStealth?: boolean } }).meta?.isStealth;
        const stealthAddress =
          entry.stealthAddress ?? (payload as { meta?: { stealthAddress?: string } }).meta?.stealthAddress;
        const claimStatusRaw =
          entry.claimStatus ?? (payload as { meta?: { claimStatus?: StealthClaimStatus } }).meta?.claimStatus;
        const claimStatus: StealthClaimStatus | undefined =
          isStealth
            ? claimStatusRaw === 'claimed' || claimStatusRaw === 'failed'
              ? claimStatusRaw
              : entry.txHash
                ? 'claimable'
                : 'pending'
            : undefined;
        const claimTxHash =
          entry.claimTxHash ?? (payload as { meta?: { claimTxHash?: string } }).meta?.claimTxHash;
        const stealthDeployTxHash =
          entry.stealthDeployTxHash ??
          (payload as { meta?: { stealthDeployTxHash?: string } }).meta?.stealthDeployTxHash;
        const derivedRequestStatus: RequestStatus | undefined =
          requestKind === 'request'
            ? requestStatus === 'paid' || requestStatus === 'rejected'
              ? requestStatus
              : typeof expiresAt === 'number' && expiresAt < Date.now()
                ? 'expired'
                : 'pending'
            : undefined;

        return {
          id: entry.id ?? entry.txHash ?? `msg-${entry.createdAt}`,
          txHash: entry.txHash,
          kind: requestKind,
          requestId,
          amount,
          requestStatus: derivedRequestStatus,
          expiresAt,
          paidTxHash,
          isStealth,
          stealthAddress,
          claimStatus,
          claimTxHash,
          stealthDeployTxHash,
          from: senderAddress,
          to: recipientAddress,
          counterparty: recipientAddress,
          direction: 'sent',
          isPaymentLinked: Boolean(entry.txHash),
          createdAt: entry.createdAt,
          plaintext: preview,
        } satisfies RealtimeMessage;
      }
    })
  );

  return decrypted.filter(Boolean) as RealtimeMessage[];
};

const buildConversations = (messages: RealtimeMessage[]): ConversationThread[] => {
  const grouped = new Map<string, RealtimeMessage[]>();

  for (const message of messages) {
    const key = normalize(message.counterparty);
    const bucket = grouped.get(key) ?? [];
    bucket.push(message);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .map(([counterparty, list]) => {
      const ordered = [...list].sort((a, b) => a.createdAt - b.createdAt);
      const last = ordered[ordered.length - 1];
      return {
        counterparty,
        messages: ordered,
        lastMessageAt: last?.createdAt ?? 0,
        lastMessagePreview: (last?.plaintext ?? '').slice(0, 120),
        unreadCount: ordered.filter((message) => message.direction === 'received').length,
      } satisfies ConversationThread;
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
};

const performRefresh = async (address: string, account?: unknown) => {
  if (inflight) {
    return null;
  }
  inflight = true;

  try {
    const normalized = normalize(address);
    const history = getTransactionHistoryForWallet(normalized);
    const messages = await loadMessages(normalized);
    const mergedTransactions = mergeHistoryWithMessages(normalized, history, messages);

    let balance = '0.0000';
    const callers: ContractCaller[] = buildRpcProviders();

    const maybeAccount = account as {
      getChainId?: () => Promise<string>;
      callContract?: ContractCaller['callContract'];
    };

    if (maybeAccount?.callContract && maybeAccount?.getChainId) {
      try {
        const chainId = await maybeAccount.getChainId();
        if (chainId === STARKNET_SEPOLIA_CHAIN_ID) {
          callers.push({ callContract: maybeAccount.callContract });
        }
      } catch {
        // ignore account chain read errors
      }
    }

    let rawBalance: bigint | null = null;
    for (const caller of callers) {
      try {
        rawBalance = await fetchBalanceWithCaller(caller, normalized);
        break;
      } catch {
        // try next caller
      }
    }
    if (rawBalance !== null) {
      balance = formatTokenBalance(rawBalance, STRK_DECIMALS);
    }

    return {
      transactions: mergedTransactions,
      messages,
      conversations: buildConversations(messages),
      balance,
      stats: computeStats(mergedTransactions),
    };
  } finally {
    inflight = false;
  }
};

export const useRealtimeStore = create<RealtimeState>()(
  persist(
    (set, get) => ({
      walletAddress: null,
      transactions: [],
      messages: [],
      conversations: [],
      notifications: [],
      lifecycleByHash: {},
      balance: '0.0000',
      isSyncing: false,
      stats: emptyStats(),

      initialize: (address, account) => {
        const normalized = normalize(address);
        if (get().walletAddress !== normalized) {
          set({
            walletAddress: normalized,
            transactions: [],
            messages: [],
            conversations: [],
            lifecycleByHash: {},
            balance: '0.0000',
            stats: emptyStats(),
          });
        }

        const run = async () => {
          set({ isSyncing: true });
          const data = await performRefresh(normalized, account);
          if (data) {
            set((state) => {
              let nextNotifications = state.notifications;
              const oldTxByHash = new Map(state.transactions.map((tx) => [tx.hash, tx]));
              const oldMessagesById = new Map(state.messages.map((msg) => [msg.id, msg]));

              for (const tx of data.transactions) {
                if (tx.type === 'receive' && tx.status === 'confirmed' && !oldTxByHash.has(tx.hash)) {
                  nextNotifications = appendNotification(nextNotifications, {
                    dedupeKey: `incoming:${tx.hash}`,
                    type: 'incoming_transfer',
                    title: 'Incoming transfer',
                    description: `Received ${tx.amount} ${tx.token} from ${tx.from.slice(0, 10)}...`,
                    txHash: tx.hash,
                    metadata: {
                      amount: tx.amount,
                      address: tx.from,
                      lifecycle: tx.status,
                    },
                  });
                }

                const previous = oldTxByHash.get(tx.hash);
                if (previous && !previous.decryptedNote && tx.decryptedNote) {
                  nextNotifications = appendNotification(nextNotifications, {
                    dedupeKey: `encrypted-note:${tx.hash}`,
                    type: 'encrypted_note',
                    title: 'Encrypted note decrypted',
                    description: tx.decryptedNote.slice(0, 90),
                    txHash: tx.hash,
                    metadata: {
                      messagePreview: tx.decryptedNote.slice(0, 120),
                    },
                  });
                }
              }

              for (const message of data.messages) {
                const previous = oldMessagesById.get(message.id);

                if (!previous && message.direction === 'received') {
                  if (message.kind === 'request') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `request-arrived:${message.requestId ?? message.id}`,
                      type: 'payment_request_arrived',
                      title: 'Payment request received',
                      description: `Request for ${message.amount ?? '0'} STRK`,
                      txHash: message.txHash,
                      metadata: {
                        amount: message.amount,
                        address: message.from,
                        lifecycle: message.requestStatus ?? 'pending',
                      },
                      timestamp: message.createdAt,
                    });
                  } else if (message.isStealth) {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `stealth-detected:${message.id}`,
                      type: 'stealth_payment_detected',
                      title: 'Stealth payment detected',
                      description: `${message.amount ?? '0'} STRK ready to claim.`,
                      txHash: message.txHash,
                      metadata: {
                        amount: message.amount,
                        address: message.stealthAddress,
                        lifecycle: message.claimStatus ?? 'claimable',
                      },
                      timestamp: message.createdAt,
                    });
                  } else {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `private-message:${message.id}`,
                      type: 'private_message',
                      title: 'New private message',
                      description: message.plaintext.slice(0, 90),
                      txHash: message.txHash,
                      metadata: {
                        messagePreview: message.plaintext.slice(0, 120),
                        address: message.from,
                      },
                      timestamp: message.createdAt,
                    });
                  }
                }

                if (message.isStealth && previous?.claimStatus && previous.claimStatus !== message.claimStatus) {
                  if (message.claimStatus === 'claimed') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `stealth-claimed:${message.id}`,
                      type: 'stealth_claim_succeeded',
                      title: 'Stealth claim succeeded',
                      description: `${message.amount ?? '0'} STRK moved to your main wallet.`,
                      txHash: message.claimTxHash ?? message.txHash,
                      metadata: {
                        amount: message.amount,
                        address: message.counterparty,
                        lifecycle: 'claimed',
                      },
                    });
                  } else if (message.claimStatus === 'failed') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `stealth-claim-failed:${message.id}`,
                      type: 'stealth_claim_failed',
                      title: 'Stealth claim failed',
                      description: 'Retry claim after network confirmation.',
                      txHash: message.txHash,
                      metadata: {
                        amount: message.amount,
                        address: message.counterparty,
                        lifecycle: 'failed',
                      },
                    });
                  }
                }

                if (
                  message.kind === 'request' &&
                  previous?.requestStatus &&
                  previous.requestStatus !== message.requestStatus
                ) {
                  if (message.requestStatus === 'paid') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `request-paid:${message.requestId ?? message.id}`,
                      type: 'payment_request_paid',
                      title: 'Payment request paid',
                      description: `${message.amount ?? '0'} STRK request marked as paid.`,
                      txHash: message.paidTxHash ?? message.txHash,
                      metadata: {
                        amount: message.amount,
                        address: message.counterparty,
                        lifecycle: 'paid',
                      },
                    });
                  } else if (message.requestStatus === 'rejected') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `request-rejected:${message.requestId ?? message.id}`,
                      type: 'payment_request_rejected',
                      title: 'Payment request rejected',
                      description: `Request for ${message.amount ?? '0'} STRK was rejected.`,
                      metadata: {
                        amount: message.amount,
                        address: message.counterparty,
                        lifecycle: 'rejected',
                      },
                    });
                  } else if (message.requestStatus === 'expired') {
                    nextNotifications = appendNotification(nextNotifications, {
                      dedupeKey: `request-expired:${message.requestId ?? message.id}`,
                      type: 'payment_request_expired',
                      title: 'Payment request expired',
                      description: `Request for ${message.amount ?? '0'} STRK expired after 24h.`,
                      metadata: {
                        amount: message.amount,
                        address: message.counterparty,
                        lifecycle: 'expired',
                      },
                    });
                  }
                }
              }

              return {
                transactions: data.transactions,
                messages: data.messages,
                conversations: data.conversations,
                notifications: nextNotifications,
                balance: data.balance,
                stats: data.stats,
                isSyncing: false,
              };
            });
          } else {
            set({ isSyncing: false });
          }
        };

        void run();

        if (pollHandle) {
          clearInterval(pollHandle);
        }
        pollHandle = setInterval(() => {
          void run();
        }, POLL_INTERVAL_MS);
      },

      stop: () => {
        if (pollHandle) {
          clearInterval(pollHandle);
          pollHandle = null;
        }
      },

      refreshNow: async (account) => {
        const address = get().walletAddress;
        if (!address) {
          return;
        }
        set({ isSyncing: true });
        const data = await performRefresh(address, account);
        if (data) {
          set({
            transactions: data.transactions,
            messages: data.messages,
            conversations: data.conversations,
            balance: data.balance,
            stats: data.stats,
            isSyncing: false,
          });
        } else {
          set({ isSyncing: false });
        }
      },

      addOptimisticOutgoing: (tx, balanceAfterSend) => {
        upsertTransactionHistory(tx);
        set((state) => {
          const next = [tx, ...state.transactions.filter((item) => item.hash !== tx.hash)];
          return {
            transactions: next,
            notifications: appendNotification(state.notifications, {
              dedupeKey: `outgoing-pending:${tx.hash}`,
              type: 'outgoing_pending',
              title: 'Outgoing transfer pending',
              description: `Sending ${tx.amount} ${tx.token} to ${tx.to.slice(0, 10)}...`,
              txHash: tx.hash,
              metadata: {
                amount: tx.amount,
                address: tx.to,
                lifecycle: 'pending',
              },
            }),
            lifecycleByHash: {
              ...state.lifecycleByHash,
              [tx.hash]: 'pending',
            },
            balance: balanceAfterSend ?? state.balance,
            stats: computeStats(next),
          };
        });
      },

      mapPendingHash: (pendingHash, realHash) => {
        set((state) => {
          const txs = state.transactions.map((tx) => {
            if (tx.hash !== pendingHash) {
              return tx;
            }
            return {
              ...tx,
              hash: realHash,
              status: 'pending',
            } satisfies Transaction;
          });

          const lifecycleByHash = { ...state.lifecycleByHash };
          if (lifecycleByHash[pendingHash]) {
            lifecycleByHash[realHash] = lifecycleByHash[pendingHash];
            delete lifecycleByHash[pendingHash];
          }

          return {
            transactions: txs,
            lifecycleByHash,
          };
        });
      },

      confirmTransaction: (txHash, realTx, balanceAfterConfirm) => {
        set((state) => {
          const txs = state.transactions.map((tx) => {
            if (tx.hash !== txHash) {
              return tx;
            }
            return {
              ...(realTx ?? tx),
              status: 'confirmed',
            } satisfies Transaction;
          });
          const confirmed = txs.find((tx) => tx.hash === txHash);
          let nextNotifications = state.notifications;
          if (confirmed) {
            nextNotifications = appendNotification(nextNotifications, {
              dedupeKey: `outgoing-confirmed:${txHash}`,
              type: 'outgoing_confirmed',
              title: 'Transfer confirmed',
              description: `${confirmed.amount} ${confirmed.token} confirmed on-chain.`,
              txHash,
              metadata: {
                amount: confirmed.amount,
                address: confirmed.to,
                lifecycle: 'confirmed',
              },
            });
            nextNotifications = appendNotification(nextNotifications, {
              dedupeKey: `tx-confirmed:${txHash}`,
              type: 'tx_confirmed',
              title: 'Transaction accepted',
              description: 'Your transaction was accepted on Starknet.',
              txHash,
              metadata: {
                lifecycle: 'confirmed',
              },
            });
          }
          return {
            transactions: txs,
            notifications: nextNotifications,
            lifecycleByHash: {
              ...state.lifecycleByHash,
              [txHash]: 'confirmed',
            },
            balance: balanceAfterConfirm ?? state.balance,
            stats: computeStats(txs),
          };
        });

        if (realTx) {
          upsertTransactionHistory(realTx);
        }
      },

      failTransaction: (txHash) => {
        set((state) => {
          const txs = state.transactions.map((tx) => {
            if (tx.hash !== txHash) {
              return tx;
            }
            return {
              ...tx,
              status: 'failed',
            } satisfies Transaction;
          });
          const failed = txs.find((tx) => tx.hash === txHash);
          let nextNotifications = state.notifications;
          if (failed) {
            nextNotifications = appendNotification(nextNotifications, {
              dedupeKey: `outgoing-failed:${txHash}`,
              type: 'outgoing_failed',
              title: 'Transfer failed',
              description: `Could not send ${failed.amount} ${failed.token}.`,
              txHash,
              metadata: {
                amount: failed.amount,
                address: failed.to,
                lifecycle: 'failed',
              },
            });
            nextNotifications = appendNotification(nextNotifications, {
              dedupeKey: `tx-failed:${txHash}`,
              type: 'tx_failed',
              title: 'Transaction rejected',
              description: 'The network rejected or reverted your transaction.',
              txHash,
              metadata: {
                lifecycle: 'failed',
              },
            });
          }
          return {
            transactions: txs,
            notifications: nextNotifications,
            lifecycleByHash: {
              ...state.lifecycleByHash,
              [txHash]: 'failed',
            },
            stats: computeStats(txs),
          };
        });
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((item) =>
            item.id === id
              ? {
                  ...item,
                  read: true,
                }
              : item
          ),
        }));
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((item) => ({ ...item, read: true })),
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((item) => item.id !== id),
        }));
      },
    }),
    {
      name: 'hush-realtime-store',
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
);
