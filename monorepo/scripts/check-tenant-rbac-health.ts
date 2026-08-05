import "dotenv/config";

import mysql, { type RowDataPacket } from "mysql2/promise";

import { OPERATION_MAP_VERSION, PERMISSION_REGISTRY_VERSION } from "@/lib/authorization/tenant-rbac-contract";
import { TENANT_AUTHORIZATION_RESOLVER_VERSION } from "@/lib/authorization/tenant-authorization";
import { evaluateTenantRbacHealth, summarizeTenantRbacHealth, tenantRbacHealthExitCode, type TenantRbacGateStatus, type TenantRbacHealthSnapshot } from "@/lib/authorization/tenant-rbac-health";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

type RolloutRow = RowDataPacket & { tenantId: string; httpMode: TenantRbacHealthSnapshot["httpMode"]; workerMode: TenantRbacHealthSnapshot["workerMode"]; epoch: string; resolverVersion: string; registryVersion: string; operationMapVersion: string };
type FindingRow = RowDataPacket & { tenantId: string; reasonCode: string };

const reasonToGate: Readonly<Record<string, keyof TenantRbacHealthSnapshot["gates"]>> = {
  "rbac:unexplained-widening": "noUnexplainedWidening",
  "rbac:isolation-mismatch": "isolationMatch",
  "rbac:next-request-revocation-failure": "nextRequestRevocation",
  "rbac:worker-execution-authorization-failure": "workerExecution",
  "rbac:unsupported-version": "supportedVersion",
  "rbac:school-admin-coverage-violation": "schoolAdminCoverage",
};

async function main(): Promise<void> {
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const [rollouts] = await connection.query<RolloutRow[]>("SELECT tenant_id tenantId,http_mode httpMode,worker_mode workerMode,CAST(epoch AS CHAR) epoch,resolver_version resolverVersion,registry_version registryVersion,operation_map_version operationMapVersion FROM tenant_rbac_rollout ORDER BY tenant_id");
    const [findings] = await connection.query<FindingRow[]>("SELECT tenant_id tenantId,reason_code reasonCode FROM security_reconciliation_finding WHERE state='open' AND severity='blocking' AND tenant_id IS NOT NULL");
    const byTenant = new Map<string, FindingRow[]>();
    for (const finding of findings) byTenant.set(finding.tenantId, [...(byTenant.get(finding.tenantId) ?? []), finding]);
    const signals = rollouts.flatMap((row) => {
      const gates: TenantRbacHealthSnapshot["gates"] = { noUnexplainedWidening: "unknown", isolationMatch: "unknown", nextRequestRevocation: "unknown", workerExecution: "unknown", auditIntegrity: "unknown", supportedVersion: "unknown", schoolAdminCoverage: "unknown" };
      for (const finding of byTenant.get(row.tenantId) ?? []) {
        const gate = finding.reasonCode.startsWith("audit-integrity:") ? "auditIntegrity" : reasonToGate[finding.reasonCode];
        if (gate) (gates as Record<string, TenantRbacGateStatus>)[gate] = "failed";
      }
      return evaluateTenantRbacHealth({
        tenantId: row.tenantId, httpMode: row.httpMode, workerMode: row.workerMode, httpEpoch: row.epoch, workerEpoch: row.epoch,
        resolverVersion: row.resolverVersion, registryVersion: row.registryVersion, operationMapVersion: row.operationMapVersion,
        expectedVersions: { resolver: TENANT_AUTHORIZATION_RESOLVER_VERSION, registry: PERMISSION_REGISTRY_VERSION, operationMap: OPERATION_MAP_VERSION },
        emergencyReviewAt: null, gates,
      });
    });
    const report = { generatedAt: new Date().toISOString(), evidenceScope: "repository-database-state", externalAlertDeliveryVerified: false, summary: summarizeTenantRbacHealth(signals), signals };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = tenantRbacHealthExitCode(signals);
  } finally {
    await connection.end();
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: "tenant-rbac-health-check-failed", message: error instanceof Error ? error.message : "unknown-error" }));
  process.exitCode = 1;
});
