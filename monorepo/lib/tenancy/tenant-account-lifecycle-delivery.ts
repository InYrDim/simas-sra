import { createHmac } from "node:crypto";
import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { securityOutbox, tenant, tenantAccountLifecycleCase, user } from "@/db/schema";
import { deriveLifecycleSecret, type LifecycleCaseKind } from "@/lib/authorization/tenant-account-lifecycle";

export type InternalLifecycleDelivery = Readonly<{
  caseId: string;
  tenantId: string;
  userId: string;
  kind: LifecycleCaseKind;
  recipient: string;
  activationUrl: string;
  secret: string;
  expiresAt: Date;
}>;

export async function sendToInternalLifecycleAdapter(delivery: InternalLifecycleDelivery): Promise<void> {
  const endpoint = process.env.INTERNAL_LIFECYCLE_DELIVERY_URL;
  const signingKey = process.env.INTERNAL_LIFECYCLE_DELIVERY_SIGNING_KEY;
  if (!endpoint) throw new Error("INTERNAL_LIFECYCLE_DELIVERY_URL is required");
  if (!signingKey || Buffer.byteLength(signingKey, "utf8") < 32) throw new Error("INTERNAL_LIFECYCLE_DELIVERY_SIGNING_KEY is required");
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("lifecycle adapter must use HTTPS");
  const body = JSON.stringify({
    caseId: delivery.caseId,
    tenantId: delivery.tenantId,
    userId: delivery.userId,
    kind: delivery.kind,
    recipient: delivery.recipient,
    activationUrl: delivery.activationUrl,
    secret: delivery.secret,
    expiresAt: delivery.expiresAt.toISOString(),
  });
  const signature = createHmac("sha256", signingKey).update(body).digest("hex");
  const response = await fetch(parsed, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": delivery.caseId, "x-lifecycle-signature": signature },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`lifecycle adapter returned ${response.status}`);
}

function lifecycleUrl(domain: string, caseId: string): string {
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("APP_URL is required for lifecycle delivery");
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(domain)}/account-lifecycle/${encodeURIComponent(caseId)}`;
}

export function createInternalLifecycleDelivery(input: Readonly<{
  domain: string;
  caseId: string;
  tenantId: string;
  userId: string;
  kind: LifecycleCaseKind;
  recipient: string;
  secret: string;
  expiresAt: Date;
}>): InternalLifecycleDelivery {
  return { ...input, activationUrl: lifecycleUrl(input.domain, input.caseId) };
}

export async function deliverPendingLifecycleEvents(input: Readonly<{ limit?: number; now?: Date; send: (delivery: InternalLifecycleDelivery) => Promise<void> }> ) {
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be between 1 and 100");
  const now = input.now ?? new Date();
  const delivered: InternalLifecycleDelivery[] = [];

  const events = await db.select({
      outboxId: securityOutbox.id,
      caseId: tenantAccountLifecycleCase.id,
      tenantId: tenantAccountLifecycleCase.tenantId,
      userId: tenantAccountLifecycleCase.userId,
      kind: tenantAccountLifecycleCase.kind,
      deliveryChannel: tenantAccountLifecycleCase.deliveryChannel,
      expiresAt: tenantAccountLifecycleCase.expiresAt,
      attempts: securityOutbox.attempts,
      domain: tenant.domain,
      recipient: user.email,
    }).from(securityOutbox)
      .innerJoin(tenantAccountLifecycleCase, eq(tenantAccountLifecycleCase.id, sql`JSON_UNQUOTE(JSON_EXTRACT(${securityOutbox.payload}, '$.caseId'))`))
      .innerJoin(tenant, eq(tenant.id, tenantAccountLifecycleCase.tenantId))
      .innerJoin(user, and(eq(user.id, tenantAccountLifecycleCase.userId), eq(user.tenantId, tenantAccountLifecycleCase.tenantId)))
      .where(and(eq(securityOutbox.eventType, "tenant_account.lifecycle_delivery_requested"), isNull(securityOutbox.publishedAt), lte(securityOutbox.availableAt, now), eq(tenantAccountLifecycleCase.state, "pending")))
      .limit(limit);

    for (const event of events) {
      if (event.deliveryChannel !== "email" || !event.expiresAt || event.expiresAt <= now) {
        await db.transaction(async (transaction) => {
          const marked = await transaction.update(securityOutbox).set({ publishedAt: now, attempts: sql`${securityOutbox.attempts} + 1`, lastError: "lifecycle case is not deliverable" }).where(and(eq(securityOutbox.id, event.outboxId), isNull(securityOutbox.publishedAt)));
          if (marked[0].affectedRows === 1) {
            await transaction.update(tenantAccountLifecycleCase).set({ deliveryAttempts: sql`${tenantAccountLifecycleCase.deliveryAttempts} + 1`, updatedAt: now }).where(eq(tenantAccountLifecycleCase.id, event.caseId));
          }
          if (event.expiresAt && event.expiresAt <= now) {
            await transaction.update(tenantAccountLifecycleCase).set({ state: "expired", version: sql`${tenantAccountLifecycleCase.version} + 1`, updatedAt: now }).where(and(eq(tenantAccountLifecycleCase.id, event.caseId), eq(tenantAccountLifecycleCase.state, "pending")));
          }
        });
        continue;
      }

      try {
        const secret = deriveInternalEmailSecret({ key: process.env.TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY ?? "", caseId: event.caseId, kind: event.kind, tenantId: event.tenantId, userId: event.userId, expiresAt: event.expiresAt });
        const delivery = createInternalLifecycleDelivery({ caseId: event.caseId, tenantId: event.tenantId, userId: event.userId, kind: event.kind, recipient: event.recipient, domain: event.domain, secret, expiresAt: event.expiresAt });
        await input.send(delivery);
        const published = await db.transaction(async (transaction) => {
          const updated = await transaction.update(securityOutbox).set({ publishedAt: now, attempts: sql`${securityOutbox.attempts} + 1`, lastError: null }).where(and(eq(securityOutbox.id, event.outboxId), isNull(securityOutbox.publishedAt)));
          if (updated[0].affectedRows === 1) {
            await transaction.update(tenantAccountLifecycleCase).set({ deliveryAttempts: sql`${tenantAccountLifecycleCase.deliveryAttempts} + 1`, updatedAt: now }).where(eq(tenantAccountLifecycleCase.id, event.caseId));
          }
          return updated;
        });
        if (published[0].affectedRows === 1) delivered.push(delivery);
      } catch {
        const retryAt = new Date(now.getTime() + Math.min(60 * 60_000, 5_000 * 2 ** Math.min(event.attempts, 8)));
        await db.transaction(async (transaction) => {
          const marked = await transaction.update(securityOutbox).set({ attempts: sql`${securityOutbox.attempts} + 1`, availableAt: retryAt, lastError: "lifecycle delivery adapter failed" }).where(and(eq(securityOutbox.id, event.outboxId), isNull(securityOutbox.publishedAt)));
          if (marked[0].affectedRows === 1) {
            await transaction.update(tenantAccountLifecycleCase).set({ deliveryAttempts: sql`${tenantAccountLifecycleCase.deliveryAttempts} + 1`, updatedAt: now }).where(eq(tenantAccountLifecycleCase.id, event.caseId));
          }
        });
      }
  }
  return delivered;
}

export function deriveInternalEmailSecret(input: Readonly<{ key: string; caseId: string; kind: LifecycleCaseKind; tenantId: string; userId: string; expiresAt: Date }>): string {
  return deriveLifecycleSecret({ key: input.key, caseId: input.caseId, purpose: input.kind, tenantId: input.tenantId, userId: input.userId, expiresAt: input.expiresAt });
}
