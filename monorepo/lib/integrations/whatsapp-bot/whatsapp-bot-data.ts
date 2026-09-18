import { randomUUID } from "node:crypto";

import { desc, eq, or, and, sql } from "drizzle-orm";

import { db } from "@/db";
import { whatsappBotConnection, whatsappBotMessage } from "@/db/schema";

export type WhatsAppBotConnectionStatus = "connected" | "error";

export type WhatsAppBotConnectionRecord = {
  tenantId: string;
  openwaSessionId: string;
  openwaSessionName: string;
  openwaWebhookId: string;
  status: WhatsAppBotConnectionStatus;
  botPhone: string | null;
  botPushName: string | null;
  lastError: string | null;
};

const connectionColumns = {
  tenantId: whatsappBotConnection.tenantId,
  openwaSessionId: whatsappBotConnection.openwaSessionId,
  openwaSessionName: whatsappBotConnection.openwaSessionName,
  openwaWebhookId: whatsappBotConnection.openwaWebhookId,
  status: whatsappBotConnection.status,
  botPhone: whatsappBotConnection.botPhone,
  botPushName: whatsappBotConnection.botPushName,
  lastError: whatsappBotConnection.lastError,
  createdAt: whatsappBotConnection.createdAt,
  updatedAt: whatsappBotConnection.updatedAt,
};

const messageColumns = {
  id: whatsappBotMessage.id,
  tenantId: whatsappBotMessage.tenantId,
  openwaMessageId: whatsappBotMessage.openwaMessageId,
  idempotencyKey: whatsappBotMessage.idempotencyKey,
  event: whatsappBotMessage.event,
  direction: whatsappBotMessage.direction,
  chatId: whatsappBotMessage.chatId,
  fromWa: whatsappBotMessage.fromWa,
  toWa: whatsappBotMessage.toWa,
  body: whatsappBotMessage.body,
  messageType: whatsappBotMessage.messageType,
  hasMedia: whatsappBotMessage.hasMedia,
  isGroup: whatsappBotMessage.isGroup,
  kind: whatsappBotMessage.kind,
  metadata: whatsappBotMessage.metadata,
  messageTimestamp: whatsappBotMessage.messageTimestamp,
  receivedAt: whatsappBotMessage.receivedAt,
  sentAt: whatsappBotMessage.sentAt,
  deliveryStatus: whatsappBotMessage.deliveryStatus,
};

export type WhatsAppBotMessageRecord = {
  id: string;
  tenantId: string;
  openwaMessageId: string;
  idempotencyKey: string;
  event: string;
  direction: "inbound" | "outbound";
  chatId: string;
  fromWa: string;
  toWa: string | null;
  body: string | null;
  messageType: string | null;
  hasMedia: boolean;
  isGroup: boolean;
  kind: string | null;
  metadata: Record<string, unknown> | null;
  messageTimestamp: number | null;
  receivedAt: Date;
  sentAt: Date | null;
  deliveryStatus: string | null;
};

