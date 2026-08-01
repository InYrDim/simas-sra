import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  schoolAdminAuthority,
  tenant,
  tenantAccountSecurity,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
  user,
} from "@/db/schema";
import { SecurityCommandError } from "@/lib/authorization/security-command";
import {
  projectEffectiveAccess,
  type AssignmentRoleRow,
  type EffectiveAccessPermission,
} from "@/lib/authorization/tenant-role-assignment";
import {
  tenantOperationMap,
  type OperationEntitlement,
} from "@/lib/authorization/tenant-rbac-contract";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import type { TenantFeatureKey } from "@/config/tenant-features";

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function entitlementFeature(entitlement: OperationEntitlement, write: boolean): TenantFeatureKey | null {
  if (entitlement === "MD") return write ? "masterDataWrite" : "masterDataRead";
  if (entitlement === "PPDB-R") return "ppdbRead";
  if (entitlement === "PPDB-W") return "ppdbWrite";
  if (entitlement === "QUIZ-R") return "ulanganRead";
  if (entitlement === "QUIZ-W") return "ulanganWrite";
  return null;
}

function enrichAvailability(
  permissions: readonly EffectiveAccessPermission[],
  settings: unknown,
): readonly EffectiveAccessPermission[] {
  return permissions.map((permission) => {
    const operations = tenantOperationMap.filter((operation) =>
      operation.lifecycle === "active"
      && operation.requiredPermissions.includes(permission.key),
    );
    const disabled = [...new Set(operations
      .map((operation) => entitlementFeature(operation.entitlement, operation.operationalGate === "write"))
      .filter((feature): feature is TenantFeatureKey => feature !== null)
      .filter((feature) => !isTenantFeatureEnabled(settings, feature)))];
    const contextualLimitations = [...new Set([
      ...permission.contextualLimitations,
      ...operations
        .filter((operation) => !["tenant-wide", "none", "school-admin-only"].includes(operation.contextualPolicy))
        .map((operation) => `Konteks ${operation.contextualPolicy}: ${operation.relationship}`),
    ])];
    return {
      ...permission,
      unavailableEntitlement: disabled.length > 0 ? disabled.join(", ") : null,
      contextualLimitations,
    };
  });
}

export type AssignmentAccountAccess = Readonly<{
  userId: string;
  name: string;
  email: string;
  lifecycle: "pending-activation" | "active" | "inactive";
  assignmentVersion: number;
  roleIds: readonly string[];
  effectiveAccess: readonly EffectiveAccessPermission[];
}>;

export async function getAssignmentAccountAccess(
  tenantId: string,
  userId: string,
): Promise<AssignmentAccountAccess | null> {
  assertIdentifier(tenantId);
  assertIdentifier(userId);
  const [account] = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      legacyRole: user.tenantRole,
      lifecycle: tenantAccountSecurity.lifecycle,
      assignmentVersion: tenantAccountSecurity.assignmentVersion,
      settings: tenant.settings,
    })
    .from(user)
    .innerJoin(tenantAccountSecurity, and(
      eq(tenantAccountSecurity.tenantId, user.tenantId),
      eq(tenantAccountSecurity.userId, user.id),
    ))
    .innerJoin(tenant, eq(tenant.id, user.tenantId))
    .where(and(eq(user.tenantId, tenantId), eq(user.id, userId)))
    .limit(1);
  if (!account || account.legacyRole === "school-admin") return null;
  const [authority] = await db
    .select({ id: schoolAdminAuthority.id })
    .from(schoolAdminAuthority)
    .where(and(
      eq(schoolAdminAuthority.tenantId, tenantId),
      eq(schoolAdminAuthority.userId, userId),
      eq(schoolAdminAuthority.authorityState, "active"),
    ))
    .limit(1);
  if (authority) return null;

  const rows = await db
    .select({
      roleId: tenantRole.id,
      roleName: tenantRole.name,
      roleLifecycle: tenantRole.lifecycle,
      permissionKey: tenantRolePermission.permissionKey,
    })
    .from(tenantRoleAssignment)
    .innerJoin(tenantRole, and(
      eq(tenantRole.id, tenantRoleAssignment.roleId),
      eq(tenantRole.tenantId, tenantRoleAssignment.tenantId),
    ))
    .leftJoin(tenantRolePermission, and(
      eq(tenantRolePermission.roleId, tenantRole.id),
      eq(tenantRolePermission.tenantId, tenantRole.tenantId),
    ))
    .where(and(
      eq(tenantRoleAssignment.tenantId, tenantId),
      eq(tenantRoleAssignment.userId, userId),
      eq(tenantRoleAssignment.state, "active"),
      eq(tenantRole.lifecycle, "active"),
    ))
    .orderBy(asc(tenantRole.normalizedName), asc(tenantRolePermission.permissionKey));
  const roles = new Map<string, AssignmentRoleRow>();
  for (const row of rows) {
    const existing = roles.get(row.roleId);
    if (existing) {
      if (row.permissionKey !== null) {
        roles.set(row.roleId, { ...existing, permissions: [...existing.permissions, row.permissionKey] });
      }
    } else {
      roles.set(row.roleId, {
        id: row.roleId,
        tenantId,
        name: row.roleName,
        lifecycle: row.roleLifecycle,
        permissions: row.permissionKey === null ? [] : [row.permissionKey],
      });
    }
  }
  const roleRows = [...roles.values()];
  return {
    userId: account.userId,
    name: account.name,
    email: account.email,
    lifecycle: account.lifecycle,
    assignmentVersion: account.assignmentVersion,
    roleIds: roleRows.map((role) => role.id).sort(),
    effectiveAccess: enrichAvailability(projectEffectiveAccess(roleRows), account.settings),
  };
}
