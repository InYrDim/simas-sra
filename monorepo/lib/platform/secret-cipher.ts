import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("SIMASSC1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type SecretCipherOptions = Readonly<{
  key?: Uint8Array | string;
  aad?: string;
  environment?: Record<string, string | undefined>;
}>;

function encryptionKey(
  value: Uint8Array | string | undefined,
  environment: Record<string, string | undefined>,
) {
  const configured = value ?? environment.OPENWA_CREDENTIALS_KEY;
  if (configured instanceof Uint8Array) return configured.byteLength === 32 ? Buffer.from(configured) : null;
  if (!configured) return null;
  const encoding = /^[0-9a-f]{64}$/i.test(configured) ? "hex" : "base64";
  const decoded = Buffer.from(configured, encoding);
  return decoded.byteLength === 32 ? decoded : null;
}

function requireKey(options: SecretCipherOptions) {
  const key = encryptionKey(options.key, options.environment ?? process.env);
  if (!key) throw new Error("Secret encryption unavailable (OPENWA_CREDENTIALS_KEY)");
  return key;
}

function aadBuffer(aad: string | undefined) {
  return aad ? Buffer.from(aad, "utf8") : undefined;
}

/**
 * Encrypts a secret at rest with AES-256-GCM and encodes it as a hex string of
 * MAGIC + random IV + auth tag + ciphertext. The optional AAD binds the
 * ciphertext to its owner (for example the tenant id) so a ciphertext cannot be
 * transplanted to another row.
 */
export function encryptSecret(plaintext: string, options: SecretCipherOptions = {}): string {
  const key = requireKey(options);
  const aad = aadBuffer(options.aad);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]).toString("hex");
}

export function decryptSecret(stored: string, options: SecretCipherOptions = {}): string {
  const key = requireKey(options);
  const buffer = Buffer.from(stored, "hex");
  if (
    buffer.byteLength < MAGIC.byteLength + IV_BYTES + TAG_BYTES ||
    !buffer.subarray(0, MAGIC.byteLength).equals(MAGIC)
  ) {
    throw new Error("Encrypted secret is invalid");
  }
  const ivStart = MAGIC.byteLength;
  const tagStart = ivStart + IV_BYTES;
  const ciphertextStart = tagStart + TAG_BYTES;
  const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(ivStart, tagStart));
  const aad = aadBuffer(options.aad);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(buffer.subarray(tagStart, ciphertextStart));
  try {
    return Buffer.concat([decipher.update(buffer.subarray(ciphertextStart)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Encrypted secret is invalid");
  }
}