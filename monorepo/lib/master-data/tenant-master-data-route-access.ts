import "server-only";

import { forbidden, notFound } from "next/navigation";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";
import type { MasterDataOperation, MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";
import { getMasterDataAccess } from "@/lib/master-data/tenant-master-data-access-data";

export async function enforceMasterDataAccess(domain: string, operation: MasterDataOperation) {
  const access = await getMasterDataAccess(domain, operation);
  if (access.kind === "not-found") notFound();
  if (access.kind === "forbidden") {
    console.warn({
      event: "master_data_access_denied",
      domain,
      operation,
      reason: access.reason,
    });
    forbidden();
  }
  return access.principal;
}

/** Enforces a declared operation-map entry for academic routes and actions. */
export async function enforceAcademicAccess(domain: string, operationId: string, requestedPermissions?: readonly string[]): Promise<MasterDataPrincipal> {
  const operation = tenantOperationMap.find((candidate) => candidate.id === operationId);
  if (!operation || operation.lifecycle !== "active") notFound();

  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const result = await evaluator.evaluate({ domain, operationId, surface: "api", requestedPermissions });
  if (result.kind !== "authorized") {
    console.warn({ event: "academic_operation_denied", domain, operationId, reason: result.internal.code });
    if (result.external.kind === "not-found") notFound();
    forbidden();
  }

  const writePermission = operation.id.startsWith("ppdb.")
    ? [...result.principal.permissions].some((permission) => permission.startsWith("ppdb.") && !permission.endsWith(".view"))
    : operation.operationalGate === "write";
  return {
    userId: result.principal.userId,
    tenantId: result.principal.tenantId,
    role: "school-admin",
    capabilities: {
      read: true,
      write: result.principal.schoolAdmin || writePermission,
      downloadTemplate: false,
    },
    schoolAdmin: result.principal.schoolAdmin,
    permissions: result.principal.permissions,
    selfPersonId: result.principal.selfPersonId,
  };
}
