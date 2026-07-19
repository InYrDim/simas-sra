import { and, eq, max } from "drizzle-orm";

import { db } from "@/db";
import { applicant, applicantSchoolBinding, simasApplication } from "@/db/schema";
import {
  SubmissionConflict,
  type ApplicantApplicationSubmissionStore,
} from "@/lib/applicant-application-submission";

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  return `${error.message} ${cause ? errorDetails(cause) : ""}`;
}

function classifyConstraintError(error: unknown): never {
  const message = errorDetails(error);
  if (message.includes("applicant_school_binding_canonical_npsn_unique")) {
    throw new SubmissionConflict("npsn-conflict");
  }
  if (message.includes("applicant_school_binding_user_id_unique")) {
    throw new SubmissionConflict("binding-conflict");
  }
  if (message.includes("simas_application_owner_idempotency_unique")) {
    throw new SubmissionConflict("idempotency-conflict");
  }
  if (message.includes("simas_application_pending_binding_unique")) {
    throw new SubmissionConflict("existing-pending");
  }
  throw error;
}

export const applicantApplicationSubmissionStore: ApplicantApplicationSubmissionStore = {
  async transaction(work) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await db.transaction((tx) => work({
        async lockApplicant(userId) {
          const [row] = await tx.select({ userId: applicant.userId }).from(applicant).where(eq(applicant.userId, userId)).limit(1).for("update");
          return row !== undefined;
        },
        async getBinding(userId) {
          const [row] = await tx.select({ id: applicantSchoolBinding.id, canonicalNpsn: applicantSchoolBinding.canonicalNpsn }).from(applicantSchoolBinding).where(eq(applicantSchoolBinding.userId, userId)).limit(1).for("update");
          return row ?? null;
        },
        async createBinding(binding) {
          await tx.insert(applicantSchoolBinding).values(binding);
        },
        async findByIdempotencyKey(userId, idempotencyKey) {
          const [row] = await tx.select({ id: simasApplication.id, payloadHash: simasApplication.payloadHash })
            .from(simasApplication)
            .where(and(eq(simasApplication.ownerUserId, userId), eq(simasApplication.idempotencyKey, idempotencyKey)))
            .limit(1);
          return row?.payloadHash ? { ...row, payloadHash: row.payloadHash } : null;
        },
        async findPending(bindingId) {
          const [row] = await tx.select({ id: simasApplication.id, payloadHash: simasApplication.payloadHash })
            .from(simasApplication)
            .where(and(eq(simasApplication.bindingId, bindingId), eq(simasApplication.status, "pending")))
            .limit(1)
            .for("update");
          return row?.payloadHash ? { ...row, payloadHash: row.payloadHash } : null;
        },
        async nextAttemptNumber(bindingId) {
          const [row] = await tx.select({ value: max(simasApplication.attemptNumber) }).from(simasApplication).where(eq(simasApplication.bindingId, bindingId));
          return (row?.value ?? 0) + 1;
        },
        async createApplication(application) {
          await tx.insert(simasApplication).values(application);
        },
        }));
      } catch (error) {
        if (errorDetails(error).includes("Deadlock found") && attempt < 2) continue;
        classifyConstraintError(error);
      }
    }
  },
};
