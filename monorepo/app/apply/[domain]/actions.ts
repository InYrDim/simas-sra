"use server";

import { resolvePublicTenant } from "@/app/apply/[domain]/resolve-tenant";
import { findPublicPpdbSession } from "@/lib/ppdb-session-data";
import {
  inspectPpdbDocument,
  ppdbDocumentSignatureScanner,
  validatePpdbFileSize,
} from "@/lib/ppdb-file-validation";
import { createProtectedFileStorage } from "@/lib/protected-file-storage";
import { findPpdbIdentityField } from "@/lib/ppdb-session";
import { createPpdbSubmissionService, type PpdbSubmissionDocumentInput } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";

export type PpdbApplicationActionState =
  | { status: "idle" }
  | { status: "closed" }
  | { status: "error"; message: string }
  | { status: "success"; registrationCode: string };

export async function submitPpdbApplicationAction(
  domain: string,
  _previousState: PpdbApplicationActionState,
  formData: FormData,
): Promise<PpdbApplicationActionState> {
  // Tenant dan Sesi selalu diresolusi ulang di server — tidak pernah percaya tenantId/sessionId dari klien.
  const tenant = await resolvePublicTenant(domain);
  if (!tenant) return { status: "error", message: "Sekolah tidak ditemukan." };

  const session = await findPublicPpdbSession(tenant.id);
  if (!session) return { status: "closed" };

  const dynamicFormData: Record<string, unknown> = {};
  const documents: PpdbSubmissionDocumentInput[] = [];
  for (const field of session.fields) {
    const raw = formData.get(field.id);
    if (field.type !== "file") {
      dynamicFormData[field.id] = raw;
      continue;
    }
    if (!(raw instanceof File) || raw.size === 0) continue;
    const sizeError = validatePpdbFileSize(raw.size);
    if (sizeError) return { status: "error", message: sizeError };
    const bytes = new Uint8Array(await raw.arrayBuffer());
    const format = inspectPpdbDocument(bytes);
    if (!format) {
      return { status: "error", message: "File harus berupa PDF, JPG, atau PNG yang valid." };
    }
    documents.push({
      fieldId: field.id,
      originalFileName: raw.name.slice(0, 255),
      mimeType: format.mimeType,
      extension: format.extension,
      bytes,
    });
  }

  const studentNameField = findPpdbIdentityField(session.fields, "studentName");
  const nisnField = findPpdbIdentityField(session.fields, "nisn");
  const studentName = String(studentNameField ? dynamicFormData[studentNameField.id] ?? "" : "");
  const nisn = String(nisnField ? dynamicFormData[nisnField.id] ?? "" : "");

  const storageRoot = process.env.PROTECTED_FILE_STORAGE_ROOT;
  if (documents.length && !storageRoot) {
    return { status: "error", message: "Penyimpanan dokumen belum tersedia. Hubungi sekolah." };
  }
  const submissionService = createPpdbSubmissionService({
    store: ppdbSubmissionStore,
    storage: storageRoot
      ? createProtectedFileStorage(storageRoot, { scanner: ppdbDocumentSignatureScanner })
      : undefined,
  });
  try {
    const result = await submissionService.submit(
      tenant.id,
      session.id,
      { studentName, nisn, formData: dynamicFormData },
      { nisnRequired: tenant.nisnRequired, documents },
    );
    if (!result.ok) {
      if (result.code === "session-not-open") return { status: "closed" };
      if (result.code === "invalid-input") return { status: "error", message: "Data belum lengkap atau belum valid. Periksa kembali seluruh isian Anda." };
      return { status: "error", message: "Kode pendaftaran sedang penuh. Silakan coba kirim ulang." };
    }
    return { status: "success", registrationCode: result.registrationCode };
  } catch (error) {
    console.error({ event: "ppdb_submission_upload_failed", tenantId: tenant.id, error });
    return { status: "error", message: "Dokumen belum dapat disimpan. Silakan coba lagi." };
  }
}
