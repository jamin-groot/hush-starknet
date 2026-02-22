export interface EncryptedNotePayload {
  version: 'hush-note-v2';
  algorithm: 'RSA-OAEP-2048/AES-GCM-256';
  senderAddress: string;
  recipientAddress: string;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  meta?: {
    type?: 'payment_note' | 'chat' | 'request';
    requestId?: string;
    amount?: string;
    status?: 'pending' | 'paid' | 'expired' | 'rejected';
    expiresAt?: number;
    paidTxHash?: string;
  };
}

export interface StoredEncryptedNote {
  id?: string;
  txHash?: string;
  kind?: 'payment_note' | 'chat' | 'request';
  requestId?: string;
  paidTxHash?: string;
  amount?: string;
  status?: 'pending' | 'paid' | 'expired' | 'rejected';
  expiresAt?: number;
  payload: EncryptedNotePayload;
  createdAt: number;
}

interface LocalKeyRecord {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

const LOCAL_KEYS_STORAGE = 'hush.encryptionKeys.v2';
const LOCAL_OUTGOING_PREVIEWS_STORAGE = 'hush.outgoingMessagePreviews.v1';

const normalizeAddress = (value: string): string => value.trim().toLowerCase();

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): ArrayBuffer => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const readLocalKeyMap = (): Record<string, LocalKeyRecord> => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEYS_STORAGE);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, LocalKeyRecord>;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const writeLocalKeyMap = (value: Record<string, LocalKeyRecord>): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LOCAL_KEYS_STORAGE, JSON.stringify(value));
};

interface OutgoingMessagePreview {
  ciphertext: string;
  senderAddress: string;
  recipientAddress: string;
  plaintext: string;
  createdAt: number;
}

const readOutgoingPreviewMap = (): Record<string, OutgoingMessagePreview> => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_OUTGOING_PREVIEWS_STORAGE);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, OutgoingMessagePreview>;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const writeOutgoingPreviewMap = (value: Record<string, OutgoingMessagePreview>): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LOCAL_OUTGOING_PREVIEWS_STORAGE, JSON.stringify(value));
};

async function registerPublicKey(address: string, publicKeyJwk: JsonWebKey): Promise<void> {
  const response = await fetch('/api/privacy/register-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: normalizeAddress(address), publicKeyJwk }),
  });

  if (!response.ok) {
    throw new Error('Failed to register encryption key');
  }
}

async function fetchPublicKeyForAddress(address: string): Promise<JsonWebKey> {
  const response = await fetch(`/api/privacy/public-key/${normalizeAddress(address)}`);

  if (!response.ok) {
    throw new Error('Recipient has not registered encryption yet');
  }

  const data = (await response.json()) as { publicKeyJwk?: JsonWebKey };
  if (!data.publicKeyJwk) {
    throw new Error('Recipient public key missing');
  }
  return data.publicKeyJwk;
}

export async function ensureEncryptionIdentity(address: string): Promise<void> {
  const normalized = normalizeAddress(address);
  const map = readLocalKeyMap();
  const existing = map[normalized];

  if (existing?.publicKeyJwk && existing?.privateKeyJwk) {
    await registerPublicKey(normalized, existing.publicKeyJwk);
    return;
  }

  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

  map[normalized] = { publicKeyJwk, privateKeyJwk };
  writeLocalKeyMap(map);
  await registerPublicKey(normalized, publicKeyJwk);
}

const getPrivateKeyJwk = (address: string): JsonWebKey => {
  const normalized = normalizeAddress(address);
  const map = readLocalKeyMap();
  const entry = map[normalized];
  if (!entry?.privateKeyJwk) {
    throw new Error('No local decryption key found for this wallet');
  }
  return entry.privateKeyJwk;
};

export async function encryptTransactionNote(
  note: string,
  senderAddress: string,
  recipientAddress: string,
  meta?: EncryptedNotePayload['meta']
): Promise<EncryptedNotePayload> {
  const trimmed = note.trim();
  if (!trimmed) {
    throw new Error('Privacy mode requires a note to encrypt');
  }
  if (trimmed.length > 280) {
    throw new Error('Invalid note format');
  }

  const normalizedSender = normalizeAddress(senderAddress);
  const normalizedRecipient = normalizeAddress(recipientAddress);

  await ensureEncryptionIdentity(normalizedSender);
  const recipientPublicJwk = await fetchPublicKeyForAddress(normalizedRecipient);

  const recipientPublicKey = await crypto.subtle.importKey(
    'jwk',
    recipientPublicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, rawAesKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(trimmed)
  );

  return {
    version: 'hush-note-v2',
    algorithm: 'RSA-OAEP-2048/AES-GCM-256',
    senderAddress: normalizedSender,
    recipientAddress: normalizedRecipient,
    encryptedKey: toBase64(encryptedKey),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext),
    meta,
  };
}

