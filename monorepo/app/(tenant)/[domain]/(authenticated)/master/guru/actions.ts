"use server";

import { captureActionError, finishMasterDataAction } from "../action-result";
import { createTeacherMasterDataService } from "@/lib/teacher-master-data";
import { teacherMasterDataStore } from "@/lib/teacher-master-data-data";
import { parseTeacherForm, parseTeacherLifecycleForm, teacherResultCode } from "@/lib/teacher-master-data-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createTeacherMasterDataService({ store: teacherMasterDataStore });

function finish(domain: string, code: string, id?: string): never {
  return finishMasterDataAction(domain, "guru", code, id);
}

export async function createTeacherAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseTeacherForm(formData);
  if (!parsed || parsed.id) finish(domain, "invalid-input");

  const result = await captureActionError(service.create(principal, parsed.input));
  if (!result) finish(domain, "error");
  finish(domain, teacherResultCode(result), result.ok ? result.record.teacher.id : undefined);
}

export async function editTeacherAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseTeacherForm(formData);
  if (!parsed?.id || parsed.personVersion === undefined || parsed.teacherVersion === undefined) {
    finish(domain, "invalid-input");
  }

  const result = await captureActionError(
    service.edit(principal, parsed.id, parsed.input, parsed.personVersion, parsed.teacherVersion),
  );
  if (!result) finish(domain, "error", parsed.id);
  finish(domain, teacherResultCode(result), parsed.id);
}

export async function manageTeacherLifecycleAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseTeacherLifecycleForm(formData);
  if (!parsed) finish(domain, "invalid-input");

  const operation =
    parsed.operation === "transition"
      ? service.transition(principal, parsed.id, parsed)
      : parsed.operation === "archive"
        ? service.archive(principal, parsed.id, parsed)
        : service.reactivate(principal, parsed.id, parsed);
  const result = await captureActionError(operation);

  if (!result) finish(domain, "error", parsed.id);
  finish(domain, teacherResultCode(result), parsed.id);
}
