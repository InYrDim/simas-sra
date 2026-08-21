import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantFeatureKey } from "@/config/tenant-features";
import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import type { TenantAuthorizationContext } from "@/lib/authorization/tenant-authorization";
import { getTenantFeatureAccess } from "@/lib/features/tenant-feature-access-data";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";

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

// Enforces only the Provider feature flag (no school-admin requirement), so
// RBAC-assigned non-admins (e.g. students with absensi.attendance.view) can
// reach student-facing features. Permission/role enforcement stays in RBAC.
export async function enforceTenantFeatureEnabled(
  domain: string,
  feature: TenantFeatureKey,
) {
  const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
  if (!tenant) notFound();
  if (!isTenantFeatureEnabled(tenant.settings, feature)) {
    console.warn({
      event: "tenant_feature_access_denied",
      domain,
      feature,
      operation: "read",
      reason: "feature-disabled",
    });
    forbidden();
  }
}
