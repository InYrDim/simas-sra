import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { ppdbSession, ppdbSubmission, ppdbSubmissionDocument, tenant } from "@/db/schema";
import type { PpdbFormField } from "@/lib/ppdb-session";
import type { PpdbSubmission, PpdbSubmissionStore } from "@/lib/ppdb-submission";

function toSubmission(
  record: typeof ppdbSubmission.$inferSelect,
  documents: PpdbSubmission["documents"] = [],
): PpdbSubmission {
  return {
    id: record.id,
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    registrationCode: record.registrationCode,
    studentName: record.studentName,
    nisn: record.nisn,
    status: record.status,
    score: record.score,
    formFields: (record.formFields as PpdbFormField[] | null) ?? [],
    formData: (record.formData as Record<string, unknown> | null) ?? {},
    documents,
    version: record.version,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
  };
}

export const ppdbSubmissionStore: PpdbSubmissionStore = {
  async findPublishedSession(tenantId, sessionId) {
    const [session] = await db
      .select({ id: ppdbSession.id, fields: ppdbSession.fields })
      .from(ppdbSession)
      .where(and(eq(ppdbSession.tenantId, tenantId), eq(ppdbSession.id, sessionId), eq(ppdbSession.status, "published")))
      .limit(1);
    if (!session) return null;
    return { id: session.id, fields: (session.fields as PpdbFormField[] | null) ?? [] };
  },

  async createSubmission(submission, documents = []) {
    try {
      await db.transaction(async (tx) => {
        await tx.insert(ppdbSubmission).values({
        id: submission.id,
        tenantId: submission.tenantId,
        sessionId: submission.sessionId,
        registrationCode: submission.registrationCode,
        studentName: submission.studentName,
        nisn: submission.nisn,
        status: submission.status,
        score: submission.score,
        formFields: submission.formFields,
        formData: submission.formData,
        version: submission.version,
        submittedAt: submission.submittedAt,
          updatedAt: submission.updatedAt,
        });
        if (documents.length) {
          await tx.insert(ppdbSubmissionDocument).values([...documents]);
        }
      });
      return { ok: true } as const;
    } catch (error) {
      if ((error as { errno?: number }).errno === 1062) return { ok: false, code: "duplicate-code" } as const;
      throw error;
    }
  },

  async findByRegistrationCode(tenantId, registrationCode) {
    const [record] = await db
      .select()
      .from(ppdbSubmission)
      .where(and(eq(ppdbSubmission.tenantId, tenantId), eq(ppdbSubmission.registrationCode, registrationCode)))
      .limit(1);
    return record ? toSubmission(record) : null;
  },

  async findPublicResultContext(tenantId, sessionId, registrationCode) {
    const [record] = await db
      .select({
        studentName: ppdbSubmission.studentName,
        nisn: ppdbSubmission.nisn,
        status: ppdbSubmission.status,
        score: ppdbSubmission.score,
        resultsPublishedAt: ppdbSession.resultsPublishedAt,
        acceptedFeedback: ppdbSession.acceptedFeedback,
        acceptedNextSteps: ppdbSession.acceptedNextSteps,
        rejectedFeedback: ppdbSession.rejectedFeedback,
        rejectedNextSteps: ppdbSession.rejectedNextSteps,
        whatsappGroupUrl: ppdbSession.whatsappGroupUrl,
      })
      .from(ppdbSubmission)
      .innerJoin(ppdbSession, and(
        eq(ppdbSession.tenantId, ppdbSubmission.tenantId),
        eq(ppdbSession.id, ppdbSubmission.sessionId),
      ))
      .where(and(
        eq(ppdbSubmission.tenantId, tenantId),
        eq(ppdbSubmission.sessionId, sessionId),
        eq(ppdbSubmission.registrationCode, registrationCode),
      ))
      .limit(1);
    if (!record) return null;
    return {
      ...record,
      acceptedFeedback: record.acceptedFeedback ?? "",
      acceptedNextSteps: record.acceptedNextSteps ?? "",
      rejectedFeedback: record.rejectedFeedback ?? "",
      rejectedNextSteps: record.rejectedNextSteps ?? "",
    };
  },



  async findById(tenantId, submissionId) {
    const [record] = await db
      .select()
      .from(ppdbSubmission)
      .where(and(eq(ppdbSubmission.tenantId, tenantId), eq(ppdbSubmission.id, submissionId)))
      .limit(1);
    return record ? toSubmission(record) : null;
  },

  async list(tenantId, sessionId) {
    const records = await db
      .select()
      .from(ppdbSubmission)
      .where(sessionId ? and(eq(ppdbSubmission.tenantId, tenantId), eq(ppdbSubmission.sessionId, sessionId)) : eq(ppdbSubmission.tenantId, tenantId))
      .orderBy(desc(ppdbSubmission.submittedAt));
    if (!records.length) return [];
    const documents = await db
      .select()
      .from(ppdbSubmissionDocument)
      .where(and(
        eq(ppdbSubmissionDocument.tenantId, tenantId),
        inArray(ppdbSubmissionDocument.submissionId, records.map((record) => record.id)),
      ));
    return records.map((record) => toSubmission(
      record,
      documents.filter((document) => document.submissionId === record.id),
    ));
  },

  async findDocument(tenantId, submissionId, documentId) {
    const [document] = await db
      .select()
      .from(ppdbSubmissionDocument)
      .where(and(
        eq(ppdbSubmissionDocument.tenantId, tenantId),
        eq(ppdbSubmissionDocument.submissionId, submissionId),
        eq(ppdbSubmissionDocument.id, documentId),
      ))
      .limit(1);
    return document ?? null;
  },

  applyDecision(tenantId, submissionId, expectedVersion, patch) {
    return db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      const [submission] = await transaction
        .select({ sessionId: ppdbSubmission.sessionId })
        .from(ppdbSubmission)
        .where(and(eq(ppdbSubmission.tenantId, tenantId), eq(ppdbSubmission.id, submissionId)))
        .limit(1);
      if (!submission) return "conflict";
      const [session] = await transaction
        .select({ resultsPublishedAt: ppdbSession.resultsPublishedAt })
        .from(ppdbSession)
        .where(and(eq(ppdbSession.tenantId, tenantId), eq(ppdbSession.id, submission.sessionId)))
        .limit(1);
      if (session?.resultsPublishedAt) return "results-published";
      const result = await transaction
        .update(ppdbSubmission)
        .set({ status: patch.status, score: patch.score, version: expectedVersion + 1, updatedAt: patch.updatedAt })
        .where(and(eq(ppdbSubmission.tenantId, tenantId), eq(ppdbSubmission.id, submissionId), eq(ppdbSubmission.version, expectedVersion)));
      return result[0].affectedRows === 1 ? "updated" : "conflict";
    });
  },
};
