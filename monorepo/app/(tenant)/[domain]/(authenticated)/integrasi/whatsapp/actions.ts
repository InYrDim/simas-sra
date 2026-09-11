"use server";

import { revalidatePath } from "next/cache";

import { enforceTenantFeatureEnabled, enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import { readOpenWaAdminApiKey, readOpenWaGlobalBaseUrl, readOpenWaWebhookUrl } from "@/lib/integrations/whatsapp-bot/openwa-config";
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
import {
  markWhatsAppBotRequestFulfilled,
  submitWhatsAppBotRequest,
  type SubmitWhatsAppBotRequestInput,
  type SubmitWhatsAppBotRequestResult,
  type WhatsAppBotRequestDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request";
import {
  createWhatsAppBotRequest,
  readLatestWhatsAppBotRequest,
  readWhatsAppBotRequestById,
  updateWhatsAppBotRequest,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";
import {
  completeWhatsAppBotSelfService,
  readSelfServiceQr,
  readSelfServiceSessionStatus,
  startWhatsAppBotSelfService,
  type CompleteWhatsAppBotSelfServiceResult,
  type SelfServiceQrResult,
  type SelfServiceSessionStatusResult,
  type StartWhatsAppBotSelfServiceResult,
  type WhatsAppBotSelfServiceDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-self-service";
import { resolveTenantOpenWaCredential, upsertTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
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

function requestDependencies(): WhatsAppBotRequestDependencies {
  return {
    readLatestRequest: readLatestWhatsAppBotRequest,
    readConnection: readConnectionByTenantId,
    createRequest: createWhatsAppBotRequest,
    readRequestById: readWhatsAppBotRequestById,
    updateRequest: updateWhatsAppBotRequest,
  };
}

function selfServiceDependencies(): WhatsAppBotSelfServiceDependencies {
  return {
    readLatestRequest: readLatestWhatsAppBotRequest,
    updateRequest: updateWhatsAppBotRequest,
    createClient: (config) => new OpenWaClient({ config }),
    adminApiBaseUrl: readOpenWaGlobalBaseUrl(),
    adminApiKey: readOpenWaAdminApiKey(),
    upsertCredential: upsertTenantOpenWaCredential,
    connect: (d, tenantId) => connectWhatsAppBot(connectionDependencies(), d, tenantId),
    markFulfilled: (requestId, actorId, method) =>
      markWhatsAppBotRequestFulfilled(requestDependencies(), requestId, actorId, method),
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

export async function submitWhatsAppBotRequestAction(
  domain: string,
  input: SubmitWhatsAppBotRequestInput,
): Promise<SubmitWhatsAppBotRequestResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.update");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  const result = await submitWhatsAppBotRequest(requestDependencies(), principal.tenantId, input);
  if (result.ok) {
    revalidate(domain);
  }
  return result;
}

export async function startWhatsAppBotSelfServiceAction(
  domain: string,
): Promise<StartWhatsAppBotSelfServiceResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.update");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  const result = await startWhatsAppBotSelfService(selfServiceDependencies(), principal.tenantId, domain);
  if (result.ok) {
    revalidate(domain);
  }
  return result;
}

export async function refreshWhatsAppBotSelfServiceQrAction(
  domain: string,
): Promise<SelfServiceQrResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.load");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  return readSelfServiceQr(selfServiceDependencies(), principal.tenantId);
}

export async function readWhatsAppBotSelfServiceStatusAction(
  domain: string,
): Promise<SelfServiceSessionStatusResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.load");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  return readSelfServiceSessionStatus(selfServiceDependencies(), principal.tenantId);
}

export async function completeWhatsAppBotSelfServiceAction(
  domain: string,
): Promise<CompleteWhatsAppBotSelfServiceResult> {
  const principal = await enforceTenantOperation(domain, "integrasi.whatsapp-bot.update");
  await enforceTenantFeatureEnabled(domain, "integrasi");
  const result = await completeWhatsAppBotSelfService(
    selfServiceDependencies(),
    principal.tenantId,
    domain,
    principal.userId,
  );
  if (result.ok) {
    revalidate(domain);
  }
  return result;
}