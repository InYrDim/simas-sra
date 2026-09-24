import { and, eq } from "drizzle-orm";

import {
  applicant,
  providerAdmin,
  schoolAdminAuthority,
  schoolAdminProof,
  session,
  tenant,
  tenantAccountSecurity,
  user,
} from "@/db/schema";
import {
  createSchoolAdminLifecycleService,
  type LifecycleUserRow,
  type SchoolAdminLifecycleRepository,
  type SchoolAdminLifecycleService,
} from "@/lib/authorization/school-admin-lifecycle";
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

const proofRow = {
  id: schoolAdminProof.id,
  tenantId: schoolAdminProof.tenantId,
  authorityId: schoolAdminProof.authorityId,
  caseId: schoolAdminProof.caseId,
  kind: schoolAdminProof.kind,
  proofState: schoolAdminProof.proofState,
  secretDigest: schoolAdminProof.secretDigest,
  expiresAt: schoolAdminProof.expiresAt,
  completedAt: schoolAdminProof.completedAt,
  version: schoolAdminProof.version,
} as const;

/**
 * MySQL implementation of the School Admin lifecycle repository. Every command
 * serializes on the Tenant row first (deterministic roster lock), then reads
 * versioned rows with `FOR UPDATE` so decisions inside the mutation transaction
 * observe a stable snapshot. Mutations enforce the expected optimistic version
 * and report `false` on conflict so the service can raise `stale-version`.
 */
