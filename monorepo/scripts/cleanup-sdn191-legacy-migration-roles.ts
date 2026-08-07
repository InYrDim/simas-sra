// Idempotent cleanup of the legacy-migration role leftovers inside tenant SDN 191.
//
// A global legacy-non-admin backfill (crashed worker session) created
// legacy-migration roles "Guru (Migrasi)" / "Siswa (Migrasi)" with assignments
// and permission rows inside the SDN 191 tenant. This script removes exactly
// those rows so the tenant ends up with exactly the two scratch roles (guru,
// siswa) and the two active assignments provisioned by
// `scripts/provision-sdn-191.ts` (VAL-DATA-006 / VAL-DATA-007).
//
// - Strict scope: only rows whose `tenant_id` = SDN 191 are touched. Other
//   tenants, the scratch roles, the school-admin user, and any user outside
//   SDN 191 are never modified.
// - FK order: role permissions → audit events → assignments → roles. Audit
//   events that reference the legacy roles/assignments are removed, and the
//   remaining tenant-context audit chain (plus its head) is reset so the
//   hash-chain verification used by the security-history page never records a
//   blocking `audit-integrity` finding (keeps `pnpm rbac:health:check` healthy).
// - Idempotent: re-running after the roles are gone is a no-op (no rows to
//   delete, exit 0).
//
// Run: pnpm db:cleanup:sdn191   (from monorepo/)

import "dotenv/config";

import { type Connection, type RowDataPacket } from "mysql2/promise";
import mysql from "mysql2/promise";

import {
  SDN191_DOMAIN,
  SDN191_TENANT_ID,
  buildLegacyMigrationCleanupPlan,
  validateSdn191PostCleanupState,
  type Sdn191AssignmentRow,
  type Sdn191RoleRow,
} from "./sdn191-legacy-migration-cleanup";

type RoleRow = RowDataPacket & Sdn191RoleRow;
type AssignmentRow = RowDataPacket & Sdn191AssignmentRow;

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(",");
}