export async function readConnectionByTenantId(tenantId: string) {
  const rows = await db
    .select(connectionColumns)
    .from(whatsappBotConnection)
    .where(eq(whatsappBotConnection.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function readConnectionBySessionKey(sessionKey: string) {
  const rows = await db
    .select(connectionColumns)
    .from(whatsappBotConnection)
    .where(or(
      eq(whatsappBotConnection.openwaSessionId, sessionKey),
      eq(whatsappBotConnection.openwaSessionName, sessionKey),
    ))
    .limit(2);
  return rows[0] ?? null;
}

export async function upsertConnection(record: WhatsAppBotConnectionRecord) {
  await db
    .insert(whatsappBotConnection)
    .values({
      tenantId: record.tenantId,
      openwaSessionId: record.openwaSessionId,
      openwaSessionName: record.openwaSessionName,
      openwaWebhookId: record.openwaWebhookId,
      status: record.status,
      botPhone: record.botPhone,
      botPushName: record.botPushName,
      lastError: record.lastError,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [whatsappBotConnection.tenantId],
      set: {
        openwaSessionId: record.openwaSessionId,
        openwaSessionName: record.openwaSessionName,
        openwaWebhookId: record.openwaWebhookId,
        status: record.status,
        botPhone: record.botPhone,
        botPushName: record.botPushName,
        lastError: record.lastError,
        updatedAt: sql`now(3)`,
      },
    });
}

export async function removeConnection(tenantId: string) {
  await db.delete(whatsappBotConnection).where(eq(whatsappBotConnection.tenantId, tenantId));
}

export type InboundMessageRecord = Omit<WhatsAppBotMessageRecord, "id" | "sentAt" | "deliveryStatus">;

export async function recordInboundMessage(message: InboundMessageRecord) {
  await db
    .insert(whatsappBotMessage)
    .values({
      id: randomUUID(),
      tenantId: message.tenantId,
      openwaMessageId: message.openwaMessageId,
      idempotencyKey: message.idempotencyKey,
      event: message.event,
      direction: message.direction,
      chatId: message.chatId,
      fromWa: message.fromWa,
      toWa: message.toWa,
      body: message.body,
      messageType: message.messageType,
      hasMedia: message.hasMedia,
      isGroup: message.isGroup,
      kind: message.kind,
      metadata: message.metadata,
      messageTimestamp: message.messageTimestamp,
      receivedAt: message.receivedAt,
      sentAt: null,
      deliveryStatus: null,
    })
    .onConflictDoUpdate({
      target: [whatsappBotMessage.tenantId, whatsappBotMessage.idempotencyKey],
      set: { id: sql`${whatsappBotMessage.id}` },
    });
}

export type OutboundMessageRecord = {
  tenantId: string;
  openwaMessageId: string;
  idempotencyKey: string;
  event: string;
  chatId: string;
  fromWa: string;
  toWa: string | null;
  body: string | null;
  messageType: string | null;
  hasMedia: boolean;
  isGroup: boolean;
  kind: string | null;
  metadata: Record<string, unknown> | null;
  messageTimestamp: number | null;
  sentAt: Date;
  deliveryStatus: string;
};

export async function recordOutboundMessage(message: OutboundMessageRecord) {
  await db.insert(whatsappBotMessage).values({
    id: randomUUID(),
    tenantId: message.tenantId,
    openwaMessageId: message.openwaMessageId,
    idempotencyKey: message.idempotencyKey,
    event: message.event,
    direction: "outbound",
    chatId: message.chatId,
    fromWa: message.fromWa,
    toWa: message.toWa,
    body: message.body,
    messageType: message.messageType,
    hasMedia: message.hasMedia,
    isGroup: message.isGroup,
    kind: message.kind,
    metadata: message.metadata,
    messageTimestamp: message.messageTimestamp,
    receivedAt: message.sentAt,
    sentAt: message.sentAt,
    deliveryStatus: message.deliveryStatus,
  });
}

export type WhatsAppBotChatSummary = {
  chatId: string;
  lastDirection: "inbound" | "outbound";
  lastBody: string | null;
  lastAt: Date;
};

export async function listChatSummaries(tenantId: string, limit = 100): Promise<WhatsAppBotChatSummary[]> {
  const recent = await db
    .select(messageColumns)
    .from(whatsappBotMessage)
    .where(eq(whatsappBotMessage.tenantId, tenantId))
    .orderBy(desc(whatsappBotMessage.receivedAt))
    .limit(2000);

  const summaries = new Map<string, WhatsAppBotChatSummary>();
  for (const row of recent) {
    if (!row.chatId || summaries.has(row.chatId)) continue;
    summaries.set(row.chatId, {
      chatId: row.chatId,
      lastDirection: row.direction,
      lastBody: row.body,
      lastAt: row.receivedAt,
    });
  }
  return [...summaries.values()]
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, limit);
}

export async function listMessagesByChat(tenantId: string, chatId: string, limit = 50) {
  return db
    .select(messageColumns)
    .from(whatsappBotMessage)
    .where(and(
      eq(whatsappBotMessage.tenantId, tenantId),
      eq(whatsappBotMessage.chatId, chatId),
    ))
    .orderBy(desc(whatsappBotMessage.receivedAt))
    .limit(limit);
}

export async function listRecentMessages(tenantId: string, limit = 50) {
  return db
    .select(messageColumns)
    .from(whatsappBotMessage)
    .where(eq(whatsappBotMessage.tenantId, tenantId))
    .orderBy(desc(whatsappBotMessage.receivedAt))
    .limit(limit);
}