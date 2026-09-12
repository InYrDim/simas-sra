"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";
import { createExtracurricularService } from "@/lib/master-data/extracurricular";
import { extracurricularStore } from "@/lib/master-data/extracurricular-data";

const service = createExtracurricularService({ store: extracurricularStore });
const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const optional = (form: FormData, name: string) => text(form, name) || null;
const path = (domain: string) => `/${domain}/master/organisasi/ekstrakurikuler`;

function finish(domain: string, result: { ok: boolean; code?: string }) {
  revalidatePath(path(domain));
  redirect(`${path(domain)}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function createExtracurricularAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.create");
  finish(domain, await service.createExtracurricular(principal, {
    name: text(form, "name"), code: text(form, "code"), description: optional(form, "description"),
    defaultLocationId: optional(form, "defaultLocationId"),
  }));
}

export async function createGroupAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.groups.create");
  finish(domain, await service.createGroup(principal, {
    extracurricularId: text(form, "extracurricularId"), academicYearId: text(form, "academicYearId"),
    name: text(form, "name"), startDate: text(form, "startDate"), endDate: text(form, "endDate"),
    capacity: Number(form.get("capacity")), locationId: optional(form, "locationId"), scheduleText: text(form, "scheduleText"),
  }));
}

export async function transitionGroupAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.groups.lifecycle");
  finish(domain, await service.transitionGroup(principal, text(form, "groupId"), text(form, "operation") as "activate" | "complete" | "cancel", {
    expectedVersion: Number(form.get("expectedVersion")), reason: text(form, "reason"),
  }));
}

export async function assignAdvisorAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.advisors.assign");
  finish(domain, await service.assignAdvisor(principal, {
    groupId: text(form, "groupId"), advisorKind: text(form, "advisorKind") as "teacher" | "staff",
    advisorId: text(form, "advisorId"), startDate: text(form, "startDate"), endDate: optional(form, "endDate"), reason: text(form, "reason"),
  }));
}

export async function enrollParticipantAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.participants.assign");
  finish(domain, await service.enrollParticipant(principal, {
    groupId: text(form, "groupId"), studentId: text(form, "studentId"), startDate: text(form, "startDate"),
    endDate: optional(form, "endDate"), reason: text(form, "reason"),
  }));
}

export async function endAdvisorAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.advisors.unassign");
  finish(domain, await service.endAdvisor(principal, text(form, "advisorId"), {
    effectiveDate: text(form, "effectiveDate"), reason: text(form, "reason"),
  }));
}

export async function endParticipantAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.participants.unassign");
  finish(domain, await service.endParticipant(principal, text(form, "participantId"), {
    effectiveDate: text(form, "effectiveDate"), reason: text(form, "reason"),
  }));
}

export async function archiveExtracurricularAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "extracurriculars.archive");
  finish(domain, await service.archiveExtracurricular(principal, text(form, "extracurricularId"), {
    expectedVersion: Number(form.get("expectedVersion")), reason: text(form, "reason"),
  }));
}
