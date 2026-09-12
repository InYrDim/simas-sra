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
