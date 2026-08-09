import { and, eq, inArray, count } from "drizzle-orm";

import {
  tenantRole,
  tenantRolePermission,
  tenantRoleAssignment,
  tenant,
  schoolAdminAuthority,
} from "@/db/schema";
import {
  createTenantRoleLifecycleService,
  type LifecycleRoleRow,
  type TenantRoleLifecycleRepository,
  type TenantRoleLifecycleService,
} from "@/lib/authorization/tenant-role-lifecycle";
import {
  createSecurityCommandService,
  SecurityCommandError,
} from "@/lib/authorization/security-command";
import {
  securityCommandStore,
  type MySqlSecurityCommandTransaction,
} from "@/lib/authorization/security-command-store";

const executeSecurityCommand = createSecurityCommandService<MySqlSecurityCommandTransaction>({
  store: securityCommandStore,
  reportSecuritySignal(signal) {
    console.warn({ event: signal.type, commandName: signal.commandName, contextKind: signal.context.kind });
  },
});

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

export function createTenantRoleLifecycleDataRepository(
  transaction: MySqlSecurityCommandTransaction,
): TenantRoleLifecycleRepository {
  const database = transaction.database;
  return {
    async lockTenant(tenantId) {
      assertIdentifier(tenantId);
      const [row] = await database
        .select({ id: tenant.id })
        .from(tenant)
        .where(eq(tenant.id, tenantId))
        .limit(1)
        .for("update");
      return row !== undefined;
    },

    async listRoles(tenantId) {
      assertIdentifier(tenantId);
      const rows = await database
        .select()
        .from(tenantRole)
        .where(eq(tenantRole.tenantId, tenantId))
        .for("update");

      if (rows.length === 0) return [];

      const permissions = await database
        .select({ roleId: tenantRolePermission.roleId, permissionKey: tenantRolePermission.permissionKey })
        .from(tenantRolePermission)
        .where(eq(tenantRolePermission.tenantId, tenantId))
        .for("update");

      const permsByRole = new Map<string, string[]>();
      for (const p of permissions) {
        let arr = permsByRole.get(p.roleId);
        if (!arr) {
          arr = [];
          permsByRole.set(p.roleId, arr);
        }
        arr.push(p.permissionKey);
      }

      return rows.map((row): LifecycleRoleRow => ({
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        normalizedName: row.normalizedName,
        description: row.description,
        lifecycle: row.lifecycle,
        origin: row.origin,
        templateKey: row.templateKey,
        templateVersion: row.templateVersion,
        copiedFromRoleId: row.copiedFromRoleId,
        legacyRole: row.legacyRole,
        version: row.version,
        permissions: permsByRole.get(row.id) ?? [],
      }));
    },

    async getRole(tenantId, roleId) {
      assertIdentifier(tenantId);
      assertIdentifier(roleId);
      const [row] = await database
        .select()
        .from(tenantRole)
        .where(and(
          eq(tenantRole.tenantId, tenantId),
          eq(tenantRole.id, roleId)
        ))
        .limit(1)
        .for("update");

      if (!row) return null;

      const permissions = await database
        .select({ permissionKey: tenantRolePermission.permissionKey })
        .from(tenantRolePermission)
        .where(and(
          eq(tenantRolePermission.tenantId, tenantId),
          eq(tenantRolePermission.roleId, roleId)
        ))
        .for("update");

      return {
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        normalizedName: row.normalizedName,
        description: row.description,
        lifecycle: row.lifecycle,
        origin: row.origin,
        templateKey: row.templateKey,
        templateVersion: row.templateVersion,
        copiedFromRoleId: row.copiedFromRoleId,
        legacyRole: row.legacyRole,
        version: row.version,
        permissions: permissions.map(p => p.permissionKey),
      };
    },

    async insertRole(row) {
      assertIdentifier(row.id);
      assertIdentifier(row.tenantId);
      await database.insert(tenantRole).values({
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        normalizedName: row.normalizedName,
        description: row.description ?? null,
        lifecycle: "draft",
        origin: row.origin,
        templateKey: row.templateKey ?? null,
        templateVersion: row.templateVersion ?? null,
        copiedFromRoleId: row.copiedFromRoleId ?? null,
        version: 1,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      });
    },

    async updateRole(input) {
      assertIdentifier(input.id);
      assertIdentifier(input.tenantId);
      const set: Partial<typeof tenantRole.$inferInsert> = {
        version: input.expectedVersion + 1,
        updatedAt: input.updatedAt,
      };
      if (input.name !== undefined) set.name = input.name;
      if (input.normalizedName !== undefined) set.normalizedName = input.normalizedName;
      if (input.description !== undefined) set.description = input.description;
      if (input.lifecycle !== undefined) set.lifecycle = input.lifecycle;

      const updated = await database.update(tenantRole).set(set).where(and(
        eq(tenantRole.id, input.id),
        eq(tenantRole.tenantId, input.tenantId),
        eq(tenantRole.version, input.expectedVersion),
      ));
      return updated[0].affectedRows === 1;
    },

    async insertPermissions(tenantId, roleId, permissions, createdAt) {
      assertIdentifier(tenantId);
      assertIdentifier(roleId);
      if (permissions.length === 0) return;
      await database.insert(tenantRolePermission).values(permissions.map(p => ({
        tenantId,
        roleId,
        permissionKey: p,
        createdAt,
      })));
    },

    async deletePermissions(tenantId, roleId, permissions) {
      assertIdentifier(tenantId);
      assertIdentifier(roleId);
      if (permissions.length === 0) return;
      await database.delete(tenantRolePermission).where(and(
        eq(tenantRolePermission.tenantId, tenantId),
        eq(tenantRolePermission.roleId, roleId),
        inArray(tenantRolePermission.permissionKey, permissions)
      ));
    },

    async countActiveAssignments(tenantId, roleId) {
      assertIdentifier(tenantId);
      assertIdentifier(roleId);
      const [res] = await database
        .select({ count: count() })
        .from(tenantRoleAssignment)
        .where(and(
          eq(tenantRoleAssignment.tenantId, tenantId),
          eq(tenantRoleAssignment.roleId, roleId),
          eq(tenantRoleAssignment.state, "active")
        ))
        .for("share");
      return res?.count ?? 0;
    },

    async deleteRole(tenantId, roleId) {
      assertIdentifier(tenantId);
      assertIdentifier(roleId);
      await database.delete(tenantRolePermission).where(and(
        eq(tenantRolePermission.tenantId, tenantId),
        eq(tenantRolePermission.roleId, roleId),
      ));
      await database.delete(tenantRoleAssignment).where(and(
        eq(tenantRoleAssignment.tenantId, tenantId),
        eq(tenantRoleAssignment.roleId, roleId),
      ));
      await database.delete(tenantRole).where(and(
        eq(tenantRole.tenantId, tenantId),
        eq(tenantRole.id, roleId),
      ));
    },

    async isSchoolAdmin(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      const [authority] = await database
        .select({ id: schoolAdminAuthority.id })
        .from(schoolAdminAuthority)
        .where(and(
          eq(schoolAdminAuthority.tenantId, tenantId),
          eq(schoolAdminAuthority.userId, userId),
          eq(schoolAdminAuthority.authorityState, "active")
        ))
        .limit(1)
        .for("share");

      return authority !== undefined;
    },
  };
}

export function createTenantRoleLifecycleDataService(): TenantRoleLifecycleService {
  return createTenantRoleLifecycleService<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createTenantRoleLifecycleDataRepository,
  });
}
