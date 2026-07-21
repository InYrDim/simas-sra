"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSchoolPersonMasterDataService } from "@/lib/school-person-master-data";
import { schoolPersonMasterDataStore } from "@/lib/school-person-master-data-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createSchoolPersonMasterDataService({ store: schoolPersonMasterDataStore });
const allowedOrigins = new Set(["siswa", "guru", "staf"]);
export async function archiveSchoolPersonAction(domain: string, formData: FormData): Promise<never> {
  const principal = await enforceMasterDataAccess(domain, "write"), personId = String(formData.get("personId") ?? "").trim(), origin = String(formData.get("origin") ?? ""), selected = String(formData.get("selected") ?? "").trim(), reason = String(formData.get("reason") ?? "").trim(), expectedVersion = Number.parseInt(String(formData.get("expectedVersion") ?? ""), 10);
  const section = allowedOrigins.has(origin) ? origin : "siswa"; let code = "invalid-input";
  if (personId && reason && Number.isSafeInteger(expectedVersion) && expectedVersion > 0) { const result = await service.archive(principal, personId, { reason, expectedVersion }).catch(() => null); code = result?.ok ? "person-archived" : result?.code === "profile-active" ? "profile-active" : result?.code ?? "error"; }
  revalidatePath(`/${domain}/master/${section}`); const query = new URLSearchParams({ result: code }); if (selected) query.set("selected", selected); redirect(`/${domain}/master/${section}?${query}`);
}
