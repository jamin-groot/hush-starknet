'use client';

import { create } from 'zustand';
import type { Transaction } from '@/lib/blockchain';
import { getEncryptedNotesForRecipient, decryptTransactionNote } from '@/lib/privacy';
import {
  getTransactionHistoryForWallet,
  upsertTransactionHistory,
} from '@/lib/transaction-history';
import { CallData, RpcProvider } from 'starknet';

type LifecycleState = 'pending' | 'confirmed' | 'failed';

interface RealtimeMessage {
  txHash: string;
  from: string;
  createdAt: number;
  plaintext: string;
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
}

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STRK_DECIMALS = 18;
const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941';
const RPC_ENDPOINTS = [
  'https://starknet-sepolia-rpc.publicnode.com',
  'https://rpc.starknet-testnet.lava.build:443',
] as const;
const POLL_INTERVAL_MS = 12000;

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
  const byHash = new Map(messages.map((item) => [item.txHash, item]));
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
    if (merged.some((tx) => tx.hash === note.txHash)) {
      continue;
    }
    merged.push({
      id: `inbox-${note.txHash}`,
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
  const encryptedNotes = await getEncryptedNotesForRecipient(address);

  const decrypted = await Promise.all(
    encryptedNotes.map(async (entry) => {
      try {
        const plaintext = await decryptTransactionNote(entry.payload, address);
        return {
          txHash: entry.txHash,
          from: entry.payload.senderAddress,
          createdAt: entry.createdAt,
          plaintext,
        } satisfies RealtimeMessage;
      } catch {
        return null;
      }
    })
  );

  return decrypted.filter((note): note is RealtimeMessage => note !== null);
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
    const callers: ContractCaller[] = RPC_ENDPOINTS.map((nodeUrl) => new RpcProvider({ nodeUrl }));

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
      balance,
      stats: computeStats(mergedTransactions),
    };
  } finally {
    inflight = false;
  }
};

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  walletAddress: null,
  transactions: [],
  messages: [],
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
        lifecycleByHash: {},
        balance: '0.0000',
        stats: emptyStats(),
      });
    }

    const run = async () => {
      set({ isSyncing: true });
      const data = await performRefresh(normalized, account);
      if (data) {
        set({
          transactions: data.transactions,
          messages: data.messages,
          balance: data.balance,
          stats: data.stats,
          isSyncing: false,
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
      return {
        transactions: txs,
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
      return {
        transactions: txs,
        lifecycleByHash: {
          ...state.lifecycleByHash,
          [txHash]: 'failed',
        },
        stats: computeStats(txs),
      };
    });
  },
}));
