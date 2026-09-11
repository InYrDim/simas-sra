import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  deriveOpenWaWebhookSecret,
  verifyOpenWaSignature,
} from "@/lib/integrations/whatsapp-bot/openwa-webhook-secret";

const MASTER = "unit-test-master-secret";

test("deriveOpenWaWebhookSecret is deterministic and tenant-scoped", () => {
  process.env.BETTER_AUTH_SECRET = MASTER;
  try {
    const first = deriveOpenWaWebhookSecret("tenant-a");
    const second = deriveOpenWaWebhookSecret("tenant-a");
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, deriveOpenWaWebhookSecret("tenant-b"));
  } finally {
    delete process.env.BETTER_AUTH_SECRET;
  }
});

test("deriveOpenWaWebhookSecret requires the master secret", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;
  try {
    assert.throws(() => deriveOpenWaWebhookSecret("tenant-a"), /BETTER_AUTH_SECRET is required/);
  } finally {
    if (previous) process.env.BETTER_AUTH_SECRET = previous;
  }
});

test("verifyOpenWaSignature accepts a valid signature and rejects invalid ones", () => {
  const secret = "tenant-secret";
  const rawBody = '{"event":"message.received"}';
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  assert.equal(verifyOpenWaSignature(rawBody, expected, secret), true);
  assert.equal(verifyOpenWaSignature(rawBody, `sha256=${"0".repeat(64)}`, secret), false);
  assert.equal(verifyOpenWaSignature(rawBody, "sha256=short", secret), false);
  assert.equal(verifyOpenWaSignature(rawBody, "", secret), false);
  assert.equal(verifyOpenWaSignature(rawBody, null, secret), false);
  assert.equal(verifyOpenWaSignature(rawBody, undefined, secret), false);
  assert.equal(verifyOpenWaSignature(`${rawBody} `, expected, secret), false);
});