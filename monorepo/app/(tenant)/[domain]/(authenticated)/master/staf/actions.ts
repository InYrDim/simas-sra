"use server";

import { captureActionError, finishMasterDataAction } from "../action-result";
import { createStaffMasterDataService } from "@/lib/staff-master-data";
import { staffMasterDataStore } from "@/lib/staff-master-data-data";
import { parseStaffForm, parseStaffLifecycleForm, staffResultCode } from "@/lib/staff-master-data-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createStaffMasterDataService({ store: staffMasterDataStore });

function finish(domain: string, code: string, id?: string): never {
  return finishMasterDataAction(domain, "staf", code, id);
}

export async function createStaffAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseStaffForm(formData);
  if (!parsed || parsed.id) finish(domain, "invalid-input");

  const result = await captureActionError(service.create(principal, parsed.input));
  if (!result) finish(domain, "error");
  finish(domain, staffResultCode(result), result.ok ? result.record.staff.id : undefined);
}

export async function editStaffAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseStaffForm(formData);
  if (!parsed?.id || parsed.personVersion === undefined || parsed.staffVersion === undefined) {
    finish(domain, "invalid-input");
  }

  const result = await captureActionError(
    service.edit(principal, parsed.id, parsed.input, parsed.personVersion, parsed.staffVersion),
  );
  if (!result) finish(domain, "error", parsed.id);
  finish(domain, staffResultCode(result), parsed.id);
}

export async function manageStaffLifecycleAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const parsed = parseStaffLifecycleForm(formData);
  if (!parsed) finish(domain, "invalid-input");

  const operation =
    parsed.operation === "transition"
      ? service.transition(principal, parsed.id, parsed)
      : parsed.operation === "archive"
        ? service.archive(principal, parsed.id, parsed)
        : service.reactivate(principal, parsed.id, parsed);
  const result = await captureActionError(operation);

  if (!result) finish(domain, "error", parsed.id);
  finish(domain, staffResultCode(result), parsed.id);
}
