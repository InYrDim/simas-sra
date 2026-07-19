"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { createApplicantApplicationSubmission } from "@/lib/applicant-application-submission";
import { applicantApplicationSubmissionStore } from "@/lib/applicant-application-submission-data";

export type ApplicationFormState = { success: boolean; message?: string; errors?: Record<string, string> };

export async function submitSimasApplicationAction(
  _previousState: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, message: "Silakan masuk sebagai Pemohon untuk mengirim Pengajuan." };

  const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
  const result = await submit(session.user.id, {
    schoolName: formData.get("schoolName"), npsn: formData.get("npsn"), educationLevel: formData.get("educationLevel"),
    address: formData.get("address"), contactName: formData.get("contactName"), contactPosition: formData.get("contactPosition"),
    contactEmail: formData.get("contactEmail"), contactWhatsapp: formData.get("contactWhatsapp"), needsNote: formData.get("needsNote"),
  });

  if (!result.ok) {
    if ("errors" in result) return { success: false, message: "Periksa kembali data pengajuan Anda.", errors: result.errors };
    if (result.code === "npsn-conflict") return { success: false, message: "Akun Pemohon ini sudah terikat ke NPSN lain." };
    return { success: false, message: "Akun ini tidak memiliki akses Pemohon." };
  }
  return { success: true, message: `Pengajuan berhasil dikirim. Nomor pengajuan: ${result.applicationId}` };
}
