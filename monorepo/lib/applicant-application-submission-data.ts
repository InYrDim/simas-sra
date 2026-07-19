import { eq, max } from "drizzle-orm";

import { db } from "@/db";
import { applicant, applicantSchoolBinding, simasApplication } from "@/db/schema";
import type { ApplicantApplicationSubmissionStore } from "@/lib/applicant-application-submission";

export const applicantApplicationSubmissionStore: ApplicantApplicationSubmissionStore = {
  transaction(work) {
    return db.transaction((tx) => work({
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
      async nextAttemptNumber(bindingId) {
        const [row] = await tx.select({ value: max(simasApplication.attemptNumber) }).from(simasApplication).where(eq(simasApplication.bindingId, bindingId));
        return (row?.value ?? 0) + 1;
      },
      async createApplication(application) {
        await tx.insert(simasApplication).values(application);
      },
    }));
  },
};
