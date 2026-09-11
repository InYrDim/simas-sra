import assert from "node:assert/strict";
import test from "node:test";

import { decryptSecret, encryptSecret } from "@/lib/platform/secret-cipher";

const key = new Uint8Array(32).fill(7);

test("encryptSecret then decryptSecret round-trips a secret with the same key and aad", () => {
  const stored = encryptSecret("openwa-token-123", { key, aad: "tenant-a" });
  assert.notEqual(stored, "openwa-token-123");
  assert.equal(decryptSecret(stored, { key, aad: "tenant-a" }), "openwa-token-123");
});

test("the ciphertext is unique per encryption and does not reveal the plaintext", () => {
  const a = encryptSecret("rahasia", { key, aad: "tenant-a" });
  const b = encryptSecret("rahasia", { key, aad: "tenant-a" });
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a, { key, aad: "tenant-a" }), "rahasia");
  assert.equal(decryptSecret(b, { key, aad: "tenant-a" }), "rahasia");
});

test("decryption fails closed when the key, aad, or ciphertext is tampered with", () => {
  const stored = encryptSecret("rahasia", { key, aad: "tenant-a" });
  const wrongKey = new Uint8Array(32).fill(9);
  assert.throws(() => decryptSecret(stored, { key: wrongKey, aad: "tenant-a" }), /invalid/i);
  assert.throws(() => decryptSecret(stored, { key, aad: "tenant-b" }), /invalid/i);
  assert.throws(() => decryptSecret("deadbeef", { key, aad: "tenant-a" }), /invalid/i);
});

test("the key may be supplied as a hex or base64 environment variable", () => {
  assert.throws(() => encryptSecret("rahasia", {}), /unavailable/i);
  assert.throws(() => encryptSecret("rahasia", { environment: { OPENWA_CREDENTIALS_KEY: "tooshort" } }), /unavailable/i);

  const hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const fromHex = encryptSecret("rahasia", { environment: { OPENWA_CREDENTIALS_KEY: hex } });
  assert.equal(decryptSecret(fromHex, { environment: { OPENWA_CREDENTIALS_KEY: hex } }), "rahasia");

  const base64 = Buffer.from(hex, "hex").toString("base64");
  const fromBase64 = encryptSecret("rahasia", { environment: { OPENWA_CREDENTIALS_KEY: base64 } });
  assert.equal(decryptSecret(fromBase64, { environment: { OPENWA_CREDENTIALS_KEY: base64 } }), "rahasia");
});