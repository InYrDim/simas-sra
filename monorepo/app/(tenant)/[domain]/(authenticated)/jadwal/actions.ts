"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTeachingSlotService } from "@/lib/academic/teaching-slot-service";
import { teachingSlotStore } from "@/lib/academic/teaching-slot-data";
import { enforceTenantOperation, enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";

const service = createTeachingSlotService({ store: teachingSlotStore });

/**
 * Server-side enforcement seam for every Jadwal Mengajar write: the Provider
 * feature flag (penjadwalanWrite) is rechecked here even though the page
 * already checks it, and the write-gated RBAC operation is enforced on the
 * server so no client-visible state is trusted.
 */
async function enforceJadwalWrite(domain: string) {
  await enforceTenantFeatureEnabled(domain, "penjadwalanWrite");
  return enforceTenantOperation(domain, "jadwal.mengajar.write");
}

function finish(domain: string, resultCode: string, params?: { classGroupId?: string }): never {
  const path = `/${domain}/jadwal/mengajar`;
  const query = new URLSearchParams({ result: resultCode });
  if (params?.classGroupId) query.set("classGroupId", params.classGroupId);
  revalidatePath(path);
  redirect(`${path}?${query}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function slotForm(formData: FormData) {
  return {
    teachingAssignmentId: text(formData, "teachingAssignmentId"),
    dayOfWeek: text(formData, "dayOfWeek"),
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    semester: text(formData, "semester"),
  };
}

export async function createTeachingSlotAction(domain: string, formData: FormData) {
  const principal = await enforceJadwalWrite(domain);
  const classGroupId = text(formData, "classGroupId");
  const input = slotForm(formData);
  if (!classGroupId || !input.teachingAssignmentId) finish(domain, "invalid-input", { classGroupId });

  const result = await service.createSlot({ tenantId: principal.tenantId, actorUserId: principal.userId, ...input });
  finish(domain, result.ok ? "created" : result.code, { classGroupId });
}

export async function updateTeachingSlotAction(domain: string, formData: FormData) {
  const principal = await enforceJadwalWrite(domain);
  const classGroupId = text(formData, "classGroupId");
  const slotId = text(formData, "slotId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  const input = slotForm(formData);
  if (!classGroupId || !slotId || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !input.teachingAssignmentId) {
    finish(domain, "invalid-input", { classGroupId });
  }

  const result = await service.updateSlot({
    tenantId: principal.tenantId,
    actorUserId: principal.userId,
    slotId,
    expectedVersion,
    ...input,
  });
  finish(domain, result.ok ? "updated" : result.code, { classGroupId });
}

export async function deleteTeachingSlotAction(domain: string, formData: FormData) {
  const principal = await enforceJadwalWrite(domain);
  const classGroupId = text(formData, "classGroupId");
  const slotId = text(formData, "slotId");
  if (!classGroupId || !slotId) finish(domain, "invalid-input", { classGroupId });

  const result = await service.deleteSlot({ tenantId: principal.tenantId, actorUserId: principal.userId, slotId });
  finish(domain, result.ok ? "deleted" : result.code, { classGroupId });
}

export async function createTeachingPeriodAction(domain: string, formData: FormData) {
  const principal = await enforceJadwalWrite(domain);
  const sortOrder = Number(text(formData, "sortOrder"));
  const result = await service.createPeriod({
    tenantId: principal.tenantId,
    label: text(formData, "label"),
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    sortOrder,
  });
  finish(domain, result.ok ? "period-created" : result.code);
}

export async function deleteTeachingPeriodAction(domain: string, formData: FormData) {
  const principal = await enforceJadwalWrite(domain);
  const periodId = text(formData, "periodId");
  if (!periodId) finish(domain, "invalid-input");
  const result = await service.deletePeriod({ tenantId: principal.tenantId, periodId });
  finish(domain, result.ok ? "period-deleted" : result.code);
}
