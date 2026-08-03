import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantAuthorizationResult } from "@/lib/authorization/tenant-authorization";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

export function enforceAuthorizedTenantOperation(
  result: TenantAuthorizationResult,
  audit: Readonly<{ domain: string; operationId: string }>,
) {
  if (result.kind === "authorized") return result.principal;
  console.warn({
    event: "tenant_operation_denied",
    domain: audit.domain,
    operationId: audit.operationId,
    reason: result.internal.code,
  });
  if (result.external.status === 404) notFound();
  forbidden();
}

export async function enforceTenantMasterDataOperation(
  domain: string,
  operationId: string,
  requestedPermissions?: readonly string[],
): Promise<MasterDataPrincipal> {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const result = await evaluator.evaluate({ surface: "api", domain, operationId, requestedPermissions });
  const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });
  const operation = tenantOperationMap.find((candidate) => candidate.id === operationId);
  if (!operation) throw new Error(`Unknown Tenant operation: ${operationId}`);
  return {
    userId: principal.userId,
    tenantId: principal.tenantId,
    role: "school-admin",
    capabilities: {
      read: true,
      write: operation.operationalGate === "write" || principal.schoolAdmin,
      downloadTemplate: false,
    },
    schoolAdmin: principal.schoolAdmin,
    permissions: principal.permissions,
  };
}
