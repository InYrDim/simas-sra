

import { and, asc, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  securityReconciliationFinding,
  tenant,
  tenantRbacRollout,
} from "@/db/schema";
import type { RolloutMode } from "@/lib/authorization/tenant-rbac-rollout";

export type TenantRbacOperationsRow = Readonly<{
  tenantId: string;
  tenantName: string;
  httpMode: RolloutMode | null;
  workerMode: RolloutMode | null;
  epoch: string | null;
  resolverVersion: string | null;
  registryVersion: string | null;
  operationMapVersion: string | null;
  rolloutVersion: number | null;
  emergencyState: "active" | "inactive" | "unknown";
  rollbackEligibility: "eligible" | "ineligible" | "unknown";
  blockingFindingCount: number;
  evidenceAvailable: boolean;
}>;

type RolloutEvidenceRow = Readonly<{
  tenantId: string;
  tenantName: string;
  httpMode: RolloutMode | null;
  workerMode: RolloutMode | null;
  epoch: bigint | null;
  resolverVersion: string | null;
  registryVersion: string | null;
  operationMapVersion: string | null;
  overlayHash: string | null;
  multiRoleAcceptedAt: Date | null;
  rolloutVersion: number | null;
}>;

export function projectTenantRbacOperationsRow(
  row: RolloutEvidenceRow,
  blockingFindingCount: number,
): TenantRbacOperationsRow {
  const evidenceAvailable = row.rolloutVersion !== null;
  const emergencyState = !evidenceAvailable
    ? "unknown"
    : row.httpMode === "rbac-emergency" &&
        row.workerMode === "rbac-emergency" &&
        row.overlayHash !== null
      ? "active"
      : row.httpMode === "rbac-emergency" ||
          row.workerMode === "rbac-emergency" ||
          row.overlayHash !== null
        ? "unknown"
        : "inactive";
  const rollbackEligibility = !evidenceAvailable
    ? "unknown"
    : row.multiRoleAcceptedAt === null && emergencyState === "inactive"
      ? "eligible"
      : "ineligible";

  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    httpMode: evidenceAvailable ? row.httpMode : null,
    workerMode: evidenceAvailable ? row.workerMode : null,
    epoch: evidenceAvailable ? row.epoch?.toString() ?? null : null,
    resolverVersion: evidenceAvailable ? row.resolverVersion : null,
    registryVersion: evidenceAvailable ? row.registryVersion : null,
    operationMapVersion: evidenceAvailable ? row.operationMapVersion : null,
    rolloutVersion: row.rolloutVersion,
    emergencyState,
    rollbackEligibility,
    blockingFindingCount,
    evidenceAvailable,
  };
}

export async function getTenantRbacOperationsDashboard() {
  const { requireProviderDataAccess } = await import("@/lib/provider/provider-access");
  await requireProviderDataAccess();

  const [rolloutRows, tenantFindingRows, globalFindingRow] = await Promise.all([
    db
      .select({
        tenantId: tenant.id,
        tenantName: tenant.name,
        httpMode: tenantRbacRollout.httpMode,
        workerMode: tenantRbacRollout.workerMode,
        epoch: tenantRbacRollout.epoch,
        resolverVersion: tenantRbacRollout.resolverVersion,
        registryVersion: tenantRbacRollout.registryVersion,
        operationMapVersion: tenantRbacRollout.operationMapVersion,
        overlayHash: tenantRbacRollout.overlayHash,
        multiRoleAcceptedAt: tenantRbacRollout.multiRoleAcceptedAt,
        rolloutVersion: tenantRbacRollout.version,
      })
      .from(tenant)
      .leftJoin(tenantRbacRollout, eq(tenantRbacRollout.tenantId, tenant.id))
      .orderBy(asc(tenant.name), asc(tenant.id)),
    db
      .select({
        tenantId: securityReconciliationFinding.tenantId,
        value: count(),
      })
      .from(securityReconciliationFinding)
      .where(and(
        eq(securityReconciliationFinding.severity, "blocking"),
        eq(securityReconciliationFinding.state, "open"),
      ))
      .groupBy(securityReconciliationFinding.tenantId),
    db
      .select({ value: count() })
      .from(securityReconciliationFinding)
      .where(and(
        isNull(securityReconciliationFinding.tenantId),
        eq(securityReconciliationFinding.severity, "blocking"),
        eq(securityReconciliationFinding.state, "open"),
      )),
  ]);

  const findingsByTenant = new Map(
    tenantFindingRows.flatMap((row) => row.tenantId === null ? [] : [[row.tenantId, row.value] as const]),
  );
  const tenants = rolloutRows.map((row) =>
    projectTenantRbacOperationsRow(row, findingsByTenant.get(row.tenantId) ?? 0),
  );

  return {
    tenants,
    globalBlockingFindingCount: globalFindingRow[0]?.value ?? 0,
    missingEvidenceCount: tenants.filter((row) => !row.evidenceAvailable).length,
  };
}