export async function decryptTransactionNote(
  payload: EncryptedNotePayload,
  recipientAddress: string
): Promise<string> {
  const privateKeyJwk = getPrivateKeyJwk(recipientAddress);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );

  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(payload.encryptedKey)
  );

  const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(fromBase64(payload.iv)) },
    aesKey,
    fromBase64(payload.ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export async function storeEncryptedNoteMetadata(record: StoredEncryptedNote): Promise<void> {
  const response = await fetch('/api/privacy/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...record,
      kind: record.kind ?? (record.txHash ? 'payment_note' : 'chat'),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to persist encrypted note');
  }
}

export async function getEncryptedNotesForRecipient(recipientAddress: string): Promise<StoredEncryptedNote[]> {
  const response = await fetch(`/api/privacy/messages?recipient=${encodeURIComponent(normalizeAddress(recipientAddress))}`);
  if (!response.ok) {
    throw new Error('Failed to load encrypted notes');
  }
  const data = (await response.json()) as { messages?: StoredEncryptedNote[] };
  return data.messages ?? [];
}

export async function getEncryptedMessagesForWallet(
  walletAddress: string
): Promise<StoredEncryptedNote[]> {
  const response = await fetch(
    `/api/privacy/messages?recipient=${encodeURIComponent(normalizeAddress(walletAddress))}&includeSent=true`
  );

  if (!response.ok) {
    throw new Error('Failed to load encrypted messages');
  }

  const data = (await response.json()) as { messages?: StoredEncryptedNote[] };
  return data.messages ?? [];
}

export async function storeEncryptedChatMessage(record: {
  payload: EncryptedNotePayload;
  createdAt?: number;
  txHash?: string;
}): Promise<void> {
  await storeEncryptedNoteMetadata({
    id: `msg-${Date.now()}`,
    kind: record.txHash ? 'payment_note' : 'chat',
    txHash: record.txHash,
    payload: record.payload,
    createdAt: record.createdAt ?? Date.now(),
  });
}

export async function storePaymentRequestMessage(record: {
  payload: EncryptedNotePayload;
  amount: string;
  createdAt?: number;
  expiresAt?: number;
  requestId?: string;
}): Promise<{ requestId: string }> {
  const requestId = record.requestId ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = record.createdAt ?? Date.now();
  const expiresAt = record.expiresAt ?? createdAt + 24 * 60 * 60 * 1000;
  const payloadWithMeta: EncryptedNotePayload = {
    ...record.payload,
    meta: {
      ...(record.payload.meta ?? {}),
      type: 'request',
      requestId,
      amount: record.amount,
      status: 'pending',
      expiresAt,
    },
  };

  await storeEncryptedNoteMetadata({
    id: `msg-${Date.now()}`,
    requestId,
    kind: 'request',
    amount: record.amount,
    status: 'pending',
    expiresAt,
    payload: payloadWithMeta,
    createdAt,
  });

  return { requestId };
}

export async function updatePaymentRequestMessage(record: {
  id?: string;
  requestId?: string;
  status: 'pending' | 'paid' | 'expired' | 'rejected';
  txHash?: string;
  paidTxHash?: string;
  expiresAt?: number;
}): Promise<void> {
  const response = await fetch('/api/privacy/messages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error('Failed to update payment request');
  }
}

export async function resolveRecipientPublicKey(recipientAddress: string): Promise<JsonWebKey> {
  return fetchPublicKeyForAddress(recipientAddress);
}

export function rememberOutgoingMessagePreview(payload: EncryptedNotePayload, plaintext: string): void {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    return;
  }

  const map = readOutgoingPreviewMap();
  map[payload.ciphertext] = {
    ciphertext: payload.ciphertext,
    senderAddress: normalizeAddress(payload.senderAddress),
    recipientAddress: normalizeAddress(payload.recipientAddress),
    plaintext: trimmed,
    createdAt: Date.now(),
  };

  const entries = Object.entries(map)
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, 1000);
  writeOutgoingPreviewMap(Object.fromEntries(entries));
}

export function resolveOutgoingMessagePreview(
  payload: EncryptedNotePayload,
  walletAddress: string
): string | null {
  const map = readOutgoingPreviewMap();
  const entry = map[payload.ciphertext];
  if (!entry) {
    return null;
  }
  const normalizedWallet = normalizeAddress(walletAddress);
  if (entry.senderAddress !== normalizedWallet) {
    return null;
  }
  if (entry.recipientAddress !== normalizeAddress(payload.recipientAddress)) {
    return null;
  }
  return entry.plaintext;
}
