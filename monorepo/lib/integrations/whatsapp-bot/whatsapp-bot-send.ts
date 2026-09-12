import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";
import type { WhatsAppBotConnectionRecord, OutboundMessageRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { ResolvedTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

export type SendWhatsAppTextResult =
  | { ok: true; messageId: string }
  | { ok: false; code: "unconfigured" | "not-connected" | "session-not-ready" | "recipient-invalid" | "openwa-unreachable" | "error" };

export type WhatsAppBotSendDependencies = {
  resolveCredential: (tenantId: string) => Promise<ResolvedTenantOpenWaCredential | null>;
  createClient: (config: OpenWaConnectionConfig) => OpenWaClient;
  readConnectionByTenantId: (tenantId: string) => Promise<WhatsAppBotConnectionRecord | null>;
  recordOutboundMessage: (message: OutboundMessageRecord) => Promise<void>;
};

export type SendWhatsAppTextInput = {
  chatId: string;
  text: string;
};

function isInteractiveOpenWaError(error: unknown): boolean {
  return (
    error instanceof OpenWaApiError &&
    (error.code === "unreachable" || error.code === "unauthorized")
  );
}

/**
 * OpenWA addresses chats by full WhatsApp JID: `phone@c.us` for individual
 * chats, `groupId@g.us` for groups. Users type bare numbers, so append the
 * `@c.us` suffix unless the value already carries a JID domain.
 */
function normalizeChatId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("@")) return trimmed;
  return `${trimmed}@c.us`;
}

export async function sendWhatsAppText(
  dependencies: WhatsAppBotSendDependencies,
  tenantId: string,
  input: SendWhatsAppTextInput,
): Promise<SendWhatsAppTextResult> {
  const chatId = normalizeChatId(input.chatId);
  const text = input.text.trim();
  if (!chatId || !text) return { ok: false, code: "recipient-invalid" };

  const credential = await dependencies.resolveCredential(tenantId);
  if (!credential?.apiBaseUrl || !credential.apiKey) {
    return { ok: false, code: "unconfigured" };
  }

  const connection = await dependencies.readConnectionByTenantId(tenantId);
  if (!connection || connection.status !== "connected") {
    return { ok: false, code: "not-connected" };
  }

  const client = dependencies.createClient({ apiBaseUrl: credential.apiBaseUrl, apiKey: credential.apiKey });

  let sent;
  try {
    sent = await client.sendText(connection.openwaSessionId, { chatId, text });
  } catch (error) {
    if (error instanceof OpenWaApiError) {
      if (isInteractiveOpenWaError(error)) return { ok: false, code: "openwa-unreachable" };
      if (error.code === "conflict") return { ok: false, code: "session-not-ready" };
      if (error.code === "invalid" || error.code === "not-found") return { ok: false, code: "recipient-invalid" };
    }
    return { ok: false, code: "error" };
  }

  const now = new Date();
  await dependencies.recordOutboundMessage({
    tenantId,
    openwaMessageId: sent.messageId,
    idempotencyKey: `outbound:${sent.messageId}`,
    event: "message.sent",
    chatId,
    fromWa: connection.botPhone ?? "",
    toWa: chatId,
    body: text,
    messageType: "text",
    hasMedia: false,
    isGroup: chatId.endsWith("@g.us"),
    kind: "text",
    metadata: null,
    messageTimestamp: sent.timestamp,
    sentAt: now,
    deliveryStatus: "sent",
  });

  return { ok: true, messageId: sent.messageId };
}