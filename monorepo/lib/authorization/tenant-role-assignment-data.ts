import { and, asc, eq, inArray, like, or } from "drizzle-orm";

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
import {
  createSecurityCommandService,
  SecurityCommandError,
} from "@/lib/authorization/security-command";
import {
  securityCommandStore,
  type MySqlSecurityCommandTransaction,
} from "@/lib/authorization/security-command-store";
import {
  createTenantRoleAssignmentService,
  type AssignmentRoleRow,
  type TenantRoleAssignmentRepository,
  type TenantRoleAssignmentService,
} from "@/lib/authorization/tenant-role-assignment";
import {
  createTenantRoleBulkAssignmentService,
  type BulkRolePreviewInput,
  type BulkRolePreviewResult,
} from "@/lib/authorization/tenant-role-bulk-assignment";

const executeSecurityCommand = createSecurityCommandService<MySqlSecurityCommandTransaction>({
  store: securityCommandStore,
  reportSecuritySignal(signal) {
    console.warn({
      event: signal.type,
      commandName: signal.commandName,
      contextKind: signal.context.kind,
    });
  },
});

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

export function createTenantRoleAssignmentDataRepository(
  transaction: MySqlSecurityCommandTransaction,
): TenantRoleAssignmentRepository {
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

    async isSchoolAdmin(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      const [account] = await database
        .select({ legacyRole: user.tenantRole })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.id, userId)))
        .limit(1)
        .for("share");
      if (!account) return false;
      if (account.legacyRole === "school-admin") return true;
      const [authority] = await database
        .select({ id: schoolAdminAuthority.id })
        .from(schoolAdminAuthority)
        .where(and(
          eq(schoolAdminAuthority.tenantId, tenantId),
          eq(schoolAdminAuthority.userId, userId),
          eq(schoolAdminAuthority.authorityState, "active"),
          eq(schoolAdminAuthority.authorityState, "active"),
        ))
        .limit(1)
        .for("share");
      return authority !== undefined;
    },

    async getAccount(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      const [account] = await database
        .select({
          userId: user.id,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          legacyRole: user.tenantRole,
          lifecycle: tenantAccountSecurity.lifecycle,
          assignmentVersion: tenantAccountSecurity.assignmentVersion,
        })
        .from(user)
        .innerJoin(tenantAccountSecurity, and(
          eq(tenantAccountSecurity.tenantId, user.tenantId),
          eq(tenantAccountSecurity.userId, user.id),
        ))
        .where(and(eq(user.tenantId, tenantId), eq(user.id, userId)))
        .limit(1)
        .for("update");
      if (!account || account.tenantId === null) return null;

      const [authority] = await database
        .select({ id: schoolAdminAuthority.id })
        .from(schoolAdminAuthority)
        .where(and(
          eq(schoolAdminAuthority.tenantId, tenantId),
          eq(schoolAdminAuthority.userId, userId),
        ))
        .limit(1)
        .for("share");
      return {
        userId: account.userId,
        tenantId: account.tenantId,
        name: account.name,
        email: account.email,
        lifecycle: account.lifecycle,
        assignmentVersion: account.assignmentVersion,
        schoolAdmin: account.legacyRole === "school-admin" || authority !== undefined,
      };
    },

    async listActiveRoles(tenantId) {
      assertIdentifier(tenantId);
      const rows = await database
        .select({
          id: tenantRole.id,
          tenantId: tenantRole.tenantId,
          name: tenantRole.name,
          lifecycle: tenantRole.lifecycle,
          permissionKey: tenantRolePermission.permissionKey,
        })
        .from(tenantRole)
        .leftJoin(tenantRolePermission, and(
          eq(tenantRolePermission.tenantId, tenantRole.tenantId),
          eq(tenantRolePermission.roleId, tenantRole.id),
        ))
        .where(and(
          eq(tenantRole.tenantId, tenantId),
          eq(tenantRole.lifecycle, "active"),
        ))
        .orderBy(asc(tenantRole.normalizedName), asc(tenantRolePermission.permissionKey))
        .for("share");
      const roles = new Map<string, AssignmentRoleRow>();
      for (const row of rows) {
        const existing = roles.get(row.id);
        if (existing) {
          if (row.permissionKey !== null) {
            roles.set(row.id, { ...existing, permissions: [...existing.permissions, row.permissionKey] });
          }
        } else {
          roles.set(row.id, {
            id: row.id,
            tenantId: row.tenantId,
            name: row.name,
            lifecycle: row.lifecycle,
            permissions: row.permissionKey === null ? [] : [row.permissionKey],
          });
        }
      }
      return [...roles.values()];
    },

    async listAssignments(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      return database
        .select({
          assignmentId: tenantRoleAssignment.id,
          roleId: tenantRoleAssignment.roleId,
          state: tenantRoleAssignment.state,
          version: tenantRoleAssignment.version,
        })
        .from(tenantRoleAssignment)
        .where(and(
          eq(tenantRoleAssignment.tenantId, tenantId),
          eq(tenantRoleAssignment.userId, userId),
        ))
        .orderBy(asc(tenantRoleAssignment.roleId))
        .for("update");
    },

    async replaceActiveAssignments(input) {
      const updatedAccount = await database
        .update(tenantAccountSecurity)
        .set({
          assignmentVersion: input.expectedAssignmentVersion + 1,
          updatedAt: input.updatedAt,
        })
        .where(and(
          eq(tenantAccountSecurity.tenantId, input.tenantId),
          eq(tenantAccountSecurity.userId, input.userId),
          eq(tenantAccountSecurity.assignmentVersion, input.expectedAssignmentVersion),
        ));
      if (updatedAccount[0].affectedRows !== 1) return { updated: false, assignments: [] };

      const selected = new Set(input.roleIds);
      const existingByRole = new Map(input.existingAssignments.map((assignment) => [assignment.roleId, assignment]));
      const transitions = [];
      for (const roleId of input.roleIds) {
        const existing = existingByRole.get(roleId);
        if (!existing) {
          const assignmentId = input.createId();
          await database.insert(tenantRoleAssignment).values({
            id: assignmentId,
            tenantId: input.tenantId,
            userId: input.userId,
            roleId,
            state: "active",
            version: 1,
            assignedAt: input.updatedAt,
            suspendedAt: null,
            updatedAt: input.updatedAt,
          });
          transitions.push({ assignmentId, roleId, transition: "added" as const });
        } else if (existing.state === "suspended") {
          const reactivated = await database
            .update(tenantRoleAssignment)
            .set({
              state: "active",
              suspendedAt: null,
              version: existing.version + 1,
              updatedAt: input.updatedAt,
            })
            .where(and(
              eq(tenantRoleAssignment.tenantId, input.tenantId),
              eq(tenantRoleAssignment.id, existing.assignmentId),
              eq(tenantRoleAssignment.version, existing.version),
            ));
          if (reactivated[0].affectedRows !== 1) throw new SecurityCommandError("stale-version");
          transitions.push({ assignmentId: existing.assignmentId, roleId, transition: "reactivated" as const });
        } else {
          transitions.push({ assignmentId: existing.assignmentId, roleId, transition: "unchanged" as const });
        }
      }

      for (const existing of input.existingAssignments) {
        if (existing.state !== "active" || selected.has(existing.roleId)) continue;
        const suspended = await database
          .update(tenantRoleAssignment)
          .set({
            state: "suspended",
            suspendedAt: input.updatedAt,
            version: existing.version + 1,
            updatedAt: input.updatedAt,
          })
          .where(and(
            eq(tenantRoleAssignment.tenantId, input.tenantId),
            eq(tenantRoleAssignment.id, existing.assignmentId),
            eq(tenantRoleAssignment.version, existing.version),
          ));
        if (suspended[0].affectedRows !== 1) throw new SecurityCommandError("stale-version");
        transitions.push({
          assignmentId: existing.assignmentId,
          roleId: existing.roleId,
          transition: "suspended" as const,
        });
      }
      return { updated: true, assignments: transitions };
    },
  };
}

