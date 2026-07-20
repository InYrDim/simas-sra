"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTeacherMasterDataService } from "@/lib/teacher-master-data";
import { teacherMasterDataStore } from "@/lib/teacher-master-data-data";
import { parseTeacherForm, parseTeacherLifecycleForm, teacherResultCode } from "@/lib/teacher-master-data-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
const service = createTeacherMasterDataService({ store: teacherMasterDataStore });
function finish(domain: string, code: string, id?: string): never { revalidatePath(`/${domain}/master/guru`); const query = new URLSearchParams({ result: code }); if (id) query.set("selected", id); redirect(`/${domain}/master/guru?${query}`); }
export async function createTeacherAction(domain: string, formData: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), parsed = parseTeacherForm(formData); if (!parsed || parsed.id) finish(domain, "invalid-input"); const result = await service.create(principal, parsed.input).catch(() => null); if (!result) finish(domain, "error"); finish(domain, teacherResultCode(result), result.ok ? result.record.teacher.id : undefined); }
export async function editTeacherAction(domain: string, formData: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), parsed = parseTeacherForm(formData); if (!parsed?.id || parsed.personVersion === undefined || parsed.teacherVersion === undefined) finish(domain, "invalid-input"); const result = await service.edit(principal, parsed.id, parsed.input, parsed.personVersion, parsed.teacherVersion).catch(() => null); if (!result) finish(domain, "error", parsed.id); finish(domain, teacherResultCode(result), parsed.id); }
export async function manageTeacherLifecycleAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write"), parsed = parseTeacherLifecycleForm(formData); if (!parsed) finish(domain, "invalid-input");
  const result = await (parsed.operation === "transition" ? service.transition(principal, parsed.id, parsed) : parsed.operation === "archive" ? service.archive(principal, parsed.id, parsed) : service.reactivate(principal, parsed.id, parsed)).catch(() => null);
  if (!result) finish(domain, "error", parsed.id); finish(domain, teacherResultCode(result), parsed.id);
}
