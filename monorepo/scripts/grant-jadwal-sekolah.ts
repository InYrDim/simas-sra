// One-shot idempotent grant for the Jadwal Sekolah relocation (ticket 07).
//
// Background: the Gerbang schedule pages moved from
// /absensi/settings/schedule (operation `absensi.settings.save` ->
// permission `absensi.settings.update`) to /jadwal/sekolah (new operations
// `jadwal.sekolah.*` -> new permissions `jadwal.sekolah.view|update`).
// Custom tenant roles that already hold `absensi.settings.update` must not
// silently lose access, so this script grants them the new keys in one pass.
//
// - Idempotent: rows already present are skipped (no duplicates, safe rerun).
// - Verified output: prints per-tenant/role counts; `verify` mode exits
//   non-zero when any role with `absensi.settings.update` still misses the
//   new keys.
// - Both keys must be registered, active, and tenant-assignable before any
//   write (mirrors validateCustomRolePermissions) or the script refuses.
//
// Run:  pnpm tsx scripts/grant-jadwal-sekolah.ts          (apply)
//       pnpm tsx scripts/grant-jadwal-sekolah.ts verify   (check only)

import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";

import { db, closeDatabasePool } from "@/db";
import { tenantRole, tenantRolePermission } from "@/db/schema";
import { permissionRegistry } from "@/lib/authorization/tenant-rbac-contract";

const OLD_KEY = "absensi.settings.update";
const NEW_KEYS = ["jadwal.sekolah.view", "jadwal.sekolah.update"] as const;

async function main(): Promise<number> {
  const verifyOnly = process.argv.includes("verify");

  // Refuse to grant keys that are not registered/active/assignable.
  for (const key of NEW_KEYS) {
    const def = permissionRegistry.find((candidate) => candidate.key === key);
    if (!def || def.lifecycle !== "active" || def.assignment !== "tenant-assignable") {
      console.error(JSON.stringify({ event: "grant_jadwal_sekolah_blocked", key, reason: "not-assignable" }));
      return 1;
    }
  }

  try {
    // Roles (any tenant) holding the old key.
    const holders = await db
      .selectDistinct({ tenantId: tenantRolePermission.tenantId, roleId: tenantRolePermission.roleId })
      .from(tenantRolePermission)
      .where(eq(tenantRolePermission.permissionKey, OLD_KEY));

    let granted = 0;
    const missing: Array<{ tenantId: string; roleId: string; key: string }> = [];
    const pendingAfter: Array<{ tenantId: string; roleId: string; key: string }> = [];

    for (const holder of holders) {
      const existing = await db
        .select({ permissionKey: tenantRolePermission.permissionKey })
        .from(tenantRolePermission)
        .where(
          and(
            eq(tenantRolePermission.tenantId, holder.tenantId),
            eq(tenantRolePermission.roleId, holder.roleId),
            inArray(tenantRolePermission.permissionKey, [...NEW_KEYS]),
          ),
        );
      const have = new Set(existing.map((row) => row.permissionKey));
      const toInsert = NEW_KEYS.filter((key) => !have.has(key));

      if (toInsert.length === 0) continue;
      missing.push(...toInsert.map((key) => ({ tenantId: holder.tenantId, roleId: holder.roleId, key })));

      if (verifyOnly) {
        pendingAfter.push(...toInsert.map((key) => ({ tenantId: holder.tenantId, roleId: holder.roleId, key })));
      } else {
        await db.insert(tenantRolePermission).values(
          toInsert.map((key) => ({
            tenantId: holder.tenantId,
            roleId: holder.roleId,
            permissionKey: key,
            createdAt: new Date(),
          })),
        );
        granted += toInsert.length;
      }
    }

    // Role labels make the output readable without leaking user data.
    const roleIds = [...new Set(holders.map((holder) => holder.roleId))];
    const roleRows = roleIds.length
      ? await db
          .select({ id: tenantRole.id, tenantId: tenantRole.tenantId, name: tenantRole.name })
          .from(tenantRole)
          .where(inArray(tenantRole.id, roleIds))
      : [];
    const roleName = new Map(roleRows.map((row) => [row.id, row.name]));

    console.log(
      JSON.stringify(
        {
          event: verifyOnly ? "grant_jadwal_sekolah_verify" : "grant_jadwal_sekolah_applied",
          rolesScanned: holders.length,
          granted: verifyOnly ? 0 : granted,
          pending: verifyOnly ? pendingAfter.length : 0,
          roles: holders.map((holder) => ({
            tenantId: holder.tenantId,
            role: roleName.get(holder.roleId) ?? holder.roleId,
          })),
          ok: missing.length === 0 || !verifyOnly,
        },
        null,
        2,
      ),
    );
    if (verifyOnly && missing.length > 0) return 1;
    return 0;
  } finally {
    await closeDatabasePool();
  }
}

void main().then((code) => {
  process.exitCode = code;
});
