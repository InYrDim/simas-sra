import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";

// Halaman publik /apply/[domain] tidak memerlukan login — Tenant diresolusi langsung dari domain.
export async function resolvePublicTenantId(domain: string): Promise<string | null> {
  const [row] = await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.domain, domain)).limit(1);
  return row?.id ?? null;
}
