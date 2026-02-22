import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoredEncryptedMessage {
  txHash: string;
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
  const next = store.messages.filter((item) => item.txHash !== message.txHash);
  next.unshift(message);
  store.messages = next.slice(0, 1000);
  await writeStore(store);
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
