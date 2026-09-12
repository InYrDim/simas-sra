"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";
import { createStudentOrganizationService } from "@/lib/master-data/student-organization";
import { studentOrganizationStore } from "@/lib/master-data/student-organization-data";

const service = createStudentOrganizationService({ store: studentOrganizationStore });
const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const optional = (form: FormData, name: string) => text(form, name) || null;

function finish(domain: string, result: { ok: boolean; code?: string }) {
  revalidatePath(`/${domain}/master/organisasi`);
  redirect(`/${domain}/master/organisasi?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function createOrganizationAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.create");
  finish(domain, await service.createOrganization(principal, {
    name: text(form, "name"), abbreviation: optional(form, "abbreviation"), code: text(form, "code"),
    description: optional(form, "description"), foundingDate: optional(form, "foundingDate"),
    secretariatLocationId: optional(form, "secretariatLocationId"),
  }));
}

export async function createPeriodAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.periods.create");
  finish(domain, await service.createPeriod(principal, {
    organizationId: text(form, "organizationId"), name: text(form, "name"),
    startDate: text(form, "startDate"), endDate: text(form, "endDate"),
  }));
}

export async function transitionPeriodAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.periods.lifecycle");
  finish(domain, await service.transitionPeriod(principal, text(form, "periodId"), text(form, "operation") as "activate" | "complete", {
    expectedVersion: Number(form.get("expectedVersion")), reason: text(form, "reason"),
  }));
}

export async function correctPeriodAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.periods.correct");
  finish(domain, await service.correctCompletedPeriod(principal, text(form, "periodId"), {
    expectedVersion: Number(form.get("expectedVersion")), startDate: text(form, "startDate"),
    endDate: text(form, "endDate"), reason: text(form, "reason"),
  }));
}

export async function addMembershipAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.memberships.assign");
  finish(domain, await service.addMembership(principal, {
    organizationId: text(form, "organizationId"), studentId: text(form, "studentId"),
    startDate: text(form, "startDate"), endDate: optional(form, "endDate"), reason: text(form, "reason"),
  }));
}

export async function endMembershipAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.memberships.unassign");
  finish(domain, await service.endMembership(principal, text(form, "membershipId"), {
    effectiveDate: text(form, "effectiveDate"), reason: text(form, "reason"),
  }));
}

export async function assignLeadershipAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.leadership.assign");
  finish(domain, await service.assignLeadership(principal, {
    periodId: text(form, "periodId"), studentId: text(form, "studentId"), positionName: text(form, "positionName"),
    allowsMultipleHolders: form.get("allowsMultipleHolders") === "on", startDate: text(form, "startDate"),
    endDate: optional(form, "endDate"), reason: text(form, "reason"),
  }));
}

export async function endLeadershipAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.leadership.unassign");
  finish(domain, await service.endLeadership(principal, text(form, "leadershipId"), {
    effectiveDate: text(form, "effectiveDate"), reason: text(form, "reason"),
  }));
}

export async function archiveOrganizationAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "student-organizations.archive");
  finish(domain, await service.archiveOrganization(principal, text(form, "organizationId"), {
    expectedVersion: Number(form.get("expectedVersion")), reason: text(form, "reason"),
  }));
}
