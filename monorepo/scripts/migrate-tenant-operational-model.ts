import "dotenv/config";

import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

import {
  completedBackfillNeedsRestart,
  planTenantOperationalBackfillBatch,
  resolveLegacyTenantOperationalAccess,
  verifyTenantAccessShadow,
  type TenantOperationalMigrationRow,
} from "@/lib/tenant-operational-migration";

const migrationKey = "tenant-operational-model-v1";

interface TenantRow extends RowDataPacket, TenantOperationalMigrationRow {}
interface CheckpointRow extends RowDataPacket {
  lastTenantId: string | null;
  examinedCount: number;
  migratedCount: number;
  reconciliationCount: number;
  accessDifferenceCount: number;
  completedAt: Date | null;
}

async function loadCheckpoint(connection: Connection): Promise<CheckpointRow | null> {
  const [rows] = await connection.execute<CheckpointRow[]>(`
    SELECT last_tenant_id AS lastTenantId,
           examined_count AS examinedCount,
           migrated_count AS migratedCount,
           reconciliation_count AS reconciliationCount,
           access_difference_count AS accessDifferenceCount,
           completed_at AS completedAt
    FROM tenant_operational_migration_checkpoint
    WHERE migration_key = ?
  `, [migrationKey]);
  return rows[0] ?? null;
}

async function loadRows(
  connection: Connection,
  afterTenantId: string | null,
  batchSize: number,
): Promise<TenantOperationalMigrationRow[]> {
  const [rows] = await connection.execute<TenantRow[]>(`
    SELECT t.id,
           t.source_application_id AS sourceApplicationId,
           a.status AS sourceApplicationStatus,
           a.approved_tenant_id AS approvedTenantId,
           t.operational_status AS operationalStatus,
           t.reconciliation_status AS reconciliationStatus,
           t.deletion_waiting_days AS deletionWaitingDays,
           CASE
             WHEN JSON_VALID(t.settings)
              AND JSON_EXTRACT(t.settings, '$.deletionWaitingDays') BETWEEN 1 AND 365
             THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.settings, '$.deletionWaitingDays')) AS UNSIGNED)
             ELSE NULL
           END AS legacyWaitingDays
    FROM tenant t
    LEFT JOIN simas_application a ON a.id = t.source_application_id
    WHERE (? IS NULL OR t.id > ?)
    ORDER BY t.id
    LIMIT ${batchSize + 1}
  `, [afterTenantId, afterTenantId]);
  return rows;
}

async function countIncompleteTenants(connection: Connection) {
  const [rows] = await connection.execute<(RowDataPacket & { count: number })[]>(`
    SELECT COUNT(*) AS count FROM tenant
    WHERE operational_status IS NULL
       OR reconciliation_status IS NULL
       OR deletion_waiting_days IS NULL
  `);
  return rows[0]?.count ?? 0;
}

