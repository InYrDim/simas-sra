import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";
import type { WhatsAppBotConnectionRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { ResolvedTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

export type ConnectWhatsAppBotResult =
  | { ok: true; sessionId: string; sessionName: string; webhookId: string }
  | { ok: false; code: "unconfigured" | "session-not-found" | "session-in-use" | "webhook-failed" | "openwa-unreachable" | "error" };

export type DisconnectWhatsAppBotResult =
  | { ok: true }
  | { ok: false; code: "openwa-unreachable" | "error" };

export type WhatsAppBotConnectionDependencies = {
  resolveCredential: (tenantId: string) => Promise<ResolvedTenantOpenWaCredential | null>;
  createClient: (config: OpenWaConnectionConfig) => OpenWaClient;
  readConnectionBySessionKey: (sessionKey: string) => Promise<WhatsAppBotConnectionRecord | null>;
  readConnectionByTenantId: (tenantId: string) => Promise<WhatsAppBotConnectionRecord | null>;
  upsertConnection: (record: WhatsAppBotConnectionRecord) => Promise<void>;
  removeConnection: (tenantId: string) => Promise<void>;
  webhookUrl: string;
  deriveSecret: (tenantId: string) => string;
  revalidate: (domain: string) => void;
};

function isConnectableOpenWaError(error: unknown): boolean {
  return (
    error instanceof OpenWaApiError &&
    (error.code === "unreachable" || error.code === "unauthorized")
  );
}

export async function connectWhatsAppBot(
  dependencies: WhatsAppBotConnectionDependencies,
  domain: string,
  tenantId: string,
): Promise<ConnectWhatsAppBotResult> {
  const credential = await dependencies.resolveCredential(tenantId);
  if (!credential) {
    return { ok: false, code: "unconfigured" };
  }
  const { apiBaseUrl, apiKey, sessionKey } = credential;
  if (!apiBaseUrl || !apiKey) {
    return { ok: false, code: "unconfigured" };
  }
  const client = dependencies.createClient({ apiBaseUrl, apiKey });

  let session;
  try {
    session = await client.resolveSession(sessionKey);
  } catch (error) {
    if (error instanceof OpenWaApiError) {
      if (isConnectableOpenWaError(error)) return { ok: false, code: "openwa-unreachable" };
      if (error.code === "not-found" || error.code === "invalid") return { ok: false, code: "session-not-found" };
    }
    return { ok: false, code: "error" };
  }

  if (session.status !== "ready") {
    return { ok: false, code: "session-not-found" };
  }

  const ownedByOther =
    (await dependencies.readConnectionBySessionKey(session.id)) ??
    (await dependencies.readConnectionBySessionKey(session.name));
  if (ownedByOther && ownedByOther.tenantId !== tenantId) {
    return { ok: false, code: "session-in-use" };
  }

  const current = await dependencies.readConnectionByTenantId(tenantId);
  if (current?.openwaSessionId === session.id) {
    await dependencies.upsertConnection({
      tenantId,
      openwaSessionId: session.id,
      openwaSessionName: session.name,
      openwaWebhookId: current.openwaWebhookId,
      status: "connected",
      botPhone: session.phone ?? current.botPhone,
      botPushName: session.pushName ?? current.botPushName,
      lastError: null,
    });
    dependencies.revalidate(domain);
    return { ok: true, sessionId: session.id, sessionName: session.name, webhookId: current.openwaWebhookId };
  }

  if (current) {
    try {
      await client.deleteWebhook(current.openwaSessionId, current.openwaWebhookId);
    } catch {
      // Best-effort: the stale webhook resolves by session key, which is about
      // to become unclaimed, so it will be rejected with 401 on delivery.
    }
  }

  let webhookId: string;
  try {
    const webhook = await client.createWebhook(session.id, {
      url: dependencies.webhookUrl,
      secret: dependencies.deriveSecret(tenantId),
    });
    webhookId = webhook.id;
  } catch (error) {
    if (error instanceof OpenWaApiError && isConnectableOpenWaError(error)) {
      return { ok: false, code: "openwa-unreachable" };
    }
    return { ok: false, code: "webhook-failed" };
  }

  await dependencies.upsertConnection({
    tenantId,
    openwaSessionId: session.id,
    openwaSessionName: session.name,
    openwaWebhookId: webhookId,
    status: "connected",
    botPhone: session.phone,
    botPushName: session.pushName,
    lastError: null,
  });
  dependencies.revalidate(domain);
  return { ok: true, sessionId: session.id, sessionName: session.name, webhookId };
}

export async function disconnectWhatsAppBot(
  dependencies: WhatsAppBotConnectionDependencies,
  domain: string,
  tenantId: string,
): Promise<DisconnectWhatsAppBotResult> {
  const current = await dependencies.readConnectionByTenantId(tenantId);
  if (!current) {
    dependencies.revalidate(domain);
    return { ok: true };
  }

  // When the Provider has removed the tenant's OpenWA credentials there is no
  // config to address the remote webhook with; the local row is still dropped
  // and the orphaned webhook on OpenWA is documented in the integration docs.
  const credential = await dependencies.resolveCredential(tenantId);
  if (credential?.apiBaseUrl && credential.apiKey) {
    const client = dependencies.createClient({ apiBaseUrl: credential.apiBaseUrl, apiKey: credential.apiKey });
    try {
      await client.deleteWebhook(current.openwaSessionId, current.openwaWebhookId);
    } catch (error) {
      if (error instanceof OpenWaApiError && isConnectableOpenWaError(error)) {
        return { ok: false, code: "openwa-unreachable" };
      }
      // A missing/conflicting webhook still means we can safely drop the local row.
    }
  }

  await dependencies.removeConnection(tenantId);
  dependencies.revalidate(domain);
  return { ok: true };
}