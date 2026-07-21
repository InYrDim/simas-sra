"use server";

import { resolvePublicTenant } from "@/app/apply/[domain]/resolve-tenant";
import type { PpdbSubmissionStatus } from "@/lib/ppdb-submission";
import { createPpdbSubmissionService } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";

export type PpdbStatusActionState =
  | { status: "idle" }
  | { status: "not-found" }
  | { status: "found"; studentName: string; submissionStatus: PpdbSubmissionStatus; score: number | null };

const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore });

export async function checkPpdbStatusAction(
  domain: string,
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
    registrationCode,
    nisn,
    { nisnRequired: tenant.nisnRequired },
  );
  if (!result.ok) return { status: "not-found" };
  return { status: "found", studentName: result.studentName, submissionStatus: result.status, score: result.score };
}
