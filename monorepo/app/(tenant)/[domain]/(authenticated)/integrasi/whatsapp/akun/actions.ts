"use server";

import { enforceTenantFeatureEnabled, enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import {
  listWhatsAppBotChats,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-chats";
import type {
  ListWhatsAppBotChatsResult,
  WhatsAppBotChatsDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-chats";
import { readConnectionByTenantId } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import { resolveTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

function chatsDependencies(): WhatsAppBotChatsDependencies {
  return {
    resolveCredential: resolveTenantOpenWaCredential,
    createClient: (config) => new OpenWaClient({ config }),
    readConnectionByTenantId,
  };
}

export async function listWhatsAppBotChatsAction(
  domain: string,
  input: { offset: number; limit: number },
): Promise<ListWhatsAppBotChatsResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.load");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  return listWhatsAppBotChats(chatsDependencies(), principal.tenantId, input);
}