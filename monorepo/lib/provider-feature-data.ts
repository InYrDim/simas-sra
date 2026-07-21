import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider-access";
import {
  mergeProviderFeatureSelection,
  readProviderFeatureSelection,
  type ProviderFeatureSelection,
} from "@/lib/provider-feature-settings";

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

  return row ? { ...row, features: readProviderFeatureSelection(row.settings) } : null;
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
