"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAcademicYearService } from "@/lib/academic/academic-year";
import { academicYearStore } from "@/lib/academic/academic-year-data";
import { enforceAcademicAccess } from "@/lib/master-data/tenant-master-data-route-access";

const service = createAcademicYearService({ store: academicYearStore });
function finish(domain: string, result: { ok: boolean; code?: string }) { revalidatePath(`/${domain}/master/tahun-ajaran`); redirect(`/${domain}/master/tahun-ajaran?result=${result.ok ? "saved" : result.code ?? "error"}`); }
export async function createAcademicYearAction(domain: string, formData: FormData) {
  const principal = await enforceAcademicAccess(domain, "academic-years.create");
  const field = (name: string) => String(formData.get(name) ?? "");
  finish(domain, await service.create(principal, { label: field("label"), startDate: field("startDate"), endDate: field("endDate"), oddStartDate: field("oddStartDate"), oddEndDate: field("oddEndDate"), evenStartDate: field("evenStartDate"), evenEndDate: field("evenEndDate") }));
}
// Buat Cepat: admin hanya mengisi tahun mulai; label dan seluruh tanggal semester diturunkan otomatis dengan pola Juli–Juni yang lazim dipakai sekolah.
export async function createAcademicYearQuickAction(domain: string, formData: FormData) {
  const principal = await enforceAcademicAccess(domain, "academic-years.create");
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
  const principal = await enforceAcademicAccess(domain, "academic-years.manage-lifecycle");
  const action = String(formData.get("action")) as "activate" | "start-even" | "close" | "cancel";
  finish(domain, await service.transition(principal, String(formData.get("id")), action, String(formData.get("effectiveDate"))));
}
export async function archiveAcademicYearAction(domain: string, formData: FormData) {
  const operation = String(formData.get("operation"));
  const principal = await enforceAcademicAccess(domain, operation === "reactivate" ? "academic-years.archive" : "academic-years.archive", [operation === "reactivate" ? "academic-years.years.restore" : "academic-years.years.archive"]);
  const args = [principal, String(formData.get("id")), String(formData.get("effectiveDate"))] as const;
  finish(domain, operation === "reactivate" ? await service.reactivate(...args) : await service.archive(...args));
}
