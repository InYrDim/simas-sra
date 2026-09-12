import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { academicOperationPreview } from "@/db/schema";
import type { AcademicPreviewRecord, AcademicPreviewStore } from "@/lib/academic/academic-preview";

function record(row: typeof academicOperationPreview.$inferSelect): AcademicPreviewRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    operationId: row.operationId,
    tokenDigest: row.tokenDigest,
    intentDigest: row.intentDigest,
    normalizedIntent: row.normalizedIntent as Readonly<Record<string, unknown>>,
    state: row.state,
    expiresAt: row.expiresAt.getTime(),
    idempotencyKey: row.idempotencyKey,
    outcome: row.outcome,
    version: row.version,
  };
}

export const academicPreviewStore: AcademicPreviewStore = {
  async insert(preview) {
    await db.insert(academicOperationPreview).values({
      id: preview.id,
      tenantId: preview.tenantId,
      actorUserId: preview.actorUserId,
      operationId: preview.operationId,
      tokenDigest: preview.tokenDigest,
      intentDigest: preview.intentDigest,
      normalizedIntent: preview.normalizedIntent,
      state: preview.state,
      expiresAt: new Date(preview.expiresAt),
      idempotencyKey: preview.idempotencyKey,
      outcome: preview.outcome,
    });
  },
  async findByTokenDigest(tokenDigest) {
    const [row] = await db.select().from(academicOperationPreview).where(eq(academicOperationPreview.tokenDigest, tokenDigest)).limit(1);
    return row ? record(row) : null;
  },
  async update(id, expectedVersion, patch) {
    const updated = await db.update(academicOperationPreview).set({
      ...(patch.state === undefined ? {} : { state: patch.state }),
      ...(patch.idempotencyKey === undefined ? {} : { idempotencyKey: patch.idempotencyKey }),
      ...(patch.outcome === undefined ? {} : { outcome: patch.outcome }),
      ...(patch.expiresAt === undefined ? {} : { expiresAt: new Date(patch.expiresAt) }),
      ...(patch.version === undefined ? {} : { version: patch.version }),
      ...(patch.state === "committed" ? { committedAt: new Date() } : {}),
      ...(patch.state === "invalidated" || patch.state === "expired" ? { invalidatedAt: new Date() } : {}),
    }).where(and(eq(academicOperationPreview.id, id), eq(academicOperationPreview.version, expectedVersion), ...(patch.idempotencyKey === undefined ? [] : [isNull(academicOperationPreview.idempotencyKey)])));
    return updated[0].affectedRows === 1;
  },
};
