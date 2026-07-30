import "server-only";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import {
  isTenantFeatureEnabled,
  type TenantFeatureKey,
} from "@/lib/tenant-feature-policy";
import { eq } from "drizzle-orm";

export async function hasFeature(
  tenantId: string,
  feature: TenantFeatureKey,
): Promise<boolean> {
  const [row] = await db
    .select({ settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  return row ? isTenantFeatureEnabled(row.settings, feature) : false;
}
