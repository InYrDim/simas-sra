"use server";

import { revalidatePath } from "next/cache";

import { enforceTenantFeatureEnabled, enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import { readOpenWaWebhookUrl } from "@/lib/integrations/whatsapp-bot/openwa-config";
import { deriveOpenWaWebhookSecret } from "@/lib/integrations/whatsapp-bot/openwa-webhook-secret";
import { connectWhatsAppBot, disconnectWhatsAppBot } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import {
  readConnectionBySessionKey,
  readConnectionByTenantId,
  recordOutboundMessage,
  removeConnection,
  upsertConnection,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { resolveTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
import type {
  ConnectWhatsAppBotResult,
  DisconnectWhatsAppBotResult,
  WhatsAppBotConnectionDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import type { SendWhatsAppTextResult, WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";

function revalidate(d: string) {
  revalidatePath(`/${d}/integrasi/whatsapp`);
  revalidatePath(`/${d}/integrasi`);
}

function connectionDependencies(): WhatsAppBotConnectionDependencies {
  return {
    resolveCredential: resolveTenantOpenWaCredential,
    createClient: (config) => new OpenWaClient({ config }),
    readConnectionBySessionKey,
    readConnectionByTenantId,
    upsertConnection,
    removeConnection,
    webhookUrl: readOpenWaWebhookUrl(),
    deriveSecret: deriveOpenWaWebhookSecret,
    revalidate,
  };
}

export async function connectWhatsAppBotAction(domain: string): Promise<ConnectWhatsAppBotResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.update");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  return connectWhatsAppBot(connectionDependencies(), domain, principal.tenantId);
}

export async function disconnectWhatsAppBotAction(
  domain: string,
): Promise<DisconnectWhatsAppBotResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.update");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  return disconnectWhatsAppBot(connectionDependencies(), domain, principal.tenantId);
}

function sendDependencies(): WhatsAppBotSendDependencies {
  return {
    resolveCredential: resolveTenantOpenWaCredential,
    createClient: (config) => new OpenWaClient({ config }),
    readConnectionByTenantId,
    recordOutboundMessage,
  };
}

export async function sendWhatsAppMessageAction(
  domain: string,
  input: { chatId: string; text: string },
): Promise<SendWhatsAppTextResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.send");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  const result = await sendWhatsAppText(sendDependencies(), principal.tenantId, input);
  if (result.ok) {
    revalidate(domain);
  }
  return result;
}