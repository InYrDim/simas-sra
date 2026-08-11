"use server";

import { revalidatePath } from "next/cache";

import { updateTenantMenuVisibility } from "@/lib/provider/provider-feature-data";
import {
  isKnownMenuKey,
  type TenantMenuVisibility,
} from "@/lib/features/tenant-menu-visibility";
import { requireProviderActionAccess } from "@/lib/provider/provider-access";

export type MenuVisibilityActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function updateTenantMenuVisibilityAction(
  tenantId: string,
  _previousState: MenuVisibilityActionState,
  formData: FormData,
): Promise<MenuVisibilityActionState> {
  await requireProviderActionAccess();

  const visibility: TenantMenuVisibility = {};
  for (const [key, value] of formData.entries()) {
    if (!isKnownMenuKey(key)) continue;
    visibility[key] = value === "on";
  }

  const updated = await updateTenantMenuVisibility(tenantId, visibility);
  if (!updated) return { status: "error", message: "Tenant tidak ditemukan." };

  revalidatePath("/provider/features");
  revalidatePath("/provider/tenants");
  return { status: "saved", message: "Visibilitas menu berhasil disimpan." };
}