export function createSchoolAdminLifecycleDataRepository(
  transaction: MySqlSecurityCommandTransaction,
): SchoolAdminLifecycleRepository {
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

    async loadUserByEmail(email) {
      if (!email || email.length > 254 || /[\u0000-\u001f\u007f]/.test(email)) {
        throw new SecurityCommandError("invalid-command");
      }
      const [account] = await database
        .select({ id: user.id, tenantId: user.tenantId })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
        .for("update");
      if (!account) return null;
      const [provider] = await database
        .select({ userId: providerAdmin.userId })
        .from(providerAdmin)
        .where(eq(providerAdmin.userId, account.id))
        .limit(1);
      const [applicantRow] = await database
        .select({ userId: applicant.userId })
        .from(applicant)
        .where(eq(applicant.userId, account.id))
        .limit(1);
      const row: LifecycleUserRow = {
        id: account.id,
        tenantId: account.tenantId,
        providerAdmin: provider !== undefined,
        applicant: applicantRow !== undefined,
      };
      return row;
    },

    async listAuthorities(tenantId) {
      assertIdentifier(tenantId);
      return database
        .select({
          id: schoolAdminAuthority.id,
          tenantId: schoolAdminAuthority.tenantId,
          userId: schoolAdminAuthority.userId,
          authorityState: schoolAdminAuthority.authorityState,
          version: schoolAdminAuthority.version,
          grantedAt: schoolAdminAuthority.grantedAt,
          disabledAt: schoolAdminAuthority.disabledAt,
          accountLifecycle: tenantAccountSecurity.lifecycle,
        })
        .from(schoolAdminAuthority)
        .innerJoin(user, and(
          eq(user.id, schoolAdminAuthority.userId),
          eq(user.tenantId, schoolAdminAuthority.tenantId),
        ))
        .leftJoin(tenantAccountSecurity, and(
          eq(tenantAccountSecurity.userId, user.id),
          eq(tenantAccountSecurity.tenantId, schoolAdminAuthority.tenantId),
        ))
        .where(eq(schoolAdminAuthority.tenantId, tenantId))
        .orderBy(schoolAdminAuthority.userId)
        .for("update");
    },

    async insertAuthority(row) {
      assertIdentifier(row.id);
      assertIdentifier(row.tenantId);
      assertIdentifier(row.userId);
      await database.insert(schoolAdminAuthority).values({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        authorityState: "none",
        version: 1,
        grantedAt: null,
        disabledAt: null,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      });
    },

    async updateAuthority(input) {
      assertIdentifier(input.id);
      assertIdentifier(input.tenantId);
      const updated = await database.update(schoolAdminAuthority).set({
        authorityState: input.authorityState,
        version: input.expectedVersion + 1,
        grantedAt: input.grantedAt,
        disabledAt: input.disabledAt,
        updatedAt: input.updatedAt,
      }).where(and(
        eq(schoolAdminAuthority.id, input.id),
        eq(schoolAdminAuthority.tenantId, input.tenantId),
        eq(schoolAdminAuthority.version, input.expectedVersion),
      ));
      return updated.rowCount === 1;
    },

    async loadProofByCaseId(tenantId, caseId) {
      assertIdentifier(tenantId);
      assertIdentifier(caseId);
      const [row] = await database
        .select(proofRow)
        .from(schoolAdminProof)
        .where(and(
          eq(schoolAdminProof.tenantId, tenantId),
          eq(schoolAdminProof.caseId, caseId),
        ))
        .limit(1)
        .for("update");
      return row ?? null;
    },

    async listProofsByAuthority(tenantId, authorityId) {
      assertIdentifier(tenantId);
      assertIdentifier(authorityId);
      return database
        .select(proofRow)
        .from(schoolAdminProof)
        .where(and(
          eq(schoolAdminProof.tenantId, tenantId),
          eq(schoolAdminProof.authorityId, authorityId),
        ))
        .orderBy(schoolAdminProof.createdAt, schoolAdminProof.id)
        .for("update");
    },

    async insertProof(row) {
      assertIdentifier(row.id);
      assertIdentifier(row.tenantId);
      assertIdentifier(row.authorityId);
      assertIdentifier(row.caseId);
      await database.insert(schoolAdminProof).values({
        id: row.id,
        tenantId: row.tenantId,
        authorityId: row.authorityId,
        caseId: row.caseId,
        kind: row.kind,
        proofState: "pending",
        secretDigest: row.secretDigest,
        expiresAt: row.expiresAt,
        completedAt: null,
        version: row.version,
        idempotencyKey: row.idempotencyKey,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      });
    },

    async updateProof(input) {
      assertIdentifier(input.id);
      assertIdentifier(input.tenantId);
      const set: Partial<typeof schoolAdminProof.$inferInsert> = {
        proofState: input.proofState,
        version: input.expectedVersion + 1,
        updatedAt: input.updatedAt,
      };
      if (input.secretDigest !== undefined) set.secretDigest = input.secretDigest;
      if (input.expiresAt !== undefined) set.expiresAt = input.expiresAt;
      if (input.completedAt !== undefined) set.completedAt = input.completedAt;
      const updated = await database.update(schoolAdminProof).set(set).where(and(
        eq(schoolAdminProof.id, input.id),
        eq(schoolAdminProof.tenantId, input.tenantId),
        eq(schoolAdminProof.version, input.expectedVersion),
      ));
      return updated.rowCount === 1;
    },

    async setUserTenantRole(input) {
      assertIdentifier(input.userId);
      assertIdentifier(input.tenantId);
      const where = input.tenantRole === "school-admin"
        ? and(eq(user.id, input.userId), eq(user.tenantId, input.tenantId))
        : and(
            eq(user.id, input.userId),
            eq(user.tenantId, input.tenantId),
            eq(user.tenantRole, "school-admin"),
          );
      const updated = await database.update(user).set({ tenantRole: input.tenantRole }).where(where);
      return updated.rowCount === 1;
    },

    async revokeSessions(userId) {
      assertIdentifier(userId);
      const deleted = await database.delete(session).where(eq(session.userId, userId));
      return deleted.rowCount ?? 0;
    },
  };
}

/**
 * Wires the lifecycle service to MySQL through the security-command store.
 * Each command runs inside one transaction that commits the state mutation,
 * the canonical audit events, and the idempotency record atomically.
 */
export function createSchoolAdminLifecycleDataService(): SchoolAdminLifecycleService {
  return createSchoolAdminLifecycleService<MySqlSecurityCommandTransaction>({
    execute: executeSecurityCommand,
    repository: createSchoolAdminLifecycleDataRepository,
  });
}
