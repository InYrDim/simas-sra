import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import {
  mergeTenantLandingPageSettings,
  readTenantLandingPageSettings,
} from "@/lib/tenant-landing-page";

export async function getPublicTenantLandingPage(domain: string) {
  const [row] = await db
    .select({ name: tenant.name, settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.domain, domain))
    .limit(1);

  return row
    ? { name: row.name, html: readTenantLandingPageSettings(row.settings).html }
    : null;
}

export async function getTenantLandingPageSettings(tenantId: string) {
  const [row] = await db
    .select({ settings: tenant.settings })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);

  return row ? readTenantLandingPageSettings(row.settings) : null;
}

export async function updateTenantLandingPage(tenantId: string, html: string) {
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
      .set({ settings: mergeTenantLandingPageSettings(row.settings, html) })
      .where(eq(tenant.id, tenantId));
    return true;
  });
}
