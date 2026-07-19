import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { applicant, applicantSchoolBinding, simasApplication } from "@/db/schema";
import type { ApplicationDecisionStore } from "@/lib/provider-applications";

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  return `${error.message} ${cause ? errorDetails(cause) : ""}`;
}

export const applicationDecisionStore: ApplicationDecisionStore = {
  async transaction(work) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await db.transaction(async (tx) => work({
          async lock(applicationId) {
            const [scope] = await tx
              .select({ bindingId: simasApplication.bindingId, ownerUserId: simasApplication.ownerUserId })
              .from(simasApplication)
              .where(eq(simasApplication.id, applicationId))
              .limit(1);
            if (!scope?.bindingId || !scope.ownerUserId) return null;

            const [binding] = await tx
              .select({ id: applicantSchoolBinding.id })
              .from(applicantSchoolBinding)
              .where(eq(applicantSchoolBinding.id, scope.bindingId))
              .limit(1)
              .for("update");
            if (!binding) return null;

            const [application] = await tx
              .select({
                id: simasApplication.id,
                status: simasApplication.status,
                decidedByProviderAdminId: simasApplication.decidedByProviderAdminId,
                rejectionReason: simasApplication.rejectionReason,
                bindingId: simasApplication.bindingId,
                ownerUserId: simasApplication.ownerUserId,
              })
              .from(simasApplication)
              .where(eq(simasApplication.id, applicationId))
              .limit(1)
              .for("update");
            if (!application
              || application.bindingId !== scope.bindingId
              || application.ownerUserId !== scope.ownerUserId) return null;

            const [owner] = await tx
              .select({ userId: applicant.userId })
              .from(applicant)
              .where(eq(applicant.userId, scope.ownerUserId))
              .limit(1)
              .for("update");
            if (!owner) return null;
            return application;
          },
          async reject(decision) {
            const result = await tx
              .update(simasApplication)
              .set({
                status: "rejected",
                decidedAt: decision.decidedAt,
                decidedByProviderAdminId: decision.providerAdminId,
                rejectionReason: decision.reason,
              })
              .where(and(
                eq(simasApplication.id, decision.applicationId),
                eq(simasApplication.status, "pending"),
              ));
            return result[0].affectedRows === 1;
          },
        }));
      } catch (error) {
        if (errorDetails(error).includes("Deadlock found") && attempt < 2) continue;
        throw error;
      }
    }
  },
};
