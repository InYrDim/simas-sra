"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";
import {
  createInventoryAssetService,
  type AssetCondition,
  type AssetTrackingMode,
} from "@/lib/master-data/inventory-asset";
import { inventoryAssetStore } from "@/lib/master-data/inventory-asset-data";

const service = createInventoryAssetService({ store: inventoryAssetStore });
const path = (domain: string) => `/${domain}/master/sarpras/aset`;
const value = (form: FormData, name: string) => String(form.get(name) ?? "");

function fields(form: FormData) {
  return {
    inventoryCode: value(form, "inventoryCode"),
    name: value(form, "name"),
    category: value(form, "category"),
    trackingMode: value(form, "trackingMode") as AssetTrackingMode,
    condition: value(form, "condition") as AssetCondition,
    quantity: Number(value(form, "quantity")),
    locationId: value(form, "locationId") || null,
    acquisitionDate: value(form, "acquisitionDate") || null,
    acquisitionCost: value(form, "acquisitionCost") ? Number(value(form, "acquisitionCost")) : null,
    acquisitionSource: value(form, "acquisitionSource") || null,
  };
}

function finish(domain: string, result: { ok: boolean; code?: string }) {
  revalidatePath(path(domain));
  redirect(`${path(domain)}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function createAssetAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "assets.create");
  finish(domain, await service.create(principal, fields(form)));
}

export async function editAssetAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "assets.update");
  finish(domain, await service.edit(principal, value(form, "id"), fields(form), Number(value(form, "expectedVersion"))));
}

export async function changeInventoryAction(domain: string, form: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "assets.inventory.adjust");
  finish(domain, await service.change(principal, value(form, "id"), {
    expectedVersion: Number(value(form, "expectedVersion")),
    quantity: Number(value(form, "quantity")),
    condition: value(form, "condition") as AssetCondition,
    locationId: value(form, "locationId") || null,
    reason: value(form, "reason"),
  }));
}

export async function manageAssetAction(domain: string, form: FormData) {
  const operation = value(form, "operation");
  if (operation !== "archive" && operation !== "reactivate") finish(domain, { ok: false, code: "invalid-input" });
  const permission = operation === "archive" ? "assets.assets.archive" : "assets.assets.restore";
  const principal = await enforceTenantMasterDataOperation(domain, "assets.archive-or-restore", [permission]);
  const id = value(form, "id");
  const input = { expectedVersion: Number(value(form, "expectedVersion")), reason: value(form, "reason") };
  const result = operation === "archive" ? await service.archive(principal, id, input) : await service.reactivate(principal, id, input);
  finish(domain, result);
}
