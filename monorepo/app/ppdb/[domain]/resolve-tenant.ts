import { eq } from "drizzle-orm";

import { db } from "@/db";
import { simasApplication, tenant } from "@/db/schema";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";

export type PublicTenant = Readonly<{
  id: string;
  educationLevel: string;
  nisnRequired: boolean;
}>;

// Halaman publik /ppdb/[domain] tidak memerlukan login — Tenant diresolusi langsung dari domain.
export async function resolvePublicTenant(domain: string): Promise<PublicTenant | null> {
  const [row] = await db
    .select({
      id: tenant.id,
      educationLevel: simasApplication.educationLevel,
      settings: tenant.settings,
    })
    .from(tenant)
    .innerJoin(simasApplication, eq(tenant.sourceApplicationId, simasApplication.id))
    .where(eq(tenant.domain, domain))
    .limit(1);
  if (!row || !isTenantFeatureEnabled(row.settings, "ppdbPublic")) return null;
  return {
    id: row.id,
    educationLevel: row.educationLevel,
    nisnRequired: row.educationLevel.trim().toUpperCase() !== "SD",
  };
}

export async function resolvePublicTenantId(domain: string): Promise<string | null> {
  return (await resolvePublicTenant(domain))?.id ?? null;
}
