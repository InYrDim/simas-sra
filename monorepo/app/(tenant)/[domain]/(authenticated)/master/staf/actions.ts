"use server";

import { captureActionError, finishMasterDataAction } from "../action-result";
import { createStaffMasterDataService } from "@/lib/master-data/staff-master-data";
import { staffMasterDataStore } from "@/lib/master-data/staff-master-data-data";
import { parseStaffForm, parseStaffLifecycleForm, staffResultCode } from "@/lib/master-data/staff-master-data-route";
import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";

const service = createStaffMasterDataService({ store: staffMasterDataStore });

function finish(domain: string, code: string, id?: string): never {
  return finishMasterDataAction(domain, "staf", code, id);
}

export async function createStaffAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "staff.create", ["staff.staff.create", "people.people.create"]);
  const parsed = parseStaffForm(formData);
  if (!parsed || parsed.id) finish(domain, "invalid-input");

  const result = await captureActionError(service.create(principal, parsed.input));
  if (!result) finish(domain, "error");
  finish(domain, staffResultCode(result), result.ok ? result.record.staff.id : undefined);
}

export async function editStaffAction(domain: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "staff.update", ["staff.staff.update", "people.people.update"]);
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
  const parsed = parseStaffLifecycleForm(formData);
  if (!parsed) finish(domain, "invalid-input");
  const lifecyclePermission = parsed.operation === "archive"
    ? "staff.staff.archive"
    : parsed.operation === "reactivate"
      ? "staff.staff.restore"
      : "staff.staff.manage-lifecycle";
  const principal = await enforceTenantMasterDataOperation(domain, "staff.lifecycle", [lifecyclePermission]);

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
