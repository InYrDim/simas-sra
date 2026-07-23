import { eq } from "drizzle-orm";

import { db } from "@/db";
import { simasApplication, tenant } from "@/db/schema";

export type PublicTenant = Readonly<{
  id: string;
  educationLevel: string;
  nisnRequired: boolean;
}>;

// Halaman publik /ppdb/[domain] tidak memerlukan login — Tenant diresolusi langsung dari domain.
export async function resolvePublicTenant(domain: string): Promise<PublicTenant | null> {
  const [row] = await db
    .select({ id: tenant.id, educationLevel: simasApplication.educationLevel })
    .from(tenant)
    .innerJoin(simasApplication, eq(tenant.sourceApplicationId, simasApplication.id))
    .where(eq(tenant.domain, domain))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    nisnRequired: row.educationLevel.trim().toUpperCase() !== "SD",
  };
}

export async function resolvePublicTenantId(domain: string): Promise<string | null> {
  return (await resolvePublicTenant(domain))?.id ?? null;
}
