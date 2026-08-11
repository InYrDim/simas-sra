import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider/provider-access";
import {
  mergeProviderFeatureSelection,
  readProviderFeatureSelection,
  type ProviderFeatureSelection,
} from "@/lib/provider/provider-feature-settings";
import {
  mergeTenantMenuVisibility,
  readTenantMenuVisibility,
  type TenantMenuVisibility,
} from "@/lib/features/tenant-menu-visibility";

export async function listTenantsForFeatureManagement() {
  await requireProviderDataAccess();
  return db
    .select({ id: tenant.id, name: tenant.name, domain: tenant.domain, npsn: tenant.npsn })
    .from(tenant)
    .orderBy(asc(tenant.name));
}

export async function getTenantFeatureConfiguration(tenantId: string) {
  await requireProviderDataAccess();
  const [row] = await db
    .select({ id: tenant.id, name: tenant.name, domain: tenant.domain, settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  return row
    ? {
        ...row,
        features: readProviderFeatureSelection(row.settings),
        menuVisibility: readTenantMenuVisibility(row.settings),
      }
    : null;
}

export async function updateTenantFeatureConfiguration(
  tenantId: string,
  selection: ProviderFeatureSelection,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ settings: tenant.settings })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1)
      .for("update");
    if (!row) return false;

    await tx
      .update(tenant)
      .set({ settings: mergeProviderFeatureSelection(row.settings, selection) })
      .where(eq(tenant.id, tenantId));
    return true;
  });
}

export async function updateTenantMenuVisibility(
  tenantId: string,
  visibility: TenantMenuVisibility,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ settings: tenant.settings })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1)
      .for("update");
    if (!row) return false;

    await tx
      .update(tenant)
      .set({ settings: mergeTenantMenuVisibility(row.settings, visibility) })
      .where(eq(tenant.id, tenantId));
    return true;
  });
}
