

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import {
  applicant,
  providerAdmin,
  schoolAdminAuthority,
  securityReconciliationFinding,
  session,
  tenant,
  tenantAccountSecurity,
  user,
} from "@/db/schema";
import {
  SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY,
  planSchoolAdminCompatibilityProjection,
  type SchoolAdminCompatibilitySnapshot,
} from "@/lib/authorization/school-admin-authority";
import {
  createSecurityCommandService,
  SecurityCommandError,
  type SecurityPrincipal,
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

async function loadLockedSnapshot(
  transaction: MySqlSecurityCommandTransaction["database"],
  userId: string,
): Promise<SchoolAdminCompatibilitySnapshot | null> {
  const [account] = await transaction
    .select({ userId: user.id, tenantId: user.tenantId, legacyRole: user.tenantRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .for("update");
  if (!account) return null;

  const [tenantRows, providerRows, applicantRows, authorities] = await Promise.all([
    account.tenantId
      ? transaction.select({ id: tenant.id }).from(tenant).where(eq(tenant.id, account.tenantId)).limit(1)
      : Promise.resolve([]),
    transaction.select({ userId: providerAdmin.userId }).from(providerAdmin).where(eq(providerAdmin.userId, userId)),
    transaction.select({ userId: applicant.userId }).from(applicant).where(eq(applicant.userId, userId)),
    transaction
      .select({
        id: schoolAdminAuthority.id,
        tenantId: schoolAdminAuthority.tenantId,
        userId: schoolAdminAuthority.userId,
        authorityState: schoolAdminAuthority.authorityState,
      })
      .from(schoolAdminAuthority)
      .where(eq(schoolAdminAuthority.userId, userId))
      .orderBy(schoolAdminAuthority.id)
      .for("update"),
  ]);

  return {
    userId: account.userId,
    tenantId: account.tenantId,
    legacyRole: account.legacyRole,
    tenantExists: tenantRows.length === 1,
    providerAdmin: providerRows.length > 0,
    applicant: applicantRows.length > 0,
    authorities,
  };
}

export type SchoolAdminProjectionResult = Readonly<{
  status: "projected" | "unchanged" | "finding" | "not-school-admin";
  authorityId: string | null;
  findingCode: string | null;
}>;

export async function projectSchoolAdminCompatibility(input: Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  userId: string;
  idempotencyKey: string;
  correlationId: string;
}>): Promise<SchoolAdminProjectionResult> {
  assertIdentifier(input.tenantId);
  assertIdentifier(input.userId);

  const command = await executeSecurityCommand<SchoolAdminProjectionResult>({
    principal: input.principal,
    idempotencyKey: input.idempotencyKey,
    commandName: "school-admin.compatibility-project",
    payload: { tenantId: input.tenantId, userId: input.userId },
    correlationId: input.correlationId,
    deriveContext: async () => ({ kind: "tenant", contextId: input.tenantId, tenantId: input.tenantId }),
    authorizeAndMutate: async ({ actor, context, transaction }) => {
      if (actor.kind !== "provider-admin" && actor.kind !== "system") {
        throw new SecurityCommandError("context-denied");
      }
      if (context.kind !== "tenant") throw new SecurityCommandError("context-denied");

      const snapshot = await loadLockedSnapshot(transaction.database, input.userId);
      const plan = snapshot
        ? planSchoolAdminCompatibilityProjection(snapshot)
        : {
            kind: "finding" as const,
            code: "school-admin-tenant-missing" as const,
            tenantId: input.tenantId,
            userId: input.userId,
          };
      if (plan.kind === "project" && plan.tenantId !== input.tenantId) {
        throw new SecurityCommandError("context-denied");
      }

      if (plan.kind === "project") {
        const authorityId = randomUUID();
        const now = new Date();
        await transaction.database.insert(schoolAdminAuthority).values({
          id: authorityId,
          tenantId: plan.tenantId,
          userId: plan.userId,
          authorityState: "active",
          version: 1,
          grantedAt: now,
          disabledAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return {
          result: { status: "projected", authorityId, findingCode: null },
          auditEvents: [{
            purpose: "compatibility-projected",
            order: "summary",
            eventType: "school_admin.compatibility_projected",
            targets: { userId: plan.userId, schoolAdminAuthorityId: authorityId },
            metadata: { migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY },
          }],
        };
      }

      if (plan.kind === "finding") {
        if (plan.tenantId !== input.tenantId) throw new SecurityCommandError("context-denied");
        const findingKey = `${plan.code}:${plan.userId}`;
        await transaction.database.insert(securityReconciliationFinding).values({
          id: randomUUID(),
          migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY,
          scopeKey: input.tenantId,
          findingKey,
          tenantId: input.tenantId,
          userId: snapshot?.tenantId === input.tenantId ? input.userId : null,
          reasonCode: plan.code,
          severity: "blocking",
          state: "open",
          safeDetails: { userId: input.userId },
          detectedAt: new Date(),
          resolvedAt: null,
        }).onDuplicateKeyUpdate({
          set: {
            reasonCode: plan.code,
            severity: "blocking",
            state: "open",
            safeDetails: { userId: input.userId },
            detectedAt: new Date(),
            resolvedAt: null,
          },
        });
        return {
          result: { status: "finding", authorityId: null, findingCode: plan.code },
          auditEvents: [{
            purpose: "compatibility-finding",
            order: "summary",
            eventType: "school_admin.compatibility_finding",
            targets: snapshot?.tenantId === input.tenantId ? { userId: input.userId } : undefined,
            metadata: { migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY, reasonCode: plan.code },
          }],
        };
      }

      const authorityId = plan.kind === "unchanged" ? plan.authorityId : null;
      return {
        result: {
          status: plan.kind === "unchanged" ? "unchanged" : "not-school-admin",
          authorityId,
          findingCode: null,
        },
        auditEvents: [{
          purpose: "compatibility-verified",
          order: "summary",
          eventType: "school_admin.compatibility_verified",
          targets: authorityId ? { userId: input.userId, schoolAdminAuthorityId: authorityId } : undefined,
          outcome: "annotated",
          metadata: { migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY },
        }],
      };
    },
  });
  return command.result;
}

export async function disableSchoolAdminAuthority(input: Readonly<{
  principal: Extract<SecurityPrincipal, { kind: "authenticated-user" }>;
  tenantId: string;
  userId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>): Promise<Readonly<{ status: "disabled"; remainingActive: number }>> {
  assertIdentifier(input.tenantId);
  assertIdentifier(input.userId);
  const reason = input.reason.trim().replace(/\s+/g, " ");
  if (!reason || reason.length > 1000) throw new SecurityCommandError("invalid-command");

  const command = await executeSecurityCommand<{ status: "disabled"; remainingActive: number }>({
    principal: input.principal,
    idempotencyKey: input.idempotencyKey,
    commandName: "school-admin.authority-disable",
    payload: { tenantId: input.tenantId, userId: input.userId, reason },
    expectedVersions: [{ resourceType: "school-admin-authority", resourceId: input.userId, expectedVersion: input.expectedVersion }],
    correlationId: input.correlationId,
    deriveContext: async () => ({ kind: "tenant", contextId: input.tenantId, tenantId: input.tenantId }),
    authorizeAndMutate: async ({ actor, transaction }) => {
      if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
      await transaction.database.select({ id: tenant.id }).from(tenant)
        .where(eq(tenant.id, input.tenantId)).limit(1).for("update");
      const roster = await transaction.database
        .select({
          authorityId: schoolAdminAuthority.id,
          userId: schoolAdminAuthority.userId,
          state: schoolAdminAuthority.authorityState,
          version: schoolAdminAuthority.version,
          legacyRole: user.tenantRole,
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
        .where(eq(schoolAdminAuthority.tenantId, input.tenantId))
        .orderBy(schoolAdminAuthority.userId)
        .for("update");
      const target = roster.find((row) => row.userId === input.userId);
      if (!target || target.state !== "active" || target.legacyRole !== "school-admin") {
        throw new SecurityCommandError("context-denied");
      }
      if (target.version !== input.expectedVersion) throw new SecurityCommandError("stale-version");
      const active = roster.filter((row) =>
        row.state === "active"
        && row.legacyRole === "school-admin"
        && (row.accountLifecycle === null || row.accountLifecycle === "active"));
      if (active.length <= 1) throw new SecurityCommandError("integrity-failure");

      const now = new Date();
      const updated = await transaction.database.update(schoolAdminAuthority).set({
        authorityState: "disabled",
        version: input.expectedVersion + 1,
        disabledAt: now,
        updatedAt: now,
      }).where(and(
        eq(schoolAdminAuthority.id, target.authorityId),
        eq(schoolAdminAuthority.tenantId, input.tenantId),
        eq(schoolAdminAuthority.version, input.expectedVersion),
        eq(schoolAdminAuthority.authorityState, "active"),
      ));
      if (updated[0].affectedRows !== 1) throw new SecurityCommandError("stale-version");
      await transaction.database.update(user).set({ tenantRole: null }).where(and(
        eq(user.id, input.userId),
        eq(user.tenantId, input.tenantId),
        eq(user.tenantRole, "school-admin"),
      ));
      await transaction.database.delete(session).where(eq(session.userId, input.userId));

      return {
        result: { status: "disabled", remainingActive: active.length - 1 },
        versionTransitions: [{
          resourceType: "school-admin-authority",
          resourceId: input.userId,
          expectedVersion: input.expectedVersion,
          toVersion: input.expectedVersion + 1,
        }],
        auditEvents: [{
          purpose: "authority-disabled",
          order: "summary",
          eventType: "school_admin.authority_disabled",
          targets: { userId: input.userId, schoolAdminAuthorityId: target.authorityId },
          reason,
          metadata: { activeCountBefore: active.length, activeCountAfter: active.length - 1 },
        }],
      };
    },
  });
  return command.result;
}

export async function recordGlobalSchoolAdminProjectionFinding(input: Readonly<{
  userId: string;
  reasonCode: "school-admin-tenant-missing";
  idempotencyKey: string;
  correlationId: string;
}>): Promise<void> {
  assertIdentifier(input.userId);
  await executeSecurityCommand({
    principal: {
      kind: "system",
      service: "school-admin-compatibility-projection",
      context: { kind: "provider", contextId: "simas-provider", providerContextId: "simas-provider" },
    },
    idempotencyKey: input.idempotencyKey,
    commandName: "school-admin.compatibility-finding",
    payload: { userId: input.userId, reasonCode: input.reasonCode },
    correlationId: input.correlationId,
    authorizeAndMutate: async ({ actor, transaction }) => {
      if (actor.kind !== "system") throw new SecurityCommandError("context-denied");
      await transaction.database.insert(securityReconciliationFinding).values({
        id: randomUUID(),
        migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY,
        scopeKey: "global",
        findingKey: `${input.reasonCode}:${input.userId}`,
        tenantId: null,
        userId: null,
        reasonCode: input.reasonCode,
        severity: "blocking",
        state: "open",
        safeDetails: { userId: input.userId },
        detectedAt: new Date(),
        resolvedAt: null,
      }).onDuplicateKeyUpdate({ set: { detectedAt: new Date(), state: "open", resolvedAt: null } });
      return {
        result: { status: "finding" },
        auditEvents: [{
          purpose: "compatibility-global-finding",
          order: "summary",
          eventType: "school_admin.compatibility_finding",
          metadata: { migrationKey: SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY, reasonCode: input.reasonCode },
        }],
      };
    },
  });
}

export async function listLegacySchoolAdminProjectionCandidates(afterUserId = "", limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new SecurityCommandError("invalid-command");
  return securityCommandStore.transaction(async ({ database }) => database
    .select({ userId: user.id, tenantId: user.tenantId })
    .from(user)
    .where(and(
      eq(user.tenantRole, "school-admin"),
      sql`${user.id} > ${afterUserId}`,
    ))
    .orderBy(user.id)
    .limit(limit));
}
