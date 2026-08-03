"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { createConsumeTenantLifecycleCaseService } from "@/lib/authorization/tenant-account-lifecycle-data";
import { eq } from "drizzle-orm";

export async function consumeLifecycleCaseAction(domain: string, caseId: string, formData: FormData) {
  const secret = String(formData.get("secret") ?? "");
  const [row] = await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.domain, domain)).limit(1);
  if (!row) redirect("/login?error=invalid-lifecycle-link");
  try {
    const result = await createConsumeTenantLifecycleCaseService()({ tenantId: row.id, caseId, secret, correlationId: randomUUID(), idempotencyKey: randomUUID() });
    redirect(`/${encodeURIComponent(domain)}/account-lifecycle/${encodeURIComponent(caseId)}?status=${result.status}`);
  } catch {
    redirect(`/${encodeURIComponent(domain)}/account-lifecycle/${encodeURIComponent(caseId)}?error=invalid-or-expired`);
  }
}
