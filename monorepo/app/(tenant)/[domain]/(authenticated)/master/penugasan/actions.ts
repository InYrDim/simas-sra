"use server";

import { finishMasterDataAction } from "../action-result";
import { createTeachingAssignmentService } from "@/lib/academic/teaching-assignment";
import { teachingAssignmentStore } from "@/lib/academic/teaching-assignment-data";
import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";

const service = createTeachingAssignmentService({ store: teachingAssignmentStore });

function finish(domain: string, resultCode: string, selectedId?: string): never {
  return finishMasterDataAction(domain, "penugasan", resultCode, selectedId);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function scope(formData: FormData) {
  return {
    teacherProfileId: text(formData, "teacherProfileId"),
    subjectId: text(formData, "subjectId"),
    classGroupId: text(formData, "classGroupId"),
    academicYearId: text(formData, "academicYearId"),
  };
}

export async function createTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const startsOn = text(formData, "startsOn");
  const endsOn = text(formData, "endsOn");
  if (!startsOn) finish(domain, "invalid-input");

  const result = await service.create({
    tenantId: principal.tenantId,
    createdByUserId: principal.userId,
    ...scope(formData),
    startsOn,
    endsOn: endsOn || null,
    reason: text(formData, "reason"),
  });
  finish(domain, result.ok ? "created" : result.code);
}

export async function updatePlannedTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const id = text(formData, "assignmentId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  const startsOn = text(formData, "startsOn");
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !startsOn) finish(domain, "invalid-input");

  const result = await service.updatePlanned(principal.tenantId, id, principal.userId, expectedVersion, {
    ...scope(formData),
    startsOn,
    endsOn: text(formData, "endsOn") || null,
  }, text(formData, "reason"));
  finish(domain, result.ok ? "updated" : result.code, id);
}

export async function activateTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const id = text(formData, "assignmentId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  const effectiveOn = text(formData, "effectiveOn");
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !effectiveOn) finish(domain, "invalid-input");

  const result = await service.activate(principal.tenantId, id, principal.userId, expectedVersion, effectiveOn, text(formData, "reason"));
  finish(domain, result.ok ? "activated" : result.code, id);
}

export async function endTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const id = text(formData, "assignmentId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  const effectiveOn = text(formData, "effectiveOn");
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !effectiveOn) finish(domain, "invalid-input");

  const result = await service.end(principal.tenantId, id, principal.userId, expectedVersion, effectiveOn, text(formData, "reason"));
  finish(domain, result.ok ? "ended" : result.code, id);
}

export async function cancelTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const id = text(formData, "assignmentId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) finish(domain, "invalid-input");

  const result = await service.cancel(principal.tenantId, id, principal.userId, expectedVersion, text(formData, "reason"));
  finish(domain, result.ok ? "cancelled" : result.code, id);
}

export async function replaceTeachingAssignmentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "teaching-assignments.write");
  const id = text(formData, "assignmentId");
  const expectedVersion = Number(text(formData, "expectedVersion"));
  const startsOn = text(formData, "startsOn");
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !startsOn) finish(domain, "invalid-input");

  const result = await service.replace(principal.tenantId, id, principal.userId, expectedVersion, {
    ...scope(formData),
    startsOn,
  }, text(formData, "reason"));
  finish(domain, result.ok ? "replaced" : result.code, id);
}
