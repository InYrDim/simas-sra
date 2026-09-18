

import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  account,
  schoolAdminAuthority,
  schoolPerson,
  session,
  tenant,
  tenantAccountLifecycleCase,
  tenantAccountSecurity,
  tenantRole,
  tenantRoleAssignment,
  user,
} from "@/db/schema";
import {
  type AccountLifecycleRepository,
  createConsumeLifecycleCaseCommand,
  createTenantAccountLifecycleService,
  type TenantLifecycleAccount,
} from "@/lib/authorization/tenant-account-lifecycle";
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

function assertEmail(value: string): void {
  if (!value || value.length > 255 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function toLifecycleAccount(row: Readonly<{
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  lifecycle: "pending-activation" | "active" | "inactive";
  version: number;
  assignmentVersion: number;
  authorityId: string | null;
  linkedPersonId: string | null;
}>): TenantLifecycleAccount {
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    lifecycle: row.lifecycle,
    version: row.version,
    assignmentVersion: row.assignmentVersion,
    schoolAdmin: row.authorityId !== null,
    linkedPersonId: row.linkedPersonId,
  };
}

export function createTenantAccountLifecycleDataRepository(
  transaction: MySqlSecurityCommandTransaction,
): AccountLifecycleRepository {
  const database = transaction.database;

  async function loadAccount(tenantId: string, userId: string) {
    const [row] = await database
      .select({
        userId: user.id,
        tenantId: tenantAccountSecurity.tenantId,
        name: user.name,
        email: user.email,
        lifecycle: tenantAccountSecurity.lifecycle,
        version: tenantAccountSecurity.version,
        assignmentVersion: tenantAccountSecurity.assignmentVersion,
        authorityId: schoolAdminAuthority.id,
        linkedPersonId: schoolPerson.id,
      })
      .from(tenantAccountSecurity)
      .innerJoin(user, and(
        eq(user.tenantId, tenantAccountSecurity.tenantId),
        eq(user.id, tenantAccountSecurity.userId),
      ))
      .leftJoin(schoolAdminAuthority, and(
        eq(schoolAdminAuthority.tenantId, tenantAccountSecurity.tenantId),
        eq(schoolAdminAuthority.userId, tenantAccountSecurity.userId),
        eq(schoolAdminAuthority.authorityState, "active"),
      ))
      .leftJoin(schoolPerson, and(
        eq(schoolPerson.tenantId, tenantAccountSecurity.tenantId),
        eq(schoolPerson.accountUserId, tenantAccountSecurity.userId),
      ))
      .where(and(
        eq(tenantAccountSecurity.tenantId, tenantId),
        eq(tenantAccountSecurity.userId, userId),
      ))
      .limit(1)
      .for("update");
    return row ? toLifecycleAccount(row) : null;
  }

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
      const [row] = await database
        .select({ id: schoolAdminAuthority.id })
        .from(schoolAdminAuthority)
        .where(and(
          eq(schoolAdminAuthority.tenantId, tenantId),
          eq(schoolAdminAuthority.userId, userId),
          eq(schoolAdminAuthority.authorityState, "active"),
        ))
        .limit(1)
        .for("share");
      return row !== undefined;
    },

    async findIdentityByEmail(email) {
      assertEmail(email);
      const [identity] = await database
        .select({ id: user.id, tenantId: user.tenantId })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
        .for("update");
      if (!identity) return null;
      if (identity.tenantId) {
        const existing = await loadAccount(identity.tenantId, identity.id);
        if (existing) return existing;
      }
      return {
        userId: identity.id,
        tenantId: identity.tenantId ?? "",
        name: "",
        email,
        lifecycle: "inactive",
        version: 1,
        assignmentVersion: 1,
        schoolAdmin: false,
        linkedPersonId: null,
      };
    },

    async getAccount(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      return loadAccount(tenantId, userId);
    },

    async getPerson(tenantId, personId) {
      assertIdentifier(tenantId);
      assertIdentifier(personId);
      const [row] = await database
        .select({
          id: schoolPerson.id,
          tenantId: schoolPerson.tenantId,
          accountUserId: schoolPerson.accountUserId,
          archived: schoolPerson.archived,
        })
        .from(schoolPerson)
        .where(and(eq(schoolPerson.tenantId, tenantId), eq(schoolPerson.id, personId)))
        .limit(1)
        .for("update");
      return row ?? null;
    },

    async listRoles(tenantId) {
      assertIdentifier(tenantId);
      return database
        .select({ id: tenantRole.id, tenantId: tenantRole.tenantId, lifecycle: tenantRole.lifecycle })
        .from(tenantRole)
        .where(eq(tenantRole.tenantId, tenantId))
        .orderBy(asc(tenantRole.id))
        .for("share");
    },

    async listAssignments(tenantId, userId) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      return database
        .select({ id: tenantRoleAssignment.id, roleId: tenantRoleAssignment.roleId, state: tenantRoleAssignment.state, version: tenantRoleAssignment.version })
        .from(tenantRoleAssignment)
        .where(and(eq(tenantRoleAssignment.tenantId, tenantId), eq(tenantRoleAssignment.userId, userId)))
        .orderBy(asc(tenantRoleAssignment.roleId))
        .for("update");
    },

    async findPendingCase(tenantId, userId, kind) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      const [row] = await database
        .select({
          id: tenantAccountLifecycleCase.id,
          tenantId: tenantAccountLifecycleCase.tenantId,
          userId: tenantAccountLifecycleCase.userId,
          kind: tenantAccountLifecycleCase.kind,
          state: tenantAccountLifecycleCase.state,
          deliveryChannel: tenantAccountLifecycleCase.deliveryChannel,
          secretDigest: tenantAccountLifecycleCase.secretDigest,
          expiresAt: tenantAccountLifecycleCase.expiresAt,
          consumedAt: tenantAccountLifecycleCase.consumedAt,
          deliveryAttempts: tenantAccountLifecycleCase.deliveryAttempts,
          version: tenantAccountLifecycleCase.version,
          idempotencyKey: tenantAccountLifecycleCase.idempotencyKey,
          createdAt: tenantAccountLifecycleCase.createdAt,
          updatedAt: tenantAccountLifecycleCase.updatedAt,
        })
        .from(tenantAccountLifecycleCase)
        .where(and(
          eq(tenantAccountLifecycleCase.tenantId, tenantId),
          eq(tenantAccountLifecycleCase.userId, userId),
          eq(tenantAccountLifecycleCase.kind, kind),
          eq(tenantAccountLifecycleCase.state, "pending"),
        ))
        .limit(1)
        .for("update");
      if (!row || row.secretDigest === null || row.expiresAt === null) return null;
      return { ...row, secretDigest: row.secretDigest, expiresAt: row.expiresAt };
    },

    async lockCase(tenantId, caseId) {
      assertIdentifier(tenantId);
      assertIdentifier(caseId);
      const [row] = await database
        .select()
        .from(tenantAccountLifecycleCase)
        .where(and(eq(tenantAccountLifecycleCase.tenantId, tenantId), eq(tenantAccountLifecycleCase.id, caseId)))
        .limit(1)
        .for("update");
      if (!row || row.secretDigest === null || row.expiresAt === null) return null;
      return { ...row, secretDigest: row.secretDigest, expiresAt: row.expiresAt };
    },

    async completeCase(tenantId, caseId, consumedAt) {
      const updated = await database.update(tenantAccountLifecycleCase).set({
        state: "completed",
        consumedAt,
        version: sql`${tenantAccountLifecycleCase.version} + 1`,
        updatedAt: consumedAt,
      }).where(and(
        eq(tenantAccountLifecycleCase.tenantId, tenantId),
        eq(tenantAccountLifecycleCase.id, caseId),
        eq(tenantAccountLifecycleCase.state, "pending"),
      ));
      return updated.rowCount === 1;
    },

    async activateConsumedAccount(tenantId, userId, updatedAt) {
      const updated = await database.update(tenantAccountSecurity).set({
        lifecycle: "active",
        version: sql`${tenantAccountSecurity.version} + 1`,
        activatedAt: updatedAt,
        deactivatedAt: null,
        updatedAt,
      }).where(and(
        eq(tenantAccountSecurity.tenantId, tenantId),
        eq(tenantAccountSecurity.userId, userId),
        eq(tenantAccountSecurity.lifecycle, "pending-activation"),
      ));
      return updated.rowCount === 1;
    },

    async resetCredential(tenantId, userId, credential, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      if (!credential || credential.length > 512) throw new SecurityCommandError("invalid-command");
      const password = await hashPassword(credential);
      const updated = await database.update(account).set({
        password,
        updatedAt,
      }).where(and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
      ));
      return updated.rowCount === 1;
    },

    async createAccount(input) {
      assertIdentifier(input.userId);
      assertIdentifier(input.accountId);
      assertIdentifier(input.tenantId);
      const passwordHash = await hashPassword(input.initialCredential);
      await database.insert(user).values({
        id: input.userId,
        tenantId: input.tenantId,
        tenantRole: null,
        name: input.name,
        email: input.email,
        emailVerified: input.lifecycle === "active",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      await database.insert(account).values({
        id: input.accountId,
        accountId: input.userId,
        providerId: "credential",
        userId: input.userId,
        password: passwordHash,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      await database.insert(tenantAccountSecurity).values({
        tenantId: input.tenantId,
        userId: input.userId,
        lifecycle: input.lifecycle,
        version: 1,
        assignmentVersion: 1,
        activatedAt: input.lifecycle === "active" ? input.createdAt : null,
        deactivatedAt: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      return {
        userId: input.userId,
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        lifecycle: input.lifecycle,
        version: 1,
        assignmentVersion: 1,
        schoolAdmin: false,
        linkedPersonId: null,
      };
    },

    async linkPerson(tenantId, personId, userId, expectedVersion, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(personId);
      assertIdentifier(userId);
      const updated = await database.update(schoolPerson).set({
        accountUserId: userId,
        version: expectedVersion + 1,
        updatedAt,
      }).where(and(
        eq(schoolPerson.tenantId, tenantId),
        eq(schoolPerson.id, personId),
        eq(schoolPerson.version, expectedVersion),
        eq(schoolPerson.archived, false),
        isNull(schoolPerson.accountUserId),
      ));
      if (updated.rowCount !== 1) throw new SecurityCommandError("stale-version");
    },

    async createCase(value) {
      await database.insert(tenantAccountLifecycleCase).values(value);
    },

    async revokePendingCases(tenantId, userId, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      await database.update(tenantAccountLifecycleCase).set({
        state: "revoked",
        version: sql`${tenantAccountLifecycleCase.version} + 1`,
        updatedAt,
      }).where(and(
        eq(tenantAccountLifecycleCase.tenantId, tenantId),
        eq(tenantAccountLifecycleCase.userId, userId),
        eq(tenantAccountLifecycleCase.state, "pending"),
      ));
    },

    async transitionLifecycle(input) {
      const updated = await database.update(tenantAccountSecurity).set({
        lifecycle: input.lifecycle,
        version: input.expectedVersion + 1,
        assignmentVersion: input.bumpAssignmentVersion
          ? sql`${tenantAccountSecurity.assignmentVersion} + 1`
          : sql`${tenantAccountSecurity.assignmentVersion}`,
        activatedAt: input.lifecycle === "active"
          ? input.updatedAt
          : sql`${tenantAccountSecurity.activatedAt}`,
        deactivatedAt: input.lifecycle === "inactive" ? input.updatedAt : null,
        updatedAt: input.updatedAt,
      }).where(and(
        eq(tenantAccountSecurity.tenantId, input.tenantId),
        eq(tenantAccountSecurity.userId, input.userId),
        eq(tenantAccountSecurity.version, input.expectedVersion),
      ));
      return updated.rowCount === 1;
    },

    async suspendAssignments(tenantId, userId, updatedAt) {
      const rows = await this.listAssignments(tenantId, userId);
      const active = rows.filter((row) => row.state === "active");
      for (const row of active) {
        const updated = await database.update(tenantRoleAssignment).set({
          state: "suspended",
          suspendedAt: updatedAt,
          version: row.version + 1,
          updatedAt,
        }).where(and(
          eq(tenantRoleAssignment.tenantId, tenantId),
          eq(tenantRoleAssignment.id, row.id),
          eq(tenantRoleAssignment.version, row.version),
          eq(tenantRoleAssignment.state, "active"),
        ));
        if (updated.rowCount !== 1) throw new SecurityCommandError("stale-version");
      }
      return active.map((row) => row.roleId).sort();
    },

    async restoreAssignments(tenantId, userId, roleIds, updatedAt) {
      const selected = new Set(roleIds);
      const rows = await this.listAssignments(tenantId, userId);
      const suspended = rows.filter((row) => row.state === "suspended" && selected.has(row.roleId));
      for (const row of suspended) {
        const updated = await database.update(tenantRoleAssignment).set({
          state: "active",
          suspendedAt: null,
          version: row.version + 1,
          updatedAt,
        }).where(and(
          eq(tenantRoleAssignment.tenantId, tenantId),
          eq(tenantRoleAssignment.userId, userId),
          eq(tenantRoleAssignment.id, row.id),
          eq(tenantRoleAssignment.version, row.version),
          eq(tenantRoleAssignment.state, "suspended"),
        ));
        if (updated.rowCount !== 1) throw new SecurityCommandError("stale-version");
      }
      return suspended.map((row) => row.roleId).sort();
    },

    async revokeSessions(userId) {
      assertIdentifier(userId);
      const deleted = await database.delete(session).where(eq(session.userId, userId));
      return deleted.rowCount ?? 0;
    },

    async deleteCredential(tenantId, userId, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      await database.delete(account).where(and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
      ));
    },

    async unlinkPersonByAccount(tenantId, userId, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(userId);
      await database.update(schoolPerson).set({
        accountUserId: null,
        version: sql`${schoolPerson.version} + 1`,
        updatedAt,
      }).where(and(
        eq(schoolPerson.tenantId, tenantId),
        eq(schoolPerson.accountUserId, userId),
      ));
    },

    async linkPersonToAccount(tenantId, personId, userId, updatedAt) {
      assertIdentifier(tenantId);
      assertIdentifier(personId);
      assertIdentifier(userId);
      const updated = await database.update(schoolPerson).set({
        accountUserId: userId,
        version: sql`${schoolPerson.version} + 1`,
        updatedAt,
      }).where(and(
        eq(schoolPerson.tenantId, tenantId),
        eq(schoolPerson.id, personId),
        eq(schoolPerson.archived, false),
        isNull(schoolPerson.accountUserId),
      ));
      return updated.rowCount ?? 0;
    },
  };
}

export function createTenantAccountLifecycleDataService() {
  return createTenantAccountLifecycleService<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createTenantAccountLifecycleDataRepository,
  });
}

export function createConsumeTenantLifecycleCaseService() {
  return createConsumeLifecycleCaseCommand<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createTenantAccountLifecycleDataRepository,
  });
}

