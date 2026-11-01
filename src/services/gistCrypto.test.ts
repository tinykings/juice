import { describe, expect, it } from 'vitest';
import {
  decryptContent,
  encryptContent,
  encryptionKeyId,
  generateEncryptionKey,
  isEncryptedContent,
  isValidEncryptionKey,
} from './gistCrypto';
import { createSyncDocument, parseSyncDocument } from './gistSync';

// Produced by the iOS app's GistCrypto.encrypt, so both clients stay compatible.
const IOS_KEY = 'q6p2n0g1XyBwW3cJgF7m0Lr4Vh9TkZsDe8aYbUc5NiQ';
const IOS_ENVELOPE = "{\"ciphertext\":\"m5FZ7+ciibaahZIO2tGmugGLm3D6y3ejjNWhFAJByA4Vrgic2DT1SZwdJhsBLvV8ApUxm5rzchKZt8+vfNhfJrPpX5Lnjb/Ywlct4BREU0A92qr/pSqUjYtbC7iM/4da4a5ueO0Av0Ra8lJFC/OXwUN4uny5QfMuP/86ZDrRM1iTzuqU1vEiJA1VXtQnipSgQv8Xm3J0I54J4YkppDk0Y/dFa55hh9FtRMKvEugLUaKWX21oSXvky0gt4s0XZ3T+e5wRDKf10Irpm42wQQ6AiJ3jF1sa8YFyzPjPfQB1OwWLQ/P6mpRSJsrtJZqWSP4r+nLOzLAC+LoJABE/lPdmqsrSc+YVUp0VOlnhJ+ArQFOxlGcDD8cjiWKacK7PDYrdOHrYDY+PuPUEkJq1ywNhLI3Ofu6J/1aC\",\"encryption\":\"AES-256-GCM\",\"iv\":\"Up+wc9IVwX2dQGdt\",\"keyId\":\"58ae3256\",\"version\":2}";

describe('gistCrypto', () => {
  it('generates 43-character base64url keys', () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isValidEncryptionKey(key)).toBe(true);
  });

  it('accepts keys with whitespace a password manager may add', () => {
    const key = generateEncryptionKey();
    expect(isValidEncryptionKey(`  ${key.slice(0, 20)}\n${key.slice(20)} `)).toBe(true);
    expect(isValidEncryptionKey('too-short')).toBe(false);
  });

  it('round-trips a sync document', async () => {
    const key = generateEncryptionKey();
    const plaintext = JSON.stringify(createSyncDocument([]));
    const content = await encryptContent(plaintext, key);

    expect(isEncryptedContent(content)).toBe(true);
    expect(content).not.toContain('tasks');
    expect(await decryptContent(content, key)).toBe(plaintext);
  });

  it('explains a missing or wrong key instead of failing silently', async () => {
    const content = await encryptContent('{}', generateEncryptionKey());
    await expect(decryptContent(content, undefined)).rejects.toThrow('This Gist is encrypted');
    await expect(decryptContent(content, generateEncryptionKey())).rejects.toThrow('different key');
  });

  it('rejects tampered ciphertext', async () => {
    const key = generateEncryptionKey();
    const envelope = JSON.parse(await encryptContent('{"version":1}', key));
    envelope.ciphertext = envelope.ciphertext.replace(/^./, (c: string) => (c === 'A' ? 'B' : 'A'));
    await expect(decryptContent(JSON.stringify(envelope), key)).rejects.toThrow("couldn't be decrypted");
  });

  it('makes older clients refuse the file instead of overwriting it', async () => {
    const content = await encryptContent('{}', generateEncryptionKey());
    expect(() => parseSyncDocument(content)).toThrow('Unsupported Gist sync document version: 2');
  });

  it('plain documents are not treated as encrypted', () => {
    expect(isEncryptedContent(JSON.stringify(createSyncDocument([])))).toBe(false);
    expect(isEncryptedContent('[]')).toBe(false);
  });

  it('decrypts what the iOS app encrypts', async () => {
    expect(await encryptionKeyId(IOS_KEY)).toBe(JSON.parse(IOS_ENVELOPE).keyId);
    const document = parseSyncDocument(await decryptContent(IOS_ENVELOPE, IOS_KEY));
    expect(document.tasks.map((task) => task.title)).toEqual(['Encrypted on iPhone']);
  });
});
