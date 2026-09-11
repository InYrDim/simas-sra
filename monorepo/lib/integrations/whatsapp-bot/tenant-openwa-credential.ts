import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tenantOpenWaCredential } from "@/db/schema";
import { readOpenWaGlobalBaseUrl } from "@/lib/integrations/whatsapp-bot/openwa-config";
import { decryptSecret, encryptSecret } from "@/lib/platform/secret-cipher";

export type TenantOpenWaCredentialRecord = {
  tenantId: string;
  apiBaseUrl: string | null;
  apiKeyCiphertext: string;
  sessionKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ResolvedTenantOpenWaCredential = {
  tenantId: string;
  apiBaseUrl: string | null;
  usingGlobalDefault: boolean;
  apiKey: string;
  sessionKey: string;
};

const credentialColumns = {
  tenantId: tenantOpenWaCredential.tenantId,
  apiBaseUrl: tenantOpenWaCredential.apiBaseUrl,
  apiKeyCiphertext: tenantOpenWaCredential.apiKeyCiphertext,
  sessionKey: tenantOpenWaCredential.sessionKey,
  createdAt: tenantOpenWaCredential.createdAt,
  updatedAt: tenantOpenWaCredential.updatedAt,
} as const;

export type TenantOpenWaCredentialFields = {
  apiBaseUrl: string | null;
  apiKey: string;
  sessionKey: string;
};

export type TenantOpenWaCredentialInput = TenantOpenWaCredentialFields & { tenantId: string };

export type NormalizedTenantOpenWaCredentialInput = {
  apiBaseUrl: string | null;
  apiKey: string;
  sessionKey: string;
};

export function normalizeTenantOpenWaCredentialInput(input: TenantOpenWaCredentialFields):
  | { ok: true } & NormalizedTenantOpenWaCredentialInput
  | { ok: false; reason: "api-key-required" | "session-required" } {
  const apiKey = input.apiKey.trim();
  const sessionKey = input.sessionKey.trim();
  if (!apiKey) return { ok: false, reason: "api-key-required" };
  if (!sessionKey) return { ok: false, reason: "session-required" };
  const apiBaseUrl = (input.apiBaseUrl ?? "").trim().replace(/\/+$/, "") || null;
  return { ok: true, apiBaseUrl, apiKey, sessionKey };
}

export async function readTenantOpenWaCredential(
  tenantId: string,
): Promise<TenantOpenWaCredentialRecord | null> {
  const rows = await db
    .select(credentialColumns)
    .from(tenantOpenWaCredential)
    .where(eq(tenantOpenWaCredential.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export function resolveTenantOpenWaBaseUrl(
  override: string | null,
  globalBaseUrl: string | null,
): { apiBaseUrl: string | null; usingGlobalDefault: boolean } {
  if (override) return { apiBaseUrl: override.replace(/\/+$/, ""), usingGlobalDefault: false };
  if (globalBaseUrl) return { apiBaseUrl: globalBaseUrl.replace(/\/+$/, ""), usingGlobalDefault: true };
  return { apiBaseUrl: null, usingGlobalDefault: true };
}

export async function resolveTenantOpenWaCredential(
  tenantId: string,
): Promise<ResolvedTenantOpenWaCredential | null> {
  const record = await readTenantOpenWaCredential(tenantId);
  if (!record) return null;
  let apiKey: string;
  try {
    apiKey = decryptSecret(record.apiKeyCiphertext, { aad: tenantId });
  } catch {
    return null;
  }
  const baseUrl = resolveTenantOpenWaBaseUrl(record.apiBaseUrl, readOpenWaGlobalBaseUrl());
  return {
    tenantId,
    apiBaseUrl: baseUrl.apiBaseUrl,
    usingGlobalDefault: baseUrl.usingGlobalDefault,
    apiKey,
    sessionKey: record.sessionKey,
  };
}

export async function upsertTenantOpenWaCredential(input: TenantOpenWaCredentialInput): Promise<void> {
  const apiBaseUrl = (input.apiBaseUrl ?? "").trim().replace(/\/+$/, "") || null;
  const sessionKey = input.sessionKey.trim();
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("OpenWA API key must not be empty");
  if (!sessionKey) throw new Error("OpenWA session key must not be empty");
  const apiKeyCiphertext = encryptSecret(apiKey, { aad: input.tenantId });

  await db
    .insert(tenantOpenWaCredential)
    .values({
      tenantId: input.tenantId,
      apiBaseUrl,
      apiKeyCiphertext,
      sessionKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        apiBaseUrl,
        apiKeyCiphertext,
        sessionKey,
        updatedAt: sql`now(3)`,
      },
    });
}

export async function removeTenantOpenWaCredential(tenantId: string): Promise<void> {
  await db.delete(tenantOpenWaCredential).where(eq(tenantOpenWaCredential.tenantId, tenantId));
}