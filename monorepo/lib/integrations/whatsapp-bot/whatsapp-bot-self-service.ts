import { OpenWaApiError, type OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";
import { buildSessionName } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request";
import type {
  WhatsAppBotRequestChanges,
  WhatsAppBotRequestRecord,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";
import type { ConnectWhatsAppBotResult } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import type {
  TenantOpenWaCredentialInput,
} from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
import type { WhatsAppBotRequestTransitionResult } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request";

const MAX_SESSION_NAME_TRIES = 6;

export type WhatsAppBotSelfServiceDependencies = {
  readLatestRequest: (tenantId: string) => Promise<WhatsAppBotRequestRecord | null>;
  updateRequest: (id: string, changes: WhatsAppBotRequestChanges) => Promise<void>;
  createClient: (config: OpenWaConnectionConfig) => OpenWaClient;
  adminApiBaseUrl: string | null;
  adminApiKey: string | null;
  upsertCredential: (input: TenantOpenWaCredentialInput) => Promise<void>;
  connect: (domain: string, tenantId: string) => Promise<ConnectWhatsAppBotResult>;
  markFulfilled: (
    requestId: string,
    actorId: string,
    method: "self_service",
  ) => Promise<WhatsAppBotRequestTransitionResult>;
};

export type StartWhatsAppBotSelfServiceResult =
  | { ok: true; sessionId: string; sessionName: string; alreadyStarted: boolean }
  | { ok: false; code: "not-approved" | "provisioning-disabled" | "session-name-taken" | "admin-key-invalid" | "openwa-unreachable" | "credential-failed" | "openwa-error" };

export type SelfServiceQrResult =
  | { ok: true; qrCode: string; status: string }
  | { ok: false; code: "not-started" | "provisioning-disabled" | "admin-key-invalid" | "openwa-unreachable" | "qr-unavailable" | "openwa-error" };

export type CompleteWhatsAppBotSelfServiceResult =
  | { ok: true; sessionId: string; sessionName: string; webhookId: string }
  | { ok: false; code: "not-started" | "session-not-ready" | "unconfigured" | "connect-failed" };

export type SelfServiceSessionStatusResult =
  | { ok: true; status: string | null; connected: boolean }
  | { ok: false; code: "not-started" | "provisioning-disabled" | "admin-key-invalid" | "openwa-unreachable" | "qr-unavailable" | "openwa-error" };

function missingProvisioningConfig(dependencies: WhatsAppBotSelfServiceDependencies): boolean {
  return !dependencies.adminApiBaseUrl || !dependencies.adminApiKey;
}

function mapProvisioningError(error: unknown): StartWhatsAppBotSelfServiceResult {
  if (error instanceof OpenWaApiError) {
    if (error.code === "unauthorized") return { ok: false, code: "admin-key-invalid" };
    if (error.code === "unreachable") return { ok: false, code: "openwa-unreachable" };
  }
  return { ok: false, code: "openwa-error" };
}

export async function startWhatsAppBotSelfService(
  dependencies: WhatsAppBotSelfServiceDependencies,
  tenantId: string,
  domain: string,
): Promise<StartWhatsAppBotSelfServiceResult> {
  const request = await dependencies.readLatestRequest(tenantId);
  if (!request || request.status !== "approved") return { ok: false, code: "not-approved" };
  if (request.openwaSessionId) {
    return {
      ok: true,
      sessionId: request.openwaSessionId,
      sessionName: request.desiredSessionName ?? domain,
      alreadyStarted: true,
    };
  }
  if (missingProvisioningConfig(dependencies)) return { ok: false, code: "provisioning-disabled" };

  const client = dependencies.createClient({
    apiBaseUrl: dependencies.adminApiBaseUrl!,
    apiKey: dependencies.adminApiKey!,
  });
  const sessionName = buildSessionName(domain, request.desiredSessionName);

  let session;
  for (let attempt = 0; attempt < MAX_SESSION_NAME_TRIES; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = attempt === 0 ? sessionName : `${sessionName.slice(0, 50 - suffix.length)}${suffix}`;
    try {
      session = await client.createSession(candidate);
      break;
    } catch (error) {
      if (error instanceof OpenWaApiError && error.code === "conflict") continue;
      return mapProvisioningError(error);
    }
  }
  if (!session) return { ok: false, code: "session-name-taken" };

  try {
    await client.startSession(session.id);
  } catch (error) {
    return mapProvisioningError(error);
  }

  let apiKey;
  try {
    apiKey = await client.createApiKey({
      name: `${session.name}-key`,
      role: "operator",
      allowedSessions: [session.id],
    });
  } catch (error) {
    if (error instanceof OpenWaApiError && error.code === "unauthorized") return { ok: false, code: "admin-key-invalid" };
    if (error instanceof OpenWaApiError && error.code === "unreachable") return { ok: false, code: "openwa-unreachable" };
    return { ok: false, code: "openwa-error" };
  }

  try {
    await dependencies.upsertCredential({
      tenantId,
      apiBaseUrl: null,
      apiKey: apiKey.apiKey,
      sessionKey: session.name,
    });
  } catch {
    return { ok: false, code: "credential-failed" };
  }

  await dependencies.updateRequest(request.id, { openwaSessionId: session.id });
  return { ok: true, sessionId: session.id, sessionName: session.name, alreadyStarted: false };
}

export async function readSelfServiceQr(
  dependencies: WhatsAppBotSelfServiceDependencies,
  tenantId: string,
): Promise<SelfServiceQrResult> {
  const request = await dependencies.readLatestRequest(tenantId);
  if (!request || request.status !== "approved" || !request.openwaSessionId) {
    return { ok: false, code: "not-started" };
  }
  if (missingProvisioningConfig(dependencies)) return { ok: false, code: "provisioning-disabled" };

  const client = dependencies.createClient({
    apiBaseUrl: dependencies.adminApiBaseUrl!,
    apiKey: dependencies.adminApiKey!,
  });
  try {
    const qr = await client.getSessionQr(request.openwaSessionId);
    return { ok: true, qrCode: qr.qrCode, status: qr.status };
  } catch (error) {
    if (error instanceof OpenWaApiError) {
      if (error.code === "unauthorized") return { ok: false, code: "admin-key-invalid" };
      if (error.code === "unreachable") return { ok: false, code: "openwa-unreachable" };
      if (error.code === "not-found" || error.code === "conflict" || error.code === "invalid") {
        return { ok: false, code: "qr-unavailable" };
      }
    }
    return { ok: false, code: "openwa-error" };
  }
}

export async function readSelfServiceSessionStatus(
  dependencies: WhatsAppBotSelfServiceDependencies,
  tenantId: string,
): Promise<SelfServiceSessionStatusResult> {
  const request = await dependencies.readLatestRequest(tenantId);
  if (!request || request.status !== "approved" || !request.openwaSessionId) {
    return { ok: false, code: "not-started" };
  }
  if (missingProvisioningConfig(dependencies)) return { ok: false, code: "provisioning-disabled" };

  const client = dependencies.createClient({
    apiBaseUrl: dependencies.adminApiBaseUrl!,
    apiKey: dependencies.adminApiKey!,
  });
  try {
    const session = await client.getSession(request.openwaSessionId);
    if (!session) return { ok: false, code: "qr-unavailable" };
    return { ok: true, status: session.status, connected: session.status === "connected" };
  } catch (error) {
    if (error instanceof OpenWaApiError) {
      if (error.code === "unauthorized") return { ok: false, code: "admin-key-invalid" };
      if (error.code === "unreachable") return { ok: false, code: "openwa-unreachable" };
      if (error.code === "not-found" || error.code === "conflict" || error.code === "invalid") {
        return { ok: false, code: "qr-unavailable" };
      }
    }
    return { ok: false, code: "openwa-error" };
  }
}

export async function completeWhatsAppBotSelfService(
  dependencies: WhatsAppBotSelfServiceDependencies,
  tenantId: string,
  domain: string,
  actorId: string,
): Promise<CompleteWhatsAppBotSelfServiceResult> {
  const request = await dependencies.readLatestRequest(tenantId);
  if (!request || request.status !== "approved" || !request.openwaSessionId) {
    return { ok: false, code: "not-started" };
  }

  const connected = await dependencies.connect(domain, tenantId);
  if (!connected.ok) {
    if (connected.code === "session-not-found") return { ok: false, code: "session-not-ready" };
    if (connected.code === "unconfigured") return { ok: false, code: "unconfigured" };
    return { ok: false, code: "connect-failed" };
  }

  await dependencies.markFulfilled(request.id, actorId, "self_service");
  return {
    ok: true,
    sessionId: connected.sessionId,
    sessionName: connected.sessionName,
    webhookId: connected.webhookId,
  };
}