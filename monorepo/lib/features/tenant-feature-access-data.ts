import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import type { TenantFeatureKey } from "@/config/tenant-features";
import { isTenantFeatureEnabled, resolveTenantFeatures } from "@/lib/features/tenant-feature-policy";
import { getMasterDataAccess } from "@/lib/master-data/tenant-master-data-access-data";
import type { MasterDataAccessResult, MasterDataOperation } from "@/lib/master-data/tenant-master-data-access";

export async function getTenantFeatureAccess(
  domain: string,
  feature: TenantFeatureKey,
  operation: "read" | "write",
): Promise<MasterDataAccessResult> {
  const access = await getMasterDataAccess(domain, operation satisfies MasterDataOperation);
  if (access.kind !== "authorized") return access;

  const [record] = await db
    .select({ settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, access.principal.tenantId))
    .limit(1);

  if (!record || !isTenantFeatureEnabled(record.settings, feature)) {
    return { kind: "forbidden", reason: "feature-disabled" };
  }

  return access;
}

export async function isTenantFeatureEnabledById(
  tenantId: string,
  feature: TenantFeatureKey,
): Promise<boolean> {
  const [record] = await db
    .select({ settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  return Boolean(record && isTenantFeatureEnabled(record.settings, feature));
}

export async function getResolvedTenantFeatures(tenantId: string) {
  const [record] = await db
    .select({ settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  return resolveTenantFeatures(record?.settings);
}
