import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { applicant, simasApplication } from "@/db/schema";
import type { ApplicantPortalStore } from "@/lib/applicant-portal";

export const applicantPortalStore: ApplicantPortalStore = {
  async isApplicant(userId) {
    const [row] = await db.select({ userId: applicant.userId }).from(applicant).where(eq(applicant.userId, userId)).limit(1);
    return row !== undefined;
  },
  async listApplications(userId) {
    const rows = await db.select({
      id: simasApplication.id,
      attemptNumber: simasApplication.attemptNumber,
      status: simasApplication.status,
      schoolName: simasApplication.schoolName,
      npsn: simasApplication.npsn,
      educationLevel: simasApplication.educationLevel,
      address: simasApplication.address,
      contactName: simasApplication.contactName,
      contactPosition: simasApplication.contactPosition,
      contactEmail: simasApplication.contactEmail,
      contactWhatsapp: simasApplication.contactWhatsapp,
      needsNote: simasApplication.needsNote,
      submittedAt: simasApplication.submittedAt,
            decidedAt: simasApplication.decidedAt,
            rejectionReason: simasApplication.rejectionReason,
    }).from(simasApplication)
      .where(eq(simasApplication.ownerUserId, userId))
      .orderBy(asc(simasApplication.attemptNumber));

    return rows.flatMap((row) => row.attemptNumber === null ? [] : [{ ...row, attemptNumber: row.attemptNumber }]);
  },
};
