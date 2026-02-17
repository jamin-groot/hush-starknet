/**
 * Real client-side encryption utilities using Web Crypto API
 * For Hush Notes feature - end-to-end encrypted transaction messages
 */

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Derives a cryptographic key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
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

/**
 * Encrypts a message using AES-GCM
 * @param message - Plain text message to encrypt
 * @param password - Password for encryption (in real app, use wallet signature)
 * @returns Encrypted data with IV and salt
 */
export async function encryptMessage(
  message: string,
  password: string = 'hush-default-key'
): Promise<EncryptedData> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const key = await deriveKey(password, salt);

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Convert to base64 for storage
    return {
      ciphertext: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
    };
  } catch (error) {
    console.error('[v0] Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypts a message using AES-GCM
 * @param encryptedData - Encrypted data object
 * @param password - Password for decryption
 * @returns Decrypted plain text message
 */
export async function decryptMessage(
  encryptedData: EncryptedData,
  password: string = 'hush-default-key'
): Promise<string> {
  try {
    const decoder = new TextDecoder();

    // Convert from base64
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const salt = base64ToArrayBuffer(encryptedData.salt);

    // Derive key from password
    const key = await deriveKey(password, new Uint8Array(salt));

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('[v0] Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Generates a secure random encryption key for demo purposes
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array);
}

/**
 * Checks if a message is encrypted (basic heuristic)
 */
export function isEncrypted(message: string): boolean {
  try {
    const parsed = JSON.parse(message);
    return !!(parsed.ciphertext && parsed.iv && parsed.salt);
  } catch {
    return false;
  }
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Format encrypted data for display (shows truncated ciphertext)
 */
export function formatEncryptedPreview(encryptedData: EncryptedData): string {
  const preview = encryptedData.ciphertext.substring(0, 32);
  return `🔒 ${preview}...`;
}
