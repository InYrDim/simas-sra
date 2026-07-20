"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClassGroupService, type ClassGroupEducationLevel } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createClassMembershipService } from "@/lib/class-membership";
import { classMembershipStore } from "@/lib/class-membership-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
const service = createClassGroupService({ store: classGroupStore });
const relationshipService = createClassMembershipService({ store: classMembershipStore });
function finish(domain: string, result: { ok: boolean; code?: string }) { revalidatePath(`/${domain}/master/rombel`); redirect(`/${domain}/master/rombel?result=${result.ok ? "saved" : result.code ?? "error"}`); }
function fields(form: FormData) { const value = (name: string) => String(form.get(name) ?? ""); return { academicYearId: value("academicYearId"), educationLevel: value("educationLevel") as ClassGroupEducationLevel, grade: Number(value("grade")), groupName: value("groupName"), code: value("code") || null, capacity: value("capacity") ? Number(value("capacity")) : null, primaryLocationId: value("primaryLocationId") || null }; }
export async function createClassGroupAction(domain: string, form: FormData) { const principal = await enforceMasterDataAccess(domain, "write"); finish(domain, await service.create(principal, fields(form))); }
export async function editClassGroupAction(domain: string, form: FormData) { const principal = await enforceMasterDataAccess(domain, "write"); finish(domain, await service.edit(principal, String(form.get("id")), fields(form), Number(form.get("expectedVersion")))); }
export async function manageClassGroupAction(domain: string, form: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), id = String(form.get("id")), operation = String(form.get("operation")), input = { expectedVersion: Number(form.get("expectedVersion")), reason: String(form.get("reason") ?? "") }; finish(domain, operation === "archive" ? await service.archive(principal, id, input) : operation === "reactivate" ? await service.reactivate(principal, id, input) : await service.transition(principal, id, operation as "activate" | "close" | "cancel", input)); }
export async function manageClassRelationshipAction(domain: string, form: FormData) { const principal = await enforceMasterDataAccess(domain, "write"), operation = String(form.get("operation")), input = { studentId: String(form.get("studentId") ?? ""), teacherId: String(form.get("teacherId") ?? ""), classGroupId: String(form.get("classGroupId") ?? ""), toClassGroupId: String(form.get("toClassGroupId") ?? ""), effectiveDate: String(form.get("effectiveDate") ?? ""), reason: String(form.get("reason") ?? "") }; const result = operation === "transfer" ? await relationshipService.transfer(principal, input) : operation === "homeroom" ? await relationshipService.assignHomeroom(principal, input) : await relationshipService.addMembership(principal, input); finish(domain, result); }
