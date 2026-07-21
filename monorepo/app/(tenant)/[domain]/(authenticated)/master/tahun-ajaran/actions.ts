"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createAcademicYearService({ store: academicYearStore });
function finish(domain: string, result: { ok: boolean; code?: string }) { revalidatePath(`/${domain}/master/tahun-ajaran`); redirect(`/${domain}/master/tahun-ajaran?result=${result.ok ? "saved" : result.code ?? "error"}`); }
export async function createAcademicYearAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const field = (name: string) => String(formData.get(name) ?? "");
  finish(domain, await service.create(principal, { label: field("label"), startDate: field("startDate"), endDate: field("endDate"), oddStartDate: field("oddStartDate"), oddEndDate: field("oddEndDate"), evenStartDate: field("evenStartDate"), evenEndDate: field("evenEndDate") }));
}
// Buat Cepat: admin hanya mengisi tahun mulai; label dan seluruh tanggal semester diturunkan otomatis dengan pola Juli–Juni yang lazim dipakai sekolah.
export async function createAcademicYearQuickAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const startYear = Number(formData.get("startYear"));
  if (!Number.isInteger(startYear)) return finish(domain, { ok: false, code: "invalid-input" });
  const endYear = startYear + 1;
  finish(domain, await service.create(principal, {
    label: `${startYear}/${endYear}`,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
    oddStartDate: `${startYear}-07-01`,
    oddEndDate: `${startYear}-12-31`,
    evenStartDate: `${endYear}-01-01`,
    evenEndDate: `${endYear}-06-30`,
  }));
}
export async function transitionAcademicYearAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const action = String(formData.get("action")) as "activate" | "start-even" | "close" | "cancel";
  finish(domain, await service.transition(principal, String(formData.get("id")), action, String(formData.get("effectiveDate"))));
}
export async function archiveAcademicYearAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const operation = String(formData.get("operation"));
  const args = [principal, String(formData.get("id")), String(formData.get("effectiveDate"))] as const;
  finish(domain, operation === "reactivate" ? await service.reactivate(...args) : await service.archive(...args));
}