async function backfillBatch(connection: Connection, batchSize: number) {
  let checkpoint = await loadCheckpoint(connection);
  if (checkpoint?.completedAt) {
    const incompleteTenantCount = await countIncompleteTenants(connection);
    if (!completedBackfillNeedsRestart(checkpoint.completedAt, incompleteTenantCount)) {
      return { done: true, checkpoint } as const;
    }
    await connection.execute(`
      UPDATE tenant_operational_migration_checkpoint
      SET last_tenant_id = NULL, completed_at = NULL, updated_at = CURRENT_TIMESTAMP(3)
      WHERE migration_key = ?
    `, [migrationKey]);
    checkpoint = await loadCheckpoint(connection);
  }

  const rows = await loadRows(connection, checkpoint?.lastTenantId ?? null, batchSize);
  const plan = planTenantOperationalBackfillBatch(
    rows,
    checkpoint?.lastTenantId ?? null,
    batchSize,
  );
  const shadow = verifyTenantAccessShadow(plan.operations.map((operation) => ({
    tenantId: operation.tenantId,
    legacyAllowed: resolveLegacyTenantOperationalAccess(true),
    operationalStatus: operation.operationalStatus,
  })));

  await connection.beginTransaction();
  try {
    for (const operation of plan.operations) {
      const [result] = await connection.execute<mysql.ResultSetHeader>(`
        UPDATE tenant
        SET operational_status = ?, reconciliation_status = ?, deletion_waiting_days = ?
        WHERE id = ?
          AND operational_status IS NULL
          AND reconciliation_status IS NULL
          AND deletion_waiting_days IS NULL
      `, [
        operation.operationalStatus,
        operation.reconciliationStatus,
        operation.deletionWaitingDays,
        operation.tenantId,
      ]);
      if (result.affectedRows !== 1) {
        throw new Error(`Tenant ${operation.tenantId} changed after planning; batch rolled back.`);
      }
    }

    const completedAt = plan.hasMore ? null : new Date();
    await connection.execute(`
      INSERT INTO tenant_operational_migration_checkpoint (
        migration_key, last_tenant_id, examined_count, migrated_count,
        reconciliation_count, access_difference_count, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        last_tenant_id = VALUES(last_tenant_id),
        examined_count = examined_count + VALUES(examined_count),
        migrated_count = migrated_count + VALUES(migrated_count),
        reconciliation_count = reconciliation_count + VALUES(reconciliation_count),
        access_difference_count = access_difference_count + VALUES(access_difference_count),
        completed_at = VALUES(completed_at),
        updated_at = CURRENT_TIMESTAMP(3)
    `, [
      migrationKey,
      plan.checkpoint,
      plan.examined,
      plan.operations.length,
      plan.metrics.needsReconciliation,
      shadow.differences.length,
      completedAt,
    ]);
    await connection.commit();
    return { done: !plan.hasMore, plan, shadow } as const;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function verify(connection: Connection) {
  const [rows] = await connection.execute<(RowDataPacket & {
    id: string;
    operationalStatus: "active" | "closed" | null;
    reconciliationStatus: "not_required" | "needs_reconciliation" | null;
    deletionWaitingDays: number | null;
  })[]>(`
    SELECT id, operational_status AS operationalStatus,
           reconciliation_status AS reconciliationStatus,
           deletion_waiting_days AS deletionWaitingDays
    FROM tenant ORDER BY id
  `);
  const incomplete = rows.filter((row) =>
    row.operationalStatus === null ||
    row.reconciliationStatus === null ||
    row.deletionWaitingDays === null
  ).map((row) => row.id);
  const shadow = verifyTenantAccessShadow(rows.map((row) => ({
    tenantId: row.id,
    legacyAllowed: resolveLegacyTenantOperationalAccess(true),
    operationalStatus: row.operationalStatus,
  })));
  const checkpoint = await loadCheckpoint(connection);
  return {
    ok:
      incomplete.length === 0 &&
      checkpoint?.completedAt != null &&
      checkpoint.accessDifferenceCount === 0 &&
      shadow.ok,
    tenantCount: rows.length,
    incomplete,
    shadow,
    checkpoint,
  } as const;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const mode = process.argv[2] ?? "verify";
  const batchSize = Number(process.argv[3] ?? "100");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("Batch size must be an integer from 1 to 1000.");
  }
  if (mode !== "backfill" && mode !== "verify") {
    throw new Error("Usage: migrate-tenant-operational-model.ts [backfill|verify] [batch-size]");
  }

  const connection = await mysql.createConnection({ uri: databaseUrl, dateStrings: false });
  try {
    if (mode === "backfill") {
      let result;
      do {
        result = await backfillBatch(connection, batchSize);
        console.log(JSON.stringify(result, null, 2));
      } while (!result.done);
    }
    const report = await verify(connection);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error("Tenant operational migration failed:", error);
  process.exitCode = 1;
});
