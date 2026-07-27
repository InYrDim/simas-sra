"use server";

import { resolvePublicTenant } from "@/app/ppdb/[domain]/resolve-tenant";
import type { PpdbSubmissionStatus } from "@/lib/ppdb-submission";
import { createPpdbSubmissionService } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";

export type PpdbStatusActionState =
  | { status: "idle" }
  | { status: "not-found" }
  | { status: "found"; studentName: string; publicationStatus: "unpublished" }
  | {
      status: "found";
      studentName: string;
      publicationStatus: "published";
      submissionStatus: PpdbSubmissionStatus;
      score: number | null;
      feedback: string;
      nextSteps: string;
      whatsappGroupUrl: string | null;
    };

const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore });

export async function checkPpdbStatusAction(
  domain: string,
  sessionId: string,
  _previousState: PpdbStatusActionState,
  formData: FormData,
): Promise<PpdbStatusActionState> {
  const tenant = await resolvePublicTenant(domain);
  const registrationCode = String(formData.get("registrationCode") ?? "");
  const nisn = String(formData.get("nisn") ?? "");
  // "not-found" tetap dipakai baik saat Tenant tidak ditemukan maupun saat kode/NISN tidak cocok — sengaja tidak dibedakan
  // agar tidak membocorkan validitas suatu Kode Pendaftaran.
  if (!tenant) return { status: "not-found" };

  const result = await submissionService.checkStatus(
    tenant.id,
    sessionId,
    registrationCode,
    nisn,
    { nisnRequired: tenant.nisnRequired },
  );
  if (!result.ok) return { status: "not-found" };
  if (result.publicationStatus === "unpublished") {
    return { status: "found", studentName: result.studentName, publicationStatus: "unpublished" };
  }
  return {
    status: "found",
    studentName: result.studentName,
    publicationStatus: "published",
    submissionStatus: result.status,
    score: result.score,
    feedback: result.feedback,
    nextSteps: result.nextSteps,
    whatsappGroupUrl: result.whatsappGroupUrl,
  };
}
