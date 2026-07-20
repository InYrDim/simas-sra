"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createStudentMasterDataService } from "@/lib/student-master-data";
import { studentMasterDataStore } from "@/lib/student-master-data-data";
import { parseStudentForm, studentResultCode } from "@/lib/student-master-data-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
const service = createStudentMasterDataService({ store: studentMasterDataStore });
function finish(domain: string, code: string, id?: string): never { revalidatePath(`/${domain}/master/siswa`); const query = new URLSearchParams({ result: code }); if (id) query.set("selected", id); redirect(`/${domain}/master/siswa?${query}`); }
export async function createStudentAction(domain: string, formData: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), parsed = parseStudentForm(formData); if (!parsed || parsed.id) finish(domain, "invalid-input"); const result = await service.create(principal, parsed.input).catch(() => null); if (!result) finish(domain, "error"); finish(domain, studentResultCode(result), result.ok ? result.record.student.id : undefined); }
export async function editStudentAction(domain: string, formData: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), parsed = parseStudentForm(formData); if (!parsed?.id || parsed.personVersion === undefined || parsed.studentVersion === undefined) finish(domain, "invalid-input"); const result = await service.edit(principal, parsed.id, parsed.input, parsed.personVersion, parsed.studentVersion).catch(() => null); if (!result) finish(domain, "error", parsed.id); finish(domain, studentResultCode(result), parsed.id); }
