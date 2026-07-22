"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSubjectCatalogService,
  SUBJECT_EDUCATION_LEVELS,
  type SubjectEducationLevel,
} from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { schoolProfileStore } from "@/lib/school-profile-data";
import { parseSubjectForm, subjectResultCode } from "@/lib/subject-catalog-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createSubjectCatalogService({ store: subjectCatalogStore });
function finish(domain: string, code: string, selected?: string): never {
  revalidatePath(`/${domain}/master/mapel`);
  const params = new URLSearchParams({ result: code });
  if (selected) params.set("selected", selected);
  redirect(`/${domain}/master/mapel?${params}`);
}

async function schoolEducationLevel(tenantId: string) {
  const identity = await schoolProfileStore.findProviderIdentity(tenantId);
  return identity && SUBJECT_EDUCATION_LEVELS.includes(
    identity.educationLevel as SubjectEducationLevel,
  )
    ? identity.educationLevel as SubjectEducationLevel
    : null;
}

export async function createSubjectAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const educationLevel = await schoolEducationLevel(principal.tenantId);
  if (!educationLevel) finish(domain, "invalid-input");
  const parsed = parseSubjectForm(formData, educationLevel);
  if (!parsed || parsed.id) finish(domain, "invalid-input");
  const result = await service.create(principal, parsed.input).catch(() => null);
  if (!result) finish(domain, "error");
  finish(domain, subjectResultCode(result), result.ok ? result.subject.id : undefined);
}

export async function editSubjectAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const educationLevel = await schoolEducationLevel(principal.tenantId);
  if (!educationLevel) finish(domain, "invalid-input");
  const parsed = parseSubjectForm(formData, educationLevel);
  if (!parsed?.id || parsed.version === undefined) finish(domain, "invalid-input");
  const result = await service.edit(principal, parsed.id, parsed.input, parsed.version).catch(() => null);
  if (!result) finish(domain, "error", parsed.id);
  finish(domain, subjectResultCode(result), parsed.id);
}

export async function archiveSubjectAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const id = String(formData.get("id") ?? "");
  const version = Number.parseInt(String(formData.get("version") ?? ""), 10);
  const operation = String(formData.get("operation") ?? "");
  if (!id || !Number.isSafeInteger(version) || !["archive", "reactivate"].includes(operation)) finish(domain, "invalid-input");
  const result = await (operation === "reactivate" ? service.reactivate(principal, id, version) : service.archive(principal, id, version)).catch(() => null);
  if (!result) finish(domain, "error", id);
  finish(domain, subjectResultCode(result), id);
}
