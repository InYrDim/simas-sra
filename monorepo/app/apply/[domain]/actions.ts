"use server";

import { resolvePublicTenantId } from "@/app/apply/[domain]/resolve-tenant";
import { findPublicPpdbSession } from "@/lib/ppdb-session-data";
import { createPpdbSubmissionService } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";

export type PpdbApplicationActionState =
  | { status: "idle" }
  | { status: "closed" }
  | { status: "error"; message: string }
  | { status: "success"; registrationCode: string };

const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore });

export async function submitPpdbApplicationAction(
  domain: string,
  _previousState: PpdbApplicationActionState,
  formData: FormData,
): Promise<PpdbApplicationActionState> {
  // Tenant dan Sesi selalu diresolusi ulang di server — tidak pernah percaya tenantId/sessionId dari klien.
  const tenantId = await resolvePublicTenantId(domain);
  if (!tenantId) return { status: "error", message: "Sekolah tidak ditemukan." };

  const session = await findPublicPpdbSession(tenantId);
  if (!session) return { status: "closed" };

  const studentName = String(formData.get("studentName") ?? "");
  const nisn = String(formData.get("nisn") ?? "");
  const dynamicFormData: Record<string, unknown> = {};
  for (const field of session.fields) {
    const raw = formData.get(field.id);
    // Penyimpanan berkas sesungguhnya belum tersedia; untuk field bertipe "file" hanya nama berkasnya yang disimpan (placeholder).
    dynamicFormData[field.id] = raw instanceof File ? raw.name : raw;
  }

  const result = await submissionService.submit(tenantId, session.id, { studentName, nisn, formData: dynamicFormData });
  if (!result.ok) {
    if (result.code === "session-not-open") return { status: "closed" };
    if (result.code === "invalid-input") return { status: "error", message: "Data belum lengkap atau belum valid. Periksa kembali seluruh isian Anda." };
    return { status: "error", message: "Kode pendaftaran sedang penuh. Silakan coba kirim ulang." };
  }
  return { status: "success", registrationCode: result.registrationCode };
}
