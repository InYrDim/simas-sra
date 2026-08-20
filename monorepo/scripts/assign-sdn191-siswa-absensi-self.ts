// Idempotent M3 RBAC wiring: add the `absensi.self.view` permission to the
// `siswa` role of tenant SDN 191 so students can open /absensi/saya and generate
// their own gerbang QR.
//
// This is intentionally a narrow, idempotent INSERT scoped to SDN 191 + the
// normalized `siswa` role. It does NOT touch SISWA_ROLE_PERMISSIONS (that set
// stays as the M2 contract in sdn191-rbac-permissions.ts / VAL-DATA-008), nor
// does it re-run the full provision (not date/hash-preserving).
//
// - Strict scope: only tenant_id = SDN 191 and the normalized `siswa` role.
// - Idempotent: if `absensi.self.view` is already present, the script is a no-op.
// - The key must be registered, active, and tenant-assignable (mirrors
//   validateCustomRolePermissions) or the script refuses.
//
// Run: pnpm db:assign:sdn191-siswa-absensi-self   (from monorepo/)

import "dotenv/config";

import { type RowDataPacket } from "mysql2/promise";
import mysql from "mysql2/promise";

import { validateCustomRolePermissions } from "@/lib/authorization/tenant-rbac-contract";

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
const DOMAIN = "uptd-sdn-191-inpres-batunapara";

const SISWA_SELF_KEY = "absensi.self.view";

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

    const validation = validateCustomRolePermissions([SISWA_SELF_KEY]);
    if (!validation.ok) {
        console.error(JSON.stringify({ event: "assign_siswa_absensi_self_blocked", issues: validation.issues }, null, 2));
        process.exitCode = 1;
        return;
    }

    const connection = await mysql.createConnection({ uri: databaseUrl });
    try {
        const [tenantRows] = await connection.query<RowDataPacket[]>(
            "SELECT id, domain FROM tenant WHERE id = ?",
            [TENANT_ID],
        );
        if (tenantRows.length !== 1 || tenantRows[0].domain !== DOMAIN) {
            throw new Error(`SDN 191 tenant not found or domain mismatch (id=${TENANT_ID}, domain=${DOMAIN})`);
        }

        const [roleRows] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = 'siswa'",
            [TENANT_ID],
        );
        if (roleRows.length !== 1) {
            throw new Error(`Expected exactly one siswa role in SDN 191, found ${roleRows.length}`);
        }
        const siswaRoleId = roleRows[0].id as string;

        const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ? AND permission_key = ? LIMIT 1",
            [TENANT_ID, siswaRoleId, SISWA_SELF_KEY],
        );

        let inserted = 0;
        if (existing.length === 0) {
            await connection.execute(
                "INSERT INTO tenant_role_permission (tenant_id, role_id, permission_key, created_at) VALUES (?, ?, ?, ?)",
                [TENANT_ID, siswaRoleId, SISWA_SELF_KEY, new Date()],
            );
            inserted += 1;
        }

        const [after] = await connection.query<RowDataPacket[]>(
            "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ? ORDER BY permission_key",
            [TENANT_ID, siswaRoleId],
        );
        console.log(JSON.stringify({
            event: inserted ? "sdn191_siswa_absensi_self_assigned" : "sdn191_siswa_absensi_self_noop",
            tenantId: TENANT_ID,
            roleId: siswaRoleId,
            siswaPermissionKeys: after.map((row) => row.permission_key),
            inserted,
        }, null, 2));
    } finally {
        await connection.end();
    }
}

void main();
