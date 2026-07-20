"use server";

import { revalidatePath } from "next/cache";

import { createAddSchoolAccreditationCommand, createCorrectSchoolAccreditationCommand } from "@/lib/school-accreditation";
import { createUploadSchoolLogoCommand } from "@/lib/school-profile-assets";
import { schoolAccreditationStore, schoolAssetStore } from "@/lib/school-profile-history-data";
import { createProtectedFileStorage, schoolAssetRetentionDays } from "@/lib/protected-file-storage";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export type ProfileHistoryActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "invalid"; message: string; errors?: Record<string, string> }
  | { status: "error"; message: string };

function accreditationInput(formData: FormData) {
  return {
    rating: String(formData.get("rating") ?? ""),
    certificateNumber: String(formData.get("certificateNumber") ?? ""),
    issuingInstitution: String(formData.get("issuingInstitution") ?? ""),
    determinationDate: String(formData.get("determinationDate") ?? ""),
    expiryDate: String(formData.get("expiryDate") ?? ""),
  };
}

export async function uploadSchoolLogoAction(domain: string, _previous: ProfileHistoryActionState, formData: FormData): Promise<ProfileHistoryActionState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { status: "invalid", message: "Pilih file logo untuk diunggah." };
  const storageRoot = process.env.PROTECTED_STORAGE_ROOT;
  if (!storageRoot) return { status: "error", message: "Penyimpanan file belum dikonfigurasi." };
  try {
    const command = createUploadSchoolLogoCommand({ storage: createProtectedFileStorage(storageRoot), store: schoolAssetStore, retentionDays: schoolAssetRetentionDays() });
    const result = await command(principal, { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name, declaredMimeType: file.type });
    if (!result.ok) return { status: result.code === "invalid-file" ? "invalid" : "error", message: result.code === "retention-not-configured" ? "Fitur file belum aktif karena kebijakan retensi belum dikonfigurasi." : result.message };
    revalidatePath(`/${domain}/master/profil`);
    return { status: "saved", message: "Logo sekolah berhasil disimpan." };
  } catch (error) {
    console.error({ event: "school_logo_upload_failed", tenantId: principal.tenantId, error });
    return { status: "error", message: "Logo belum dapat disimpan. Coba lagi." };
  }
}

export async function addSchoolAccreditationAction(domain: string, _previous: ProfileHistoryActionState, formData: FormData): Promise<ProfileHistoryActionState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  try {
    const result = await createAddSchoolAccreditationCommand({ store: schoolAccreditationStore })(principal, accreditationInput(formData));
    if (!result.ok) return result.code === "overlap" ? { status: "invalid", message: "Periode akreditasi tumpang tindih dengan riwayat aktif." } : { status: "invalid", message: "Periksa kembali data akreditasi.", errors: result.errors };
    revalidatePath(`/${domain}/master/profil`);
    return { status: "saved", message: "Riwayat akreditasi berhasil ditambahkan." };
  } catch (error) {
    console.error({ event: "school_accreditation_add_failed", tenantId: principal.tenantId, error });
    return { status: "error", message: "Riwayat akreditasi belum dapat disimpan." };
  }
}

export async function correctSchoolAccreditationAction(domain: string, recordId: string, _previous: ProfileHistoryActionState, formData: FormData): Promise<ProfileHistoryActionState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  try {
    const result = await createCorrectSchoolAccreditationCommand({ store: schoolAccreditationStore })(principal, recordId, { ...accreditationInput(formData), correctionReason: String(formData.get("correctionReason") ?? "") });
    if (!result.ok) {
      if (result.code === "not-found") return { status: "error", message: "Riwayat akreditasi tidak ditemukan." };
      if (result.code === "overlap") return { status: "invalid", message: "Periode koreksi tumpang tindih dengan riwayat aktif." };
      return { status: "invalid", message: "Periksa kembali data koreksi.", errors: result.errors };
    }
    revalidatePath(`/${domain}/master/profil`);
    return { status: "saved", message: "Koreksi disimpan tanpa menghapus riwayat lama." };
  } catch (error) {
    console.error({ event: "school_accreditation_correction_failed", tenantId: principal.tenantId, recordId, error });
    return { status: "error", message: "Koreksi akreditasi belum dapat disimpan." };
  }
}
