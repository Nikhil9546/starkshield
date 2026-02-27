/**
 * Secure storage for ElGamal private keys.
 * Keys are encrypted with a user-provided password before storing in localStorage.
 * Uses Web Crypto API (AES-GCM) for encryption at rest.
 */

import { serializeKeyPair, deserializeKeyPair, type ElGamalKeyPair } from './keygen';

const STORAGE_KEY_PREFIX = 'starkshield_key_';
const SALT_KEY = 'starkshield_salt';

/**
 * Derive an AES-GCM encryption key from a password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create a persistent salt for key derivation.
 */
function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

/**
 * Encrypt and store a keypair in localStorage, keyed by wallet address.
 */
export async function storeKeyPair(
  walletAddress: string,
  keyPair: ElGamalKeyPair,
  password: string
): Promise<void> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(password, salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const plaintext = new TextEncoder().encode(serializeKeyPair(keyPair));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const stored = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  };

  localStorage.setItem(
    STORAGE_KEY_PREFIX + walletAddress.toLowerCase(),
    JSON.stringify(stored)
  );
}

/**
 * Retrieve and decrypt a keypair from localStorage.
 * Returns null if no key found or decryption fails (wrong password).
 */
export async function loadKeyPair(
  walletAddress: string,
  password: string
): Promise<ElGamalKeyPair | null> {
  const raw = localStorage.getItem(
    STORAGE_KEY_PREFIX + walletAddress.toLowerCase()
  );
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw);
    const salt = getOrCreateSalt();
    const key = await deriveKey(password, salt);
    const iv = new Uint8Array(stored.iv);
    const ciphertext = new Uint8Array(stored.data);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const json = new TextDecoder().decode(plaintext);
    return deserializeKeyPair(json);
  } catch {
    return null;
  }
}

/**
 * Check if a keypair exists for a given wallet address.
 */
export function hasStoredKeyPair(walletAddress: string): boolean {
  return localStorage.getItem(
    STORAGE_KEY_PREFIX + walletAddress.toLowerCase()
  ) !== null;
}

/**
 * Delete a stored keypair.
 */
export function deleteKeyPair(walletAddress: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + walletAddress.toLowerCase());
}

/**
 * Export an encrypted keypair backup as a downloadable JSON string.
 */
export function exportKeyBackup(walletAddress: string): string | null {
  const raw = localStorage.getItem(
    STORAGE_KEY_PREFIX + walletAddress.toLowerCase()
  );
  if (!raw) return null;

  const salt = localStorage.getItem(SALT_KEY);
  return JSON.stringify({
    version: 1,
    walletAddress: walletAddress.toLowerCase(),
    salt: salt ? JSON.parse(salt) : null,
    encryptedKey: JSON.parse(raw),
  });
}

/**
 * Import a keypair backup from a previously exported JSON string.
 */
export function importKeyBackup(backup: string): void {
  const data = JSON.parse(backup);
  if (data.version !== 1) {
    throw new Error('Unsupported backup version');
  }

  if (data.salt) {
    localStorage.setItem(SALT_KEY, JSON.stringify(data.salt));
  }

  localStorage.setItem(
    STORAGE_KEY_PREFIX + data.walletAddress,
    JSON.stringify(data.encryptedKey)
  );
}
