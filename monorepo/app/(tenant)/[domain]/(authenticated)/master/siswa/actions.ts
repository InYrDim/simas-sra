"use server";

import { captureActionError, finishMasterDataAction } from "../action-result";
import { createStudentMasterDataService } from "@/lib/master-data/student-master-data";
import { studentMasterDataStore } from "@/lib/master-data/student-master-data-data";
import { parseStudentForm, parseStudentLifecycleForm, studentResultCode } from "@/lib/master-data/student-master-data-route";
import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";

const service = createStudentMasterDataService({ store: studentMasterDataStore });

function finish(domain: string, code: string, id?: string): never {
  return finishMasterDataAction(domain, "siswa", code, id);
}

export async function createStudentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "students.create", ["students.students.create", "people.people.create"]);
  const parsed = parseStudentForm(formData);
  if (!parsed || parsed.id) finish(domain, "invalid-input");

  const result = await captureActionError(service.create(principal, parsed.input));
  if (!result) finish(domain, "error");
  finish(domain, studentResultCode(result), result.ok ? result.record.student.id : undefined);
}

export async function editStudentAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "students.update", ["students.students.update", "people.people.update"]);
  const parsed = parseStudentForm(formData);
  if (!parsed?.id || parsed.personVersion === undefined || parsed.studentVersion === undefined) {
    finish(domain, "invalid-input");
  }

  const result = await captureActionError(
    service.edit(principal, parsed.id, parsed.input, parsed.personVersion, parsed.studentVersion),
  );
  if (!result) finish(domain, "error", parsed.id);
  finish(domain, studentResultCode(result), parsed.id);
}

export async function manageStudentLifecycleAction(domain: string, formData: FormData) {
  const parsed = parseStudentLifecycleForm(formData);
  if (!parsed) finish(domain, "invalid-input");
  const lifecyclePermission = parsed.operation === "archive"
    ? "students.students.archive"
    : parsed.operation === "reactivate"
      ? "students.students.restore"
      : "students.students.manage-lifecycle";
  const principal = await enforceTenantMasterDataOperation(domain, "students.lifecycle", [lifecyclePermission]);

  const operation =
    parsed.operation === "transition"
      ? service.transition(principal, parsed.id, parsed)
      : parsed.operation === "correct-graduation"
        ? service.correctGraduation(principal, parsed.id, {
            ...parsed,
            toStatus: parsed.toStatus === "graduated" ? "active" : parsed.toStatus,
          })
        : parsed.operation === "archive"
          ? service.archive(principal, parsed.id, parsed)
          : service.reactivate(principal, parsed.id, parsed);
  const result = await captureActionError(operation);

  if (!result) finish(domain, "error", parsed.id);
  finish(domain, studentResultCode(result), parsed.id);
}

export async function saveStudentGuardianAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "students.update", ["students.students.update"]);
  const studentId = String(formData.get("studentId") ?? "").trim();
  const guardianId = String(formData.get("guardianId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "orangtua").trim();
  const label = String(formData.get("label") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!studentId || !label) finish(domain, "invalid-input", studentId);
  if (phone && !/^\+?\d{7,15}$/.test(phone)) finish(domain, "invalid-input", studentId);
  const result = await service.saveGuardian(principal, {
    ...(guardianId ? { id: guardianId } : {}),
    tenantId: principal.tenantId,
    studentId,
    kind: kind || "orangtua",
    label,
    phone: phone || null,
    active,
  });
  if (!result || !result.ok) finish(domain, result?.code ?? "error", studentId);
  finish(domain, "saved", studentId);
}

export async function deleteStudentGuardianAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "students.update", ["students.students.update"]);
  const studentId = String(formData.get("studentId") ?? "").trim();
  const guardianId = String(formData.get("guardianId") ?? "").trim();
  if (!studentId || !guardianId) finish(domain, "invalid-input", studentId);
  const ok = await service.deleteGuardian(principal, guardianId);
  if (!ok) finish(domain, "error", studentId);
  finish(domain, "saved", studentId);
}