export async function listTenantLifecycleAccounts(input: Readonly<{
  tenantId: string;
  query?: string;
  lifecycle?: "pending-activation" | "active" | "inactive";
  limit?: number;
}>): Promise<readonly TenantLifecycleAccount[]> {
  assertIdentifier(input.tenantId);
  const query = input.query?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length > 100) throw new SecurityCommandError("invalid-command");
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new SecurityCommandError("invalid-command");

  const rows = await db
    .select({
      userId: user.id,
      tenantId: tenantAccountSecurity.tenantId,
      name: user.name,
      email: user.email,
      lifecycle: tenantAccountSecurity.lifecycle,
      version: tenantAccountSecurity.version,
      assignmentVersion: tenantAccountSecurity.assignmentVersion,
      authorityId: schoolAdminAuthority.id,
      linkedPersonId: schoolPerson.id,
    })
    .from(tenantAccountSecurity)
    .innerJoin(user, and(eq(user.tenantId, tenantAccountSecurity.tenantId), eq(user.id, tenantAccountSecurity.userId)))
    .leftJoin(schoolAdminAuthority, and(
      eq(schoolAdminAuthority.tenantId, tenantAccountSecurity.tenantId),
      eq(schoolAdminAuthority.userId, tenantAccountSecurity.userId),
      eq(schoolAdminAuthority.authorityState, "active"),
    ))
    .leftJoin(schoolPerson, and(eq(schoolPerson.tenantId, tenantAccountSecurity.tenantId), eq(schoolPerson.accountUserId, tenantAccountSecurity.userId)))
    .where(and(
      eq(tenantAccountSecurity.tenantId, input.tenantId),
      isNull(schoolAdminAuthority.id),
      input.lifecycle ? eq(tenantAccountSecurity.lifecycle, input.lifecycle) : undefined,
      query ? or(like(user.name, `%${query}%`), like(user.email, `%${query}%`)) : undefined,
    ))
    .orderBy(asc(user.name), asc(user.id))
    .limit(limit);
  return rows.map(toLifecycleAccount);
}

export type LinkableTenantSchoolPerson = Readonly<{
  id: string;
  tenantId: string;
  fullName: string;
  email: string | null;
  version: number;
}>;

export async function listLinkableTenantSchoolPeople(input: Readonly<{
  tenantId: string;
  query?: string;
  limit?: number;
}>): Promise<readonly LinkableTenantSchoolPerson[]> {
  assertIdentifier(input.tenantId);
  const query = input.query?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length > 100) throw new SecurityCommandError("invalid-command");
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new SecurityCommandError("invalid-command");

  return db
    .select({
      id: schoolPerson.id,
      tenantId: schoolPerson.tenantId,
      fullName: schoolPerson.fullName,
      email: schoolPerson.email,
      version: schoolPerson.version,
    })
    .from(schoolPerson)
    .where(and(
      eq(schoolPerson.tenantId, input.tenantId),
      eq(schoolPerson.archived, false),
      isNull(schoolPerson.accountUserId),
      query ? or(like(schoolPerson.fullName, `%${query}%`), like(schoolPerson.email, `%${query}%`)) : undefined,
    ))
    .orderBy(asc(schoolPerson.normalizedName), asc(schoolPerson.id))
    .limit(limit);
}
