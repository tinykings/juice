/**
 * End-to-end encryption for the sync Gist. The key is 32 random bytes kept in the user's password
 * manager; GitHub only stores ciphertext. The iOS app implements the same format in
 * `Shared/GistCrypto.swift`:
 *
 *   { "version": 2, "encryption": "AES-256-GCM", "keyId": "1a2b3c4d", "iv": "<base64>", "ciphertext": "<base64>" }
 *
 * `ciphertext` is WebCrypto AES-GCM output (tag appended) of the version 1 sync document. Version 2
 * also makes older builds reject the file instead of overwriting it with plaintext.
 */

const AAD = new TextEncoder().encode('juice-tasks:v2');

export interface EncryptedEnvelope {
  version: 2;
  encryption: 'AES-256-GCM';
  keyId: string;
  iv: string;
  ciphertext: string;
}

export class GistEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GistEncryptionError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateEncryptionKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Accepts base64url or standard base64, ignoring whitespace a password manager may add. */
export function parseEncryptionKey(text: string): Uint8Array {
  let value = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  value += '='.repeat((4 - (value.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(value);
  } catch {
    throw new GistEncryptionError("That doesn't look like a Juice key. It should be 43 characters.");
  }
  if (bytes.length !== 32) {
    throw new GistEncryptionError("That doesn't look like a Juice key. It should be 43 characters.");
  }
  return bytes;
}

export function isValidEncryptionKey(text: string): boolean {
  try {
    parseEncryptionKey(text);
    return true;
  } catch {
    return false;
  }
}

/** Short fingerprint shown in Settings and stored in the envelope, so a wrong key gets a clear error. */
export async function encryptionKeyId(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', parseEncryptionKey(text) as BufferSource));
  return Array.from(digest.slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function importKey(text: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', parseEncryptionKey(text) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function isEncryptedContent(content: string): boolean {
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      && typeof (parsed as { version?: unknown }).version === 'number'
      && (parsed as { version: number }).version >= 2;
  } catch {
    return false;
  }
}

export async function encryptContent(plaintext: string, keyText: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    await importKey(keyText),
    new TextEncoder().encode(plaintext)
  ));
  const envelope: EncryptedEnvelope = {
    version: 2,
    encryption: 'AES-256-GCM',
    keyId: await encryptionKeyId(keyText),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptContent(content: string, keyText: string | undefined): Promise<string> {
  const envelope = JSON.parse(content) as Partial<EncryptedEnvelope>;
  if (envelope.version !== 2 || envelope.encryption !== 'AES-256-GCM'
    || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
    throw new GistEncryptionError('This Gist uses a newer format. Update Juice.');
  }
  if (!keyText) {
    throw new GistEncryptionError('This Gist is encrypted. Enter your key in Settings to sync.');
  }
  if (envelope.keyId !== await encryptionKeyId(keyText)) {
    throw new GistEncryptionError(`This Gist was encrypted with a different key (ID ${envelope.keyId}).`);
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource, additionalData: AAD },
      await importKey(keyText),
      fromBase64(envelope.ciphertext) as BufferSource
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new GistEncryptionError("The encrypted Gist couldn't be decrypted. It may be damaged.");
  }
}
