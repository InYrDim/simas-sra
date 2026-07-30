import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantFeatureKey } from "@/config/tenant-features";
import { getTenantFeatureAccess } from "@/lib/features/tenant-feature-access-data";

export async function enforceTenantFeatureAccess(
  domain: string,
  feature: TenantFeatureKey,
  operation: "read" | "write",
) {
  const access = await getTenantFeatureAccess(domain, feature, operation);
  if (access.kind === "not-found") notFound();
  if (access.kind === "forbidden") {
    console.warn({
      event: "tenant_feature_access_denied",
      domain,
      feature,
      operation,
      reason: access.reason,
    });
    forbidden();
  }
  return access.principal;
}
