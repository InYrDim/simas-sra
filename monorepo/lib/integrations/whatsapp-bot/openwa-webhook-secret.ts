import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_SECRET_PURPOSE = "simas:integrations:whatsapp-bot:webhook-secret:v1";

/**
 * Deterministically derives the per-tenant HMAC-SHA256 secret used to sign
 * OpenWA webhook deliveries. The secret is never persisted: it is recomputed
 * from BETTER_AUTH_SECRET + tenantId with a domain-separated purpose tag.
 * Rotating BETTER_AUTH_SECRET invalidates previously registered webhooks
 * until the connection is re-registered.
 */
export function deriveOpenWaWebhookSecret(tenantId: string): string {
  const master = process.env.BETTER_AUTH_SECRET;
  if (!master) {
    throw new Error("BETTER_AUTH_SECRET is required to derive the OpenWA webhook secret");
  }
  return createHmac("sha256", master)
    .update(`${WEBHOOK_SECRET_PURPOSE}:${tenantId}`)
    .digest("hex");
}

export function verifyOpenWaSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}