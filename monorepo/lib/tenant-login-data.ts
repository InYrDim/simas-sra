import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import type { TenantLoginStore } from "@/lib/tenant-login";

export const tenantLoginStore: TenantLoginStore = {
  async findByExactDomain(domain) {
    if (!domain || domain !== domain.toLowerCase()) return null;
    const [row] = await db
      .select({ id: tenant.id, domain: tenant.domain, name: tenant.name })
      .from(tenant)
      .where(eq(tenant.domain, domain))
      .limit(1);
    return row?.domain === domain ? row : null;
  },
};
