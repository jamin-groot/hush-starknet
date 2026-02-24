import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoredEncryptedMessage {
  id: string;
  txHash?: string;
  kind?: 'payment_note' | 'chat' | 'request';
  requestId?: string;
  paidTxHash?: string;
  amount?: string;
  status?: 'pending' | 'paid' | 'expired' | 'rejected';
  expiresAt?: number;
  isStealth?: boolean;
  stealthAddress?: string;
  claimStatus?: 'pending' | 'claimable' | 'claimed' | 'failed';
  claimTxHash?: string;
  stealthDeployTxHash?: string;
  stealthSalt?: string;
  stealthClassHash?: string;
  stealthPublicKey?: string;
  derivationTag?: string;
  payload: unknown;
  createdAt: number;
}

interface PrivacyStoreData {
  keys: Record<string, unknown>;
  messages: StoredEncryptedMessage[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'privacy-store.json');

const normalizeAddress = (value: string): string => value.trim().toLowerCase();
const generateMessageId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultStore = (): PrivacyStoreData => ({
  keys: {},
  messages: [],
});

async function readStore(): Promise<PrivacyStoreData> {
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrivacyStoreData>;
    return {
      keys: parsed.keys ?? {},
      messages: parsed.messages ?? [],
    };
  } catch {
    return defaultStore();
  }
}

async function writeStore(store: PrivacyStoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export async function upsertPublicKey(address: string, publicKeyJwk: unknown): Promise<void> {
  const store = await readStore();
  store.keys[normalizeAddress(address)] = publicKeyJwk;
  await writeStore(store);
}

export async function getPublicKey(address: string): Promise<unknown | null> {
  const store = await readStore();
  return store.keys[normalizeAddress(address)] ?? null;
}

export async function saveEncryptedMessage(message: StoredEncryptedMessage): Promise<void> {
  const store = await readStore();
  const normalized: StoredEncryptedMessage = {
    ...message,
    id: message.id || generateMessageId(),
    kind: message.kind ?? 'payment_note',
  };

  const next = normalized.txHash
    ? store.messages.filter((item) => item.txHash !== normalized.txHash)
    : store.messages;
  next.unshift(normalized);
  store.messages = next.slice(0, 1000);
  await writeStore(store);
}

export async function updateEncryptedMessage(
  match: { id?: string; requestId?: string },
  updates: Partial<
    Pick<
      StoredEncryptedMessage,
      | 'status'
      | 'paidTxHash'
      | 'txHash'
      | 'expiresAt'
      | 'claimStatus'
      | 'claimTxHash'
      | 'stealthDeployTxHash'
    >
  >
): Promise<StoredEncryptedMessage | null> {
  if (!match.id && !match.requestId) {
    return null;
  }

  const store = await readStore();
  const index = store.messages.findIndex((item) => {
    if (match.id && item.id === match.id) {
      return true;
    }
    if (match.requestId && item.requestId === match.requestId) {
      return true;
    }
    return false;
  });

  if (index < 0) {
    return null;
  }

  const current = store.messages[index];
  const next: StoredEncryptedMessage = { ...current };
  if (updates.status !== undefined) {
    next.status = updates.status;
  }
  if (updates.paidTxHash !== undefined) {
    next.paidTxHash = updates.paidTxHash;
  }
  if (updates.txHash !== undefined) {
    next.txHash = updates.txHash;
  }
  if (updates.expiresAt !== undefined) {
    next.expiresAt = updates.expiresAt;
  }
  if (updates.claimStatus !== undefined) {
    next.claimStatus = updates.claimStatus;
  }
  if (updates.claimTxHash !== undefined) {
    next.claimTxHash = updates.claimTxHash;
  }
  if (updates.stealthDeployTxHash !== undefined) {
    next.stealthDeployTxHash = updates.stealthDeployTxHash;
  }
  store.messages[index] = next;
  await writeStore(store);
  return next;
}

export async function getMessagesForRecipient(recipientAddress: string): Promise<StoredEncryptedMessage[]> {
  const normalized = normalizeAddress(recipientAddress);
  const store = await readStore();

  return store.messages.filter((item) => {
    if (!item.payload || typeof item.payload !== 'object') {
      return false;
    }
    const payload = item.payload as Record<string, unknown>;
    return typeof payload.recipientAddress === 'string' && normalizeAddress(payload.recipientAddress) === normalized;
  });
}

interface WalletMessageFilters {
  includeSent?: boolean;
}

export async function getMessagesForWallet(
  walletAddress: string,
  filters?: WalletMessageFilters
): Promise<StoredEncryptedMessage[]> {
  const normalized = normalizeAddress(walletAddress);
  const includeSent = filters?.includeSent ?? false;
  const store = await readStore();

  return store.messages.filter((item) => {
    if (!item.payload || typeof item.payload !== 'object') {
      return false;
    }
    const payload = item.payload as Record<string, unknown>;
    const recipient =
      typeof payload.recipientAddress === 'string' ? normalizeAddress(payload.recipientAddress) : null;
    const sender = typeof payload.senderAddress === 'string' ? normalizeAddress(payload.senderAddress) : null;

    if (recipient === normalized) {
      return true;
    }
    if (includeSent && sender === normalized) {
      return true;
    }
    return false;
  });
}