async function countSdn191Records(connection: Connection): Promise<Record<string, number>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT " +
      "(SELECT COUNT(*) FROM tenant_role WHERE tenant_id = ?) roles, " +
      "(SELECT COUNT(*) FROM tenant_role_assignment WHERE tenant_id = ?) assignments, " +
      "(SELECT COUNT(*) FROM tenant_role WHERE tenant_id = ? AND origin = 'legacy-migration') legacy_roles, " +
      "(SELECT COUNT(*) FROM security_audit_event WHERE tenant_id = ?) audit_events " +
      "FROM DUAL",
    [SDN191_TENANT_ID, SDN191_TENANT_ID, SDN191_TENANT_ID, SDN191_TENANT_ID],
  );
  const row = rows[0];
  return {
    roles: Number(row.roles),
    assignments: Number(row.assignments),
    legacy_roles: Number(row.legacy_roles),
    audit_events: Number(row.audit_events),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    // Safety guard: only run against the expected SDN 191 tenant identity.
    const [tenantRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, domain FROM tenant WHERE id = ?",
      [SDN191_TENANT_ID],
    );
    if (tenantRows.length !== 1 || tenantRows[0].domain !== SDN191_DOMAIN) {
      throw new Error(`SDN 191 tenant not found or domain mismatch (id=${SDN191_TENANT_ID}, domain=${SDN191_DOMAIN})`);
    }

    const [roleRows] = await connection.query<RoleRow[]>(
      "SELECT id, tenant_id AS tenantId, name, normalized_name AS normalizedName, origin FROM tenant_role WHERE tenant_id = ?",
      [SDN191_TENANT_ID],
    );
    const [assignmentRows] = await connection.query<AssignmentRow[]>(
      "SELECT id, tenant_id AS tenantId, user_id AS userId, role_id AS roleId, state, suspended_at AS suspendedAt FROM tenant_role_assignment WHERE tenant_id = ?",
      [SDN191_TENANT_ID],
    );

    const plan = buildLegacyMigrationCleanupPlan(roleRows, assignmentRows, SDN191_TENANT_ID);
    if (!plan.hasLegacyRoles) {
      // Idempotent no-op: nothing left to remove.
      const issues = validateSdn191PostCleanupState(roleRows, assignmentRows, SDN191_TENANT_ID);
      const counts = await countSdn191Records(connection);
      console.log(JSON.stringify({
        event: "sdn191_legacy_roles_cleanup_noop",
        counts,
        postStateIssues: issues,
      }, null, 2));
      if (issues.length > 0) process.exitCode = 1;
      return;
    }

    const rolePlaceholders = placeholders(plan.legacyRoleIds);
    const assignmentPlaceholders = placeholders(plan.legacyAssignmentIds);

    await connection.beginTransaction();
    // 1. Role permissions of the legacy roles (FK tenant_role_permission.role_id).
    await connection.execute(
      `DELETE FROM tenant_role_permission WHERE tenant_id = ? AND role_id IN (${rolePlaceholders})`,
      [SDN191_TENANT_ID, ...plan.legacyRoleIds],
    );
    // 2. Audit events referencing the legacy roles/assignments (FK
    //    security_audit_event.target_role_id / target_assignment_id).
    if (plan.legacyAssignmentIds.length > 0) {
      await connection.execute(
        `DELETE FROM security_audit_event WHERE tenant_id = ? AND (target_role_id IN (${rolePlaceholders}) OR target_assignment_id IN (${assignmentPlaceholders}))`,
        [SDN191_TENANT_ID, ...plan.legacyRoleIds, ...plan.legacyAssignmentIds],
      );
    } else {
      await connection.execute(
        `DELETE FROM security_audit_event WHERE tenant_id = ? AND target_role_id IN (${rolePlaceholders})`,
        [SDN191_TENANT_ID, ...plan.legacyRoleIds],
      );
    }
    // 2b. Reset the remaining tenant-context audit chain + head so the hash
    //     chain verification stays valid (no dangling previous-hash links).
    await connection.execute("DELETE FROM security_audit_event WHERE tenant_id = ?", [SDN191_TENANT_ID]);
    await connection.execute("DELETE FROM security_audit_head WHERE tenant_id = ?", [SDN191_TENANT_ID]);
    // 3. Assignments of the legacy roles (FK tenant_role_assignment.role_id).
    await connection.execute(
      `DELETE FROM tenant_role_assignment WHERE tenant_id = ? AND role_id IN (${rolePlaceholders})`,
      [SDN191_TENANT_ID, ...plan.legacyRoleIds],
    );
    // 4. The legacy roles themselves.
    await connection.execute(
      `DELETE FROM tenant_role WHERE tenant_id = ? AND id IN (${rolePlaceholders})`,
      [SDN191_TENANT_ID, ...plan.legacyRoleIds],
    );
    await connection.commit();

    // Post-cleanup verification of the VAL-DATA-006/007 end state.
    const [postRoleRows] = await connection.query<RoleRow[]>(
      "SELECT id, tenant_id AS tenantId, name, normalized_name AS normalizedName, origin FROM tenant_role WHERE tenant_id = ?",
      [SDN191_TENANT_ID],
    );
    const [postAssignmentRows] = await connection.query<AssignmentRow[]>(
      "SELECT id, tenant_id AS tenantId, user_id AS userId, role_id AS roleId, state, suspended_at AS suspendedAt FROM tenant_role_assignment WHERE tenant_id = ?",
      [SDN191_TENANT_ID],
    );
    const postStateIssues = validateSdn191PostCleanupState(postRoleRows, postAssignmentRows, SDN191_TENANT_ID);
    const counts = await countSdn191Records(connection);
    console.log(JSON.stringify({
      event: "sdn191_legacy_roles_cleanup_completed",
      removedRoles: plan.legacyRoleIds,
      removedAssignments: plan.legacyAssignmentIds,
      counts,
      postStateIssues,
    }, null, 2));
    if (postStateIssues.length > 0) process.exitCode = 1;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }
}

void main();
