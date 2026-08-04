import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantFeatureKey } from "@/config/tenant-features";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import type { TenantAuthorizationContext } from "@/lib/authorization/tenant-authorization";
import { getTenantFeatureAccess } from "@/lib/features/tenant-feature-access-data";

export async function enforceTenantOperation(
  domain: string,
  operationId: string,
  requestedPermissions?: readonly string[],
  context?: TenantAuthorizationContext,
) {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const result = await evaluator.evaluate({
    domain,
    operationId,
    surface: "api",
    requestedPermissions,
    context,
  });

  if (result.kind === "denied") {
    if (result.external.kind === "not-found") notFound();
    forbidden();
  }

  return result.principal;
}

export async function enforceTenantFeatureAccess(
  domain: string,
  feature: TenantFeatureKey,
  operation: "read" | "write" | "download",
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
