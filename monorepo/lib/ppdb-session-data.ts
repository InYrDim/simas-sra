import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ppdbSession, tenant } from "@/db/schema";
import type { PpdbFormField, PpdbSession, PpdbSessionStore } from "@/lib/ppdb-session";

function toSession(record: typeof ppdbSession.$inferSelect): PpdbSession {
  return {
    id: record.id,
    tenantId: record.tenantId,
    academicYearId: record.academicYearId,
    endDate: record.endDate,
    status: record.status,
    fields: (record.fields as PpdbFormField[] | null) ?? [],
    draftFields: (record.draftFields as PpdbFormField[] | null) ?? (record.fields as PpdbFormField[] | null) ?? [],
    version: record.version,
    publishedAt: record.publishedAt,
    endedAt: record.endedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function listWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<PpdbSession[]> {
  const rows = await executor.select().from(ppdbSession).where(eq(ppdbSession.tenantId, tenantId));
  return rows.map(toSession);
}

// Untuk halaman publik /ppdb/[domain]: temukan Sesi PPDB yang sedang "published" bagi satu Tenant, tanpa memerlukan principal.
export async function findPublicPpdbSession(tenantId: string): Promise<Readonly<{ id: string; endDate: string; fields: PpdbFormField[] }> | null> {
  const [session] = await db
    .select({ id: ppdbSession.id, endDate: ppdbSession.endDate, fields: ppdbSession.fields })
    .from(ppdbSession)
    .where(and(eq(ppdbSession.tenantId, tenantId), eq(ppdbSession.status, "published")))
    .limit(1);
  if (!session) return null;
  return { id: session.id, endDate: session.endDate, fields: (session.fields as PpdbFormField[] | null) ?? [] };
}

export const ppdbSessionStore: PpdbSessionStore = {
  list(tenantId) {
    return listWith(db, tenantId);
  },
  transaction(tenantId, work) {
    return db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      return work({
        list: () => listWith(transaction, tenantId),
        async save(session) {
          if (session.tenantId !== tenantId) throw new Error("Cross-Tenant PPDB session write denied");
          const [existing] = await transaction
            .select({ id: ppdbSession.id })
            .from(ppdbSession)
            .where(and(eq(ppdbSession.tenantId, tenantId), eq(ppdbSession.id, session.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(ppdbSession).values({
              id: session.id,
              tenantId,
              academicYearId: session.academicYearId,
              endDate: session.endDate,
              status: session.status,
              fields: session.fields,
              draftFields: session.draftFields,
              version: session.version,
              publishedAt: session.publishedAt,
              endedAt: session.endedAt,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
            });
            return;
          }
          const result = await transaction
            .update(ppdbSession)
            .set({
              academicYearId: session.academicYearId,
              endDate: session.endDate,
              status: session.status,
              fields: session.fields,
              draftFields: session.draftFields,
              version: session.version,
              publishedAt: session.publishedAt,
              endedAt: session.endedAt,
              updatedAt: session.updatedAt,
            })
            .where(and(eq(ppdbSession.tenantId, tenantId), eq(ppdbSession.id, session.id)));
          if (result[0].affectedRows !== 1) throw new Error("PPDB session not found");
        },
      });
    });
  },
};
