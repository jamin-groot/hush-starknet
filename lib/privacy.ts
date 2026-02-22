export interface EncryptedNotePayload {
  version: 'hush-note-v1';
  algorithm: 'AES-GCM-256';
  senderPublicKey: string;
  recipientPublicKey: string;
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface StoredEncryptedNote {
  txHash: string;
  payload: EncryptedNotePayload;
  createdAt: number;
}

const STORAGE_KEY = 'hush.encryptedNotes';

const normalizePublicKey = (value: string): string => value.trim().toLowerCase();

const isLikelyPublicKey = (value: string): boolean => /^0x[0-9a-f]+$/i.test(value.trim());

async function deriveSharedSecret(
  senderPublicKey: string,
  recipientPublicKey: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const normalizedSender = normalizePublicKey(senderPublicKey);
  const normalizedRecipient = normalizePublicKey(recipientPublicKey);

  const keyMaterial = `${normalizedSender}:${normalizedRecipient}`;

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyMaterial),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export function resolveRecipientPublicKey(recipientAddress: string): string {
  if (!isLikelyPublicKey(recipientAddress)) {
    throw new Error('Missing recipient public key');
  }

  return normalizePublicKey(recipientAddress);
}

export async function encryptTransactionNote(
  note: string,
  senderPublicKey: string,
  recipientPublicKey: string
): Promise<EncryptedNotePayload> {
  if (!note || !note.trim()) {
    throw new Error('Privacy mode requires a note to encrypt');
  }

  const normalizedNote = note.trim();
  if (normalizedNote.length > 280) {
    throw new Error('Invalid note format');
  }

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSharedSecret(senderPublicKey, recipientPublicKey, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(normalizedNote)
  );

  return {
    version: 'hush-note-v1',
    algorithm: 'AES-GCM-256',
    senderPublicKey: normalizePublicKey(senderPublicKey),
    recipientPublicKey: normalizePublicKey(recipientPublicKey),
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  };
}

export async function decryptTransactionNote(
  payload: EncryptedNotePayload,
  senderPublicKey: string,
  recipientPublicKey: string
): Promise<string> {
  const key = await deriveSharedSecret(senderPublicKey, recipientPublicKey, new Uint8Array(base64ToArrayBuffer(payload.salt)));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(payload.iv)) },
    key,
    base64ToArrayBuffer(payload.ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

const safeRead = (): StoredEncryptedNote[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredEncryptedNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function storeEncryptedNoteMetadata(record: StoredEncryptedNote): void {
  if (typeof window === 'undefined') return;

  const existing = safeRead();
  const withoutCurrent = existing.filter((entry) => entry.txHash !== record.txHash);
  withoutCurrent.unshift(record);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutCurrent.slice(0, 100)));
}

export function getEncryptedNoteByHash(txHash: string): StoredEncryptedNote | null {
  const existing = safeRead();
  return existing.find((entry) => entry.txHash === txHash) ?? null;
}


export function getEncryptedNotesForRecipient(recipientPublicKey: string): StoredEncryptedNote[] {
  const normalized = normalizePublicKey(recipientPublicKey);
  return safeRead().filter((entry) => entry.payload.recipientPublicKey === normalized);
}