export function createTenantRoleAssignmentDataService(): TenantRoleAssignmentService {
  return createTenantRoleAssignmentService<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createTenantRoleAssignmentDataRepository,
  });
}

export function createTenantRoleBulkAssignmentDataService() {
  return createTenantRoleBulkAssignmentService<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createTenantRoleAssignmentDataRepository,
  });
}

export async function previewTenantRoleBulkAssignment(input: BulkRolePreviewInput): Promise<BulkRolePreviewResult> {
  return db.transaction(async (transaction) => {
    const controlled = {
      database: transaction,
    } as MySqlSecurityCommandTransaction;
    const repository = createTenantRoleAssignmentDataRepository(controlled);
    return createTenantRoleBulkAssignmentService<MySqlSecurityCommandTransaction>({
      execute: executeSecurityCommand,
      repository: createTenantRoleAssignmentDataRepository,
      readRepository: repository,
    }).preview(input);
  });
}

export type EligibleAssignmentAccount = Readonly<{
  userId: string;
  name: string;
  email: string;
  lifecycle: "pending-activation" | "active" | "inactive";
  assignmentVersion: number;
  activeRoleIds: readonly string[];
}>;

export async function listEligibleAssignmentAccounts(input: Readonly<{
  tenantId: string;
  query?: string;
  lifecycle?: "pending-activation" | "active" | "inactive";
  limit?: number;
}>): Promise<readonly EligibleAssignmentAccount[]> {
  assertIdentifier(input.tenantId);
  const query = input.query?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length > 100) throw new SecurityCommandError("invalid-command");
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const conditions = [
    eq(user.tenantId, input.tenantId),
    input.lifecycle ? eq(tenantAccountSecurity.lifecycle, input.lifecycle) : undefined,
    query ? or(like(user.name, `%${query}%`), like(user.email, `%${query}%`)) : undefined,
  ].filter((condition) => condition !== undefined);
  const accounts = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      legacyRole: user.tenantRole,
      lifecycle: tenantAccountSecurity.lifecycle,
      assignmentVersion: tenantAccountSecurity.assignmentVersion,
    })
    .from(user)
    .innerJoin(tenantAccountSecurity, and(
      eq(tenantAccountSecurity.tenantId, user.tenantId),
      eq(tenantAccountSecurity.userId, user.id),
    ))
    .where(and(...conditions))
    .orderBy(asc(user.name), asc(user.id))
    .limit(limit);
  const userIds = accounts
    .filter((account) => account.legacyRole !== "school-admin")
    .map((account) => account.userId);
  if (userIds.length === 0) return [];
  const [authorities, assignments] = await Promise.all([
    db.select({ userId: schoolAdminAuthority.userId })
      .from(schoolAdminAuthority)
      .where(and(
        eq(schoolAdminAuthority.tenantId, input.tenantId),
        inArray(schoolAdminAuthority.userId, userIds),
        eq(schoolAdminAuthority.authorityState, "active"),
      )),
    db.select({ userId: tenantRoleAssignment.userId, roleId: tenantRoleAssignment.roleId })
      .from(tenantRoleAssignment)
      .where(and(
        eq(tenantRoleAssignment.tenantId, input.tenantId),
        eq(tenantRoleAssignment.state, "active"),
        inArray(tenantRoleAssignment.userId, userIds),
      )),
  ]);
  const schoolAdmins = new Set(authorities.map((authority) => authority.userId));
  const rolesByUser = new Map<string, string[]>();
  for (const assignment of assignments) {
    const roleIds = rolesByUser.get(assignment.userId) ?? [];
    roleIds.push(assignment.roleId);
    rolesByUser.set(assignment.userId, roleIds);
  }
  return accounts
    .filter((account) => account.legacyRole !== "school-admin" && !schoolAdmins.has(account.userId))
    .map((account) => ({
      userId: account.userId,
      name: account.name,
      email: account.email,
      lifecycle: account.lifecycle,
      assignmentVersion: account.assignmentVersion,
      activeRoleIds: [...new Set(rolesByUser.get(account.userId) ?? [])].sort(),
    }));
}
