import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // GCM standard: 12-byte IV
const AUTH_TAG_LENGTH = 16;  // GCM standard: 16-byte auth tag
const KEY_LENGTH = 32;       // AES-256: 32-byte key

/**
 * Derive a 32-byte encryption key from a hex string or passphrase.
 * If the input is a valid 64-char hex string, decode it directly.
 * Otherwise, SHA-256 hash it to produce a deterministic 32-byte key.
 */
function deriveKey(keyInput: string): Buffer {
  const cleaned = keyInput.startsWith('0x') ? keyInput.substring(2) : keyInput;

  if (/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    return Buffer.from(cleaned, 'hex');
  }

  // Fallback: SHA-256 hash of the passphrase to get 32 bytes
  return crypto.createHash('sha256').update(keyInput).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * Output format: IV (12 bytes) || AuthTag (16 bytes) || Ciphertext
 * This produces a single Buffer suitable for uploading to Walrus.
 */
export function encrypt(plaintext: string, keyHex: string): Buffer {
  const key = deriveKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate: IV || AuthTag || Ciphertext
  const result = Buffer.concat([iv, authTag, encrypted]);

  console.log(`[Crypto] Encrypted ${plaintext.length} bytes → ${result.length} bytes (AES-256-GCM, IV: ${iv.toString('hex').substring(0, 8)}...)`);
  return result;
}

/**
 * Decrypt ciphertext produced by `encrypt()`.
 *
 * Input format: IV (12 bytes) || AuthTag (16 bytes) || Ciphertext
 */
export function decrypt(cipherBuffer: Buffer, keyHex: string): string {
  if (cipherBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error(`[Crypto] Ciphertext too short (${cipherBuffer.length} bytes). Expected at least ${IV_LENGTH + AUTH_TAG_LENGTH + 1}.`);
  }

  const key = deriveKey(keyHex);

  // Extract components
  const iv = cipherBuffer.subarray(0, IV_LENGTH);
  const authTag = cipherBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = cipherBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const plaintext = decrypted.toString('utf8');
  console.log(`[Crypto] Decrypted ${cipherBuffer.length} bytes → ${plaintext.length} chars (AES-256-GCM, verified)`);
  return plaintext;
}
