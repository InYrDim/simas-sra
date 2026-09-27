import "dotenv/config";

import { sql } from "drizzle-orm";

import { closeDatabasePool, db } from "@/db";
import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
} from "@/lib/authorization/tenant-rbac-contract";
import { TENANT_AUTHORIZATION_RESOLVER_VERSION } from "@/lib/authorization/tenant-authorization";

const EXECUTE = process.argv.includes("--execute");

type RolloutRow = {
  tenantId: string;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
};

async function main(): Promise<void> {
  const result = await db.execute(
    sql`SELECT tenant_id AS "tenantId", resolver_version AS "resolverVersion", registry_version AS "registryVersion", operation_map_version AS "operationMapVersion" FROM tenant_rbac_rollout ORDER BY tenant_id`,
  );
  const rows = ((result as { rows?: unknown }).rows ?? result) as RolloutRow[];
  const stale = rows.filter(
    (row) =>
      row.resolverVersion !== TENANT_AUTHORIZATION_RESOLVER_VERSION ||
      row.registryVersion !== PERMISSION_REGISTRY_VERSION ||
      row.operationMapVersion !== OPERATION_MAP_VERSION,
  );
  console.info({ mode: EXECUTE ? "EXECUTE" : "DRY-RUN", rolloutCount: rows.length, staleCount: stale.length });
  for (const row of stale) {
    console.info({
      tenantId: row.tenantId,
      resolver: [row.resolverVersion, TENANT_AUTHORIZATION_RESOLVER_VERSION],
      registry: [row.registryVersion, PERMISSION_REGISTRY_VERSION],
      operationMap: [row.operationMapVersion, OPERATION_MAP_VERSION],
    });
    if (!EXECUTE) continue;
    await db.execute(
      sql`UPDATE tenant_rbac_rollout SET resolver_version = ${TENANT_AUTHORIZATION_RESOLVER_VERSION}, registry_version = ${PERMISSION_REGISTRY_VERSION}, operation_map_version = ${OPERATION_MAP_VERSION}, version = version + 1 WHERE tenant_id = ${row.tenantId}`,
    );
  }
  await closeDatabasePool();
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: "adopt-tenant-rbac-map-version-failed",
      message: error instanceof Error ? error.message : "unknown-error",
    }),
  );
  process.exitCode = 1;
});
