// Idempotent M2 RBAC wiring: add the `absensi.attendance.view` permission to the
// `guru` role of tenant SDN 191.
//
// Background: the M1 provision run (scripts/provision-sdn-191.ts) intentionally
// gave guru & siswa only the permission keys that existed in the registry at M1
// (no `absensi.*` key existed). In M2 the `absensi.attendance.view` key was added
// to the registry (lib/authorization/tenant-rbac-contract.ts), so the guru role
// now closes that gap (VAL-DATA-008 / VAL-WIRE-001). Siswa stays without absensi.
//
// We DO NOT re-run the full provision here: it is not date/hash-preserving
// (resets approved_at / onboarding_completed_at / trial window / password hash).
// This script performs only the narrow, idempotent INSERT needed for M2, scoped
// strictly to the SDN 191 tenant and its `guru` role.
//
// - Strict scope: only tenant_id = SDN 191 and the normalized `guru` role.
//   No other tenant, role, or user is touched.
// - Idempotent: if `absensi.attendance.view` is already present in the role, the
//   script is a no-op (exit 0, no ER_DUP_ENTRY).
// - The key must be registered, active, and tenant-assignable before it is
//   assigned (mirrors validateCustomRolePermissions) or the script refuses.
//
// Run: pnpm db:assign:sdn191-guru-absensi   (from monorepo/)

import "dotenv/config";

import { type RowDataPacket } from "mysql2/promise";
import mysql from "mysql2/promise";

import { validateCustomRolePermissions } from "@/lib/authorization/tenant-rbac-contract";
import { ABSENSI_KEY_PREFIX, GURU_ROLE_PERMISSIONS } from "./sdn191-rbac-permissions";

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
const DOMAIN = "uptd-sdn-191-inpres-batunapara";

const ABSENSI_GURU_KEY = "absensi.attendance.view";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

  // Refuse to assign any absensi.* key not present in the registered & assignable plan.
  if (!GURU_ROLE_PERMISSIONS.includes(ABSENSI_GURU_KEY)) {
    throw new Error(`${ABSENSI_GURU_KEY} is not in GURU_ROLE_PERMISSIONS plan`);
  }
  const roleKeys = GURU_ROLE_PERMISSIONS.filter((key) => key.startsWith(ABSENSI_KEY_PREFIX));
  const validation = validateCustomRolePermissions([ABSENSI_GURU_KEY]);
  if (!validation.ok) {
    console.error(JSON.stringify({ event: "assign_absensi_blocked", issues: validation.issues }, null, 2));
    process.exitCode = 1;
    return;
  }

  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    // Safety guard: confirm the SDN 191 tenant identity before touching rows.
    const [tenantRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, domain FROM tenant WHERE id = ?",
      [TENANT_ID],
    );
    if (tenantRows.length !== 1 || tenantRows[0].domain !== DOMAIN) {
      throw new Error(`SDN 191 tenant not found or domain mismatch (id=${TENANT_ID}, domain=${DOMAIN})`);
    }

    const [roleRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = 'guru'",
      [TENANT_ID],
    );
    if (roleRows.length !== 1) {
      throw new Error(`Expected exactly one guru role in SDN 191, found ${roleRows.length}`);
    }
    const guruRoleId = roleRows[0].id as string;

    let inserted = 0;
    for (const key of [ABSENSI_GURU_KEY]) {
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ? AND permission_key = ? LIMIT 1",
        [TENANT_ID, guruRoleId, key],
      );
      if (existing.length === 0) {
        await connection.execute(
          "INSERT INTO tenant_role_permission (tenant_id, role_id, permission_key, created_at) VALUES (?, ?, ?, ?)",
          [TENANT_ID, guruRoleId, key, new Date()],
        );
        inserted += 1;
      }
    }

    const [after] = await connection.query<RowDataPacket[]>(
      "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ? ORDER BY permission_key",
      [TENANT_ID, guruRoleId],
    );
    console.log(JSON.stringify({
      event: inserted ? "sdn191_guru_absensi_assigned" : "sdn191_guru_absensi_noop",
      tenantId: TENANT_ID,
      roleId: guruRoleId,
      absensiGuruKeys: roleKeys,
      guruPermissionKeys: after.map((row) => row.permission_key),
      inserted,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

void main();
