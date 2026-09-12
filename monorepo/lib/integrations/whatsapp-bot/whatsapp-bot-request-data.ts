import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  tenant,
  whatsappBotRequest,
  type WhatsAppBotRequestStatus,
} from "@/db/schema";

export type WhatsAppBotRequestResolutionMethod = "self_service" | "provider";

export type WhatsAppBotRequestRecord = {
  id: string;
  tenantId: string;
  requestedPhone: string;
  desiredSessionName: string | null;
  picName: string;
  note: string | null;
  status: WhatsAppBotRequestStatus;
  providerNote: string | null;
  resolutionMethod: WhatsAppBotRequestResolutionMethod | null;
  openwaSessionId: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const requestColumns = {
  id: whatsappBotRequest.id,
  tenantId: whatsappBotRequest.tenantId,
  requestedPhone: whatsappBotRequest.requestedPhone,
  desiredSessionName: whatsappBotRequest.desiredSessionName,
  picName: whatsappBotRequest.picName,
  note: whatsappBotRequest.note,
  status: whatsappBotRequest.status,
  providerNote: whatsappBotRequest.providerNote,
  resolutionMethod: whatsappBotRequest.resolutionMethod,
  openwaSessionId: whatsappBotRequest.openwaSessionId,
  resolvedAt: whatsappBotRequest.resolvedAt,
  resolvedBy: whatsappBotRequest.resolvedBy,
  createdAt: whatsappBotRequest.createdAt,
  updatedAt: whatsappBotRequest.updatedAt,
} as const;

export type WhatsAppBotRequestInsert = Omit<
  WhatsAppBotRequestRecord,
  "status" | "providerNote" | "resolutionMethod" | "openwaSessionId" | "resolvedAt" | "resolvedBy" | "createdAt" | "updatedAt"
>;

export type WhatsAppBotRequestChanges = Partial<
  Pick<
    WhatsAppBotRequestRecord,
    | "status"
    | "providerNote"
    | "resolutionMethod"
    | "openwaSessionId"
    | "resolvedAt"
    | "resolvedBy"
  >
>;

export async function createWhatsAppBotRequest(input: WhatsAppBotRequestInsert): Promise<void> {
  await db.insert(whatsappBotRequest).values({
    id: input.id,
    tenantId: input.tenantId,
    requestedPhone: input.requestedPhone,
    desiredSessionName: input.desiredSessionName,
    picName: input.picName,
    note: input.note,
    status: "pending",
    providerNote: null,
    resolutionMethod: null,
    openwaSessionId: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function readLatestWhatsAppBotRequest(tenantId: string) {
  const rows = await db
    .select(requestColumns)
    .from(whatsappBotRequest)
    .where(eq(whatsappBotRequest.tenantId, tenantId))
    .orderBy(desc(whatsappBotRequest.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function readWhatsAppBotRequestById(id: string) {
  const rows = await db
    .select(requestColumns)
    .from(whatsappBotRequest)
    .where(eq(whatsappBotRequest.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type WhatsAppBotRequestRow = WhatsAppBotRequestRecord & {
  tenantName: string;
  tenantNpsn: string;
  tenantDomain: string;
};

export async function listWhatsAppBotRequestsForProvider(
  options?: Readonly<{ status?: WhatsAppBotRequestStatus; tenantId?: string }>,
): Promise<WhatsAppBotRequestRow[]> {
  const where = options
    ? and(
        ...(options.tenantId ? [eq(whatsappBotRequest.tenantId, options.tenantId)] : []),
        ...(options.status ? [eq(whatsappBotRequest.status, options.status)] : []),
      )
    : undefined;
  const rows = await db
    .select({
      ...requestColumns,
      tenantName: tenant.name,
      tenantNpsn: tenant.npsn,
      tenantDomain: tenant.domain,
    })
    .from(whatsappBotRequest)
    .innerJoin(tenant, eq(whatsappBotRequest.tenantId, tenant.id))
    .where(where)
    .orderBy(desc(whatsappBotRequest.createdAt));
  return rows;
}

export async function updateWhatsAppBotRequest(id: string, changes: WhatsAppBotRequestChanges): Promise<void> {
  await db
    .update(whatsappBotRequest)
    .set({
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.providerNote !== undefined ? { providerNote: changes.providerNote } : {}),
      ...(changes.resolutionMethod !== undefined ? { resolutionMethod: changes.resolutionMethod } : {}),
      ...(changes.openwaSessionId !== undefined ? { openwaSessionId: changes.openwaSessionId } : {}),
      ...(changes.resolvedAt !== undefined ? { resolvedAt: changes.resolvedAt } : {}),
      ...(changes.resolvedBy !== undefined ? { resolvedBy: changes.resolvedBy } : {}),
      updatedAt: sql`now(3)`,
    })
    .where(eq(whatsappBotRequest.id, id));
}