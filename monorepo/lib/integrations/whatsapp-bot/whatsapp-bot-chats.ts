import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";
import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaChat } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { WhatsAppBotConnectionRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { ResolvedTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

const OPENWA_PAGE_MAX = 1000;
const LIST_CHATS_LIMIT_MAX = 5000;

export type ListWhatsAppBotChatsResult =
  | { ok: true; chats: OpenWaChat[]; hasMore: boolean }
  | { ok: false; code: "unconfigured" | "not-connected" | "session-not-ready" | "openwa-unreachable" | "error" };

export type WhatsAppBotChatsDependencies = {
  resolveCredential: (tenantId: string) => Promise<ResolvedTenantOpenWaCredential | null>;
  createClient: (config: OpenWaConnectionConfig) => OpenWaClient;
  readConnectionByTenantId: (tenantId: string) => Promise<WhatsAppBotConnectionRecord | null>;
};

export type ListWhatsAppBotChatsInput = {
  offset: number;
  limit: number;
};

function isInteractiveOpenWaError(error: unknown): boolean {
  return (
    error instanceof OpenWaApiError &&
    (error.code === "unreachable" || error.code === "unauthorized")
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export async function listWhatsAppBotChats(
  dependencies: WhatsAppBotChatsDependencies,
  tenantId: string,
  input: ListWhatsAppBotChatsInput,
): Promise<ListWhatsAppBotChatsResult> {
  const credential = await dependencies.resolveCredential(tenantId);
  if (!credential?.apiBaseUrl || !credential.apiKey) {
    return { ok: false, code: "unconfigured" };
  }

  const connection = await dependencies.readConnectionByTenantId(tenantId);
  if (!connection || connection.status !== "connected") {
    return { ok: false, code: "not-connected" };
  }

  const client = dependencies.createClient({ apiBaseUrl: credential.apiBaseUrl, apiKey: credential.apiKey });

  const offset = clamp(input.offset, 0, LIST_CHATS_LIMIT_MAX);
  const limit = clamp(input.limit, 1, LIST_CHATS_LIMIT_MAX);

  const chats: OpenWaChat[] = [];
  let cursor = offset;

  try {
    while (chats.length < limit) {
      const pageSize = Math.min(OPENWA_PAGE_MAX, limit - chats.length);
      const page = await client.listChats(connection.openwaSessionId, {
        limit: pageSize,
        offset: cursor,
      });
      chats.push(...page);
      if (page.length < pageSize) break;
      cursor += pageSize;
    }
  } catch (error) {
    if (error instanceof OpenWaApiError) {
      if (isInteractiveOpenWaError(error)) return { ok: false, code: "openwa-unreachable" };
      // 400 = session not ready, 409 = session not connected, 404 = missing.
      if (error.code === "invalid" || error.code === "conflict" || error.code === "not-found") {
        return { ok: false, code: "session-not-ready" };
      }
    }
    return { ok: false, code: "error" };
  }

  const hasMore = chats.length >= limit;
  return { ok: true, chats, hasMore };
}