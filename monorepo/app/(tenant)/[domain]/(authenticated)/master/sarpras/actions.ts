"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createLocationService, type LocationType } from "@/lib/master-data/location";
import { locationStore } from "@/lib/master-data/location-data";
import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";

const service = createLocationService({ store: locationStore });
const path = (domain: string) => `/${domain}/master/sarpras`;
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

const fields = (form: FormData) => ({
  name: text(form, "name"),
  code: text(form, "code"),
  type: text(form, "type") as LocationType,
  capacity: form.get("capacity") ? Number(form.get("capacity")) : null,
  description: text(form, "description") || null,
  parentId: text(form, "parentId") || null,
});

function finish(domain: string, result: { ok: boolean; code?: string }) {
  revalidatePath(path(domain));
  redirect(`${path(domain)}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function createLocationAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "facilities.create");
  finish(domain, await service.create(principal, fields(form)));
}

export async function editLocationAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "facilities.update");
  finish(domain, await service.edit(principal, text(form, "id"), fields(form), Number(form.get("expectedVersion"))));
}

export async function manageLocationAction(domain: string, form: FormData) {
  const operation = text(form, "operation");
  if (operation !== "archive" && operation !== "reactivate") finish(domain, { ok: false, code: "invalid-input" });
  const permission = operation === "archive" ? "facilities.locations.archive" : "facilities.locations.restore";
  const principal = await enforceTenantMasterDataOperation(domain, "facilities.archive-or-restore", [permission]);
  const input = { expectedVersion: Number(form.get("expectedVersion")), reason: text(form, "reason") };
  const result = operation === "archive"
    ? await service.archive(principal, text(form, "id"), input)
    : await service.reactivate(principal, text(form, "id"), input);
  finish(domain, result);
}
