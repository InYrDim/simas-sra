import "dotenv/config";

import { readFile } from "node:fs/promises";

import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

import {
  auditApplicantIdentityMigration,
  planApplicantOwnershipBackfill,
  type ApplicantIdentityMigrationSnapshot,
  type OwnershipMapping,
} from "@/lib/applicant-identity-migration";

interface UserRow extends RowDataPacket {
  id: string;
  tenantId: string | null;
  tenantRole: string | null;
}
interface IdRow extends RowDataPacket { userId: string }
interface BindingRow extends RowDataPacket {
  id: string;
  userId: string;
  canonicalNpsn: string;
}
interface ApplicationRow extends RowDataPacket {
  id: string;
  npsn: string;
  status: "pending" | "approved" | "rejected";
  ownerUserId: string | null;
  bindingId: string | null;
  attemptNumber: number | null;
  idempotencyKey: string | null;
  payloadHash: string | null;
  approvedTenantId: string | null;
  submittedAt: Date;
}
interface TenantRow extends RowDataPacket {
  id: string;
  npsn: string;
  sourceApplicationId: string;
}
interface ActivationRow extends RowDataPacket {
  userId: string;
  tenantId: string;
  temporaryCredentialIssuedAt: Date;
  firstAuthenticatedAt: Date | null;
  passwordChangedAt: Date | null;
}

async function loadSnapshot(connection: Connection): Promise<ApplicantIdentityMigrationSnapshot> {
  const [users] = await connection.query<UserRow[]>(`
    SELECT id, tenant_id AS tenantId, tenant_role AS tenantRole
    FROM user
    ORDER BY id
  `);
  const [providerAdmins] = await connection.query<IdRow[]>(`
    SELECT user_id AS userId FROM provider_admin ORDER BY user_id
  `);
  const [applicants] = await connection.query<IdRow[]>(`
    SELECT user_id AS userId FROM applicant ORDER BY user_id
  `);
  const [bindings] = await connection.query<BindingRow[]>(`
    SELECT id, user_id AS userId, canonical_npsn AS canonicalNpsn
    FROM applicant_school_binding
    ORDER BY id
  `);
  const [applications] = await connection.query<ApplicationRow[]>(`
    SELECT
      id,
      npsn,
      status,
      owner_user_id AS ownerUserId,
      binding_id AS bindingId,
      attempt_number AS attemptNumber,
      idempotency_key AS idempotencyKey,
      payload_hash AS payloadHash,
      approved_tenant_id AS approvedTenantId,
      submitted_at AS submittedAt
    FROM simas_application
    ORDER BY id
  `);
  const [tenants] = await connection.query<TenantRow[]>(`
    SELECT id, npsn, source_application_id AS sourceApplicationId
    FROM tenant
    ORDER BY id
  `);
  const [activations] = await connection.query<ActivationRow[]>(`
    SELECT
      user_id AS userId,
      tenant_id AS tenantId,
      temporary_credential_issued_at AS temporaryCredentialIssuedAt,
      first_authenticated_at AS firstAuthenticatedAt,
      password_changed_at AS passwordChangedAt
    FROM school_admin_activation
    ORDER BY user_id
  `);

  return {
    users,
    providerAdminUserIds: providerAdmins.map(({ userId }) => userId),
    applicantUserIds: applicants.map(({ userId }) => userId),
    bindings,
    applications,
    tenants,
    activations,
  };
}

function parseMappings(value: unknown): OwnershipMapping[] {
  if (!Array.isArray(value)) throw new Error("Mapping file must contain a JSON array.");
  return value.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("applicationId" in entry) ||
      !("ownerUserId" in entry) ||
      typeof entry.applicationId !== "string" ||
      typeof entry.ownerUserId !== "string"
    ) {
      throw new Error(`Invalid mapping at array index ${index}.`);
    }
    return { applicationId: entry.applicationId, ownerUserId: entry.ownerUserId };
  });
}

async function applyBackfill(
  connection: Connection,
  operations: Extract<ReturnType<typeof planApplicantOwnershipBackfill>, { ok: true }>["operations"],
) {
  await connection.beginTransaction();
  try {
    for (const operation of operations) {
      if (operation.type === "ensure-applicant") {
        await connection.execute(
          "INSERT IGNORE INTO applicant (user_id) VALUES (?)",
          [operation.userId],
        );
      } else if (operation.type === "ensure-binding") {
        await connection.execute(
          `INSERT INTO applicant_school_binding (id, user_id, canonical_npsn)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE id = VALUES(id)`,
          [operation.id, operation.userId, operation.canonicalNpsn],
        );
      } else {
        const [result] = await connection.execute<mysql.ResultSetHeader>(
          `UPDATE simas_application
           SET owner_user_id = ?, binding_id = ?, attempt_number = ?,
               idempotency_key = ?, payload_hash = ?
           WHERE id = ?
             AND owner_user_id IS NULL
             AND binding_id IS NULL
             AND attempt_number IS NULL
             AND idempotency_key IS NULL
             AND payload_hash IS NULL`,
          [
            operation.ownerUserId,
            operation.bindingId,
            operation.attemptNumber,
            operation.idempotencyKey,
            operation.payloadHash,
            operation.applicationId,
          ],
        );
        if (result.affectedRows !== 1) {
          throw new Error(
            `Application ${operation.applicationId} changed after planning; backfill rolled back.`,
          );
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const mode = process.argv[2] ?? "audit";
  if (mode !== "audit" && mode !== "backfill") {
    throw new Error("Usage: migrate-applicant-identities.ts [audit|backfill <mapping.json>]");
  }

  const connection = await mysql.createConnection({
    uri: databaseUrl,
    dateStrings: false,
  });
  try {
    let snapshot = await loadSnapshot(connection);
    if (mode === "backfill") {
      const mappingPath = process.argv[3];
      if (!mappingPath) throw new Error("Backfill mode requires a mapping JSON path.");
      const mappings = parseMappings(JSON.parse(await readFile(mappingPath, "utf8")));
      const plan = planApplicantOwnershipBackfill(snapshot, mappings);
      if (!plan.ok) {
        console.error(JSON.stringify(plan, null, 2));
        process.exitCode = 1;
        return;
      }
      await applyBackfill(connection, plan.operations);
      console.log(`Applied ${plan.operations.length} backfill operation(s).`);
      snapshot = await loadSnapshot(connection);
    }

    const report = auditApplicantIdentityMigration(snapshot);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error("Applicant identity migration failed:", error);
  process.exitCode = 1;
});
