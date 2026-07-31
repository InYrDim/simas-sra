import { createHash, randomUUID } from "node:crypto";

import { and, eq, gt, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";

import { db } from "@/db";
import {
  applicant,
  providerAdmin,
  securityMigrationCheckpoint,
  securityReconciliationFinding,
  tenant,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
  user,
} from "@/db/schema";
import {
  LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
  LEGACY_NON_ADMIN_BACKFILL_SERVICE,
  LEGACY_NON_ADMIN_ROLES,
  computeLegacyEquivalence,
  defaultFrozenByRole,
  planLegacyNonAdminBackfill,
  resolveLegacyPermissionKeys,
  type LegacyBackfillExistingAssignment,
  type LegacyBackfillExistingRole,
  type LegacyBackfillPlan,
  type LegacyBackfillSnapshot,
  type LegacyEquivalenceTuple,
} from "@/lib/authorization/legacy-non-admin-backfill";
import {
  createSecurityCommandService,
  SecurityCommandError,
  type SecurityAuditEventDraft,
  type SecurityContext,
} from "@/lib/authorization/security-command";
import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
} from "@/lib/authorization/tenant-rbac-contract";
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

const providerContextId = process.env.PROVIDER_SECURITY_CONTEXT_ID?.trim() || "simas-provider";

export type LegacyBackfillResult = Readonly<{
  status: "backfilled" | "assigned" | "unchanged" | "skipped" | "finding";
  roleId: string | null;
  assignmentId: string | null;
  findingCode: string | null;
}>;

export type LegacyNonAdminBackfillCandidate = Readonly<{
  userId: string;
  tenantId: string | null;
}>;

function assertIdentifier(value: string): void {
  if (!value || value.length > 36) throw new SecurityCommandError("invalid-command");
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code > 126) throw new SecurityCommandError("invalid-command");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isBlockingBackfillFinding(code: string | null): boolean {
  return code !== null && code !== "legacy-backfill-role-null";
}

async function loadLockedSnapshot(
  transaction: MySqlSecurityCommandTransaction["database"],
  userId: string,
): Promise<LegacyBackfillSnapshot | null> {
  const [account] = await transaction
    .select({ userId: user.id, tenantId: user.tenantId, legacyRole: user.tenantRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .for("update");
  if (!account) return null;

  const tenantId = account.tenantId;
  const [tenantRows, providerRows, applicantRows] = await Promise.all([
    tenantId
      ? transaction.select({ id: tenant.id }).from(tenant).where(eq(tenant.id, tenantId)).limit(1)
      : Promise.resolve([]),
    transaction.select({ userId: providerAdmin.userId }).from(providerAdmin).where(eq(providerAdmin.userId, userId)).limit(1),
    transaction.select({ userId: applicant.userId }).from(applicant).where(eq(applicant.userId, userId)).limit(1),
  ]);

  // All Tenant roles, not just legacy-marked ones, so the plan can reject a
  // Tenant-created role that claims a frozen migration name.
  const roleRows = tenantId
    ? await transaction
        .select({
          roleId: tenantRole.id,
          tenantId: tenantRole.tenantId,
          legacyRole: tenantRole.legacyRole,
          origin: tenantRole.origin,
          lifecycle: tenantRole.lifecycle,
          normalizedName: tenantRole.normalizedName,
          migrationRunId: tenantRole.migrationRunId,
          migrationVersion: tenantRole.migrationVersion,
          migrationVerification: tenantRole.migrationVerification,
        })
        .from(tenantRole)
        .where(eq(tenantRole.tenantId, tenantId))
        .for("update")
    : [];
  const permissionRows = roleRows.length
    ? await transaction
        .select({ roleId: tenantRolePermission.roleId, permissionKey: tenantRolePermission.permissionKey })
        .from(tenantRolePermission)
        .where(
          inArray(
            tenantRolePermission.roleId,
            roleRows.map((row) => row.roleId),
          ),
        )
    : [];

  const permissionsByRole = new Map<string, string[]>();
  for (const row of permissionRows) {
    const list = permissionsByRole.get(row.roleId) ?? [];
    list.push(row.permissionKey);
    permissionsByRole.set(row.roleId, list);
  }
  const existingRoles: LegacyBackfillExistingRole[] = roleRows.map((row) => ({
    roleId: row.roleId,
    tenantId: row.tenantId,
    legacyRole: row.legacyRole,
    origin: row.origin,
    lifecycle: row.lifecycle,
    normalizedName: row.normalizedName,
    migrationRunId: row.migrationRunId,
    migrationVersion: row.migrationVersion,
    migrationVerification: row.migrationVerification,
    permissionKeys: [...(permissionsByRole.get(row.roleId) ?? [])].sort(),
  }));

  const assignmentRows = await transaction
    .select({
      assignmentId: tenantRoleAssignment.id,
      roleId: tenantRoleAssignment.roleId,
      tenantId: tenantRoleAssignment.tenantId,
      userId: tenantRoleAssignment.userId,
      state: tenantRoleAssignment.state,
    })
    .from(tenantRoleAssignment)
    .where(eq(tenantRoleAssignment.userId, userId))
    .for("update");
  const existingAssignments: LegacyBackfillExistingAssignment[] = assignmentRows.map((row) => ({
    assignmentId: row.assignmentId,
    roleId: row.roleId,
    tenantId: row.tenantId,
    userId: row.userId,
    state: row.state,
  }));

  return {
    userId,
    tenantId,
    legacyRole: account.legacyRole,
    tenantExists: tenantRows.length === 1,
    providerAdmin: providerRows.length === 1,
    applicant: applicantRows.length === 1,
    existingRoles,
    existingAssignments,
  };
}

function findingTenantId(plan: LegacyBackfillPlan, snapshot: LegacyBackfillSnapshot): string | null {
  return plan.kind === "finding" && plan.tenantId !== null && snapshot.tenantExists ? plan.tenantId : null;
}

async function upsertFinding(
  database: MySqlSecurityCommandTransaction["database"],
  plan: LegacyBackfillPlan,
  snapshot: LegacyBackfillSnapshot,
  userId: string,
  now: Date,
): Promise<void> {
  if (plan.kind !== "finding") return;
  const tenantId = findingTenantId(plan, snapshot);
  const safeDetails = {
    userId,
    tenantId: plan.tenantId,
    legacyRole: snapshot.legacyRole,
    migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
  };
  await database
    .insert(securityReconciliationFinding)
    .values({
      id: randomUUID(),
      migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
      scopeKey: tenantId ?? "global",
      findingKey: `${plan.code}:${userId}`,
      tenantId,
      userId: tenantId ? userId : null,
      reasonCode: plan.code,
      severity: plan.code === "legacy-backfill-role-null" ? "warning" : "blocking",
      state: "open",
      safeDetails,
      detectedAt: now,
      resolvedAt: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        state: "open",
        reasonCode: plan.code,
        severity: plan.code === "legacy-backfill-role-null" ? "warning" : "blocking",
        safeDetails,
        detectedAt: now,
        resolvedAt: null,
      },
    });
}

async function executePlan(
  database: MySqlSecurityCommandTransaction["database"],
  plan: LegacyBackfillPlan,
  snapshot: LegacyBackfillSnapshot,
  userId: string,
  runId: string,
  now: Date,
): Promise<{ result: LegacyBackfillResult; auditEvents: readonly SecurityAuditEventDraft[] }> {
  const migrationKey = LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY;
  switch (plan.kind) {
    case "backfill-role": {
      const roleId = randomUUID();
      const assignmentId = randomUUID();
      await database.insert(tenantRole).values({
        id: roleId,
        tenantId: plan.tenantId,
        name: plan.roleName,
        normalizedName: plan.normalizedName,
        lifecycle: "active",
        origin: "legacy-migration",
        templateKey: null,
        templateVersion: null,
        copiedFromRoleId: null,
        legacyRole: plan.legacyRole as "pimpinan" | "staff" | "guru" | "siswa" | "guest",
        migrationRunId: runId,
        migrationVersion: PERMISSION_REGISTRY_VERSION,
        migrationVerification: "pending",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      if (plan.permissionKeys.length > 0) {
        await database.insert(tenantRolePermission).values(
          plan.permissionKeys.map((permissionKey) => ({
            tenantId: plan.tenantId,
            roleId,
            permissionKey,
            createdAt: now,
          })),
        );
      }
      await database.insert(tenantRoleAssignment).values({
        id: assignmentId,
        tenantId: plan.tenantId,
        userId: plan.userId,
        roleId,
        state: "active",
        version: 1,
        assignedAt: now,
        suspendedAt: null,
        updatedAt: now,
      });
      return {
        result: { status: "backfilled", roleId, assignmentId, findingCode: null },
        auditEvents: [
          {
            purpose: "legacy-role-backfilled",
            order: "summary",
            eventType: "tenant_role.legacy_migration_backfilled",
            targets: { userId: plan.userId, roleId, assignmentId },
            metadata: {
              migrationKey,
              legacyRole: plan.legacyRole,
              migrationRunId: runId,
              permissionCount: plan.permissionKeys.length,
            },
          },
        ],
      };
    }
    case "assign-existing": {
      const assignmentId = randomUUID();
      await database.insert(tenantRoleAssignment).values({
        id: assignmentId,
        tenantId: plan.tenantId,
        userId: plan.userId,
        roleId: plan.roleId,
        state: "active",
        version: 1,
        assignedAt: now,
        suspendedAt: null,
        updatedAt: now,
      });
      return {
        result: { status: "assigned", roleId: plan.roleId, assignmentId, findingCode: null },
        auditEvents: [
          {
            purpose: "legacy-role-assigned",
            order: "summary",
            eventType: "tenant_role.legacy_migration_assigned",
            targets: { userId: plan.userId, roleId: plan.roleId, assignmentId },
            metadata: { migrationKey, legacyRole: plan.legacyRole, migrationRunId: runId },
          },
        ],
      };
    }
    case "unchanged": {
      return {
        result: { status: "unchanged", roleId: plan.roleId, assignmentId: null, findingCode: null },
        auditEvents: [
          {
            purpose: "legacy-role-verified",
            order: "summary",
            eventType: "tenant_role.legacy_migration_verified",
            targets: { userId: plan.userId, roleId: plan.roleId },
            outcome: "annotated",
            metadata: { migrationKey, legacyRole: plan.legacyRole },
          },
        ],
      };
    }
    case "not-non-admin":
    case "no-legacy-role": {
      return {
        result: { status: "skipped", roleId: null, assignmentId: null, findingCode: null },
        auditEvents: [
          {
            purpose: "legacy-role-skipped",
            order: "summary",
            eventType: "tenant_role.legacy_migration_skipped",
            outcome: "annotated",
            metadata: { migrationKey, reason: plan.kind },
          },
        ],
      };
    }
    case "finding": {
      await upsertFinding(database, plan, snapshot, userId, now);
      const tenantId = findingTenantId(plan, snapshot);
      return {
        result: { status: "finding", roleId: null, assignmentId: null, findingCode: plan.code },
        auditEvents: [
          {
            purpose: "legacy-role-finding",
            order: "summary",
            eventType: "tenant_role.legacy_migration_finding",
            targets: tenantId ? { userId } : undefined,
            outcome: "annotated",
            metadata: { migrationKey, reasonCode: plan.code, legacyRole: snapshot.legacyRole },
          },
        ],
      };
    }
  }
}

export async function backfillLegacyNonAdminUser(input: Readonly<{
  userId: string;
  tenantId: string | null;
  runId: string;
  correlationId: string;
}>): Promise<LegacyBackfillResult> {
  assertIdentifier(input.userId);
  assertIdentifier(input.runId);
  const tenantContext: SecurityContext | null = input.tenantId
    ? { kind: "tenant", contextId: input.tenantId, tenantId: input.tenantId }
    : null;
  const context = tenantContext ?? { kind: "provider", contextId: providerContextId, providerContextId };
  const idempotencyKey = `legacy_backfill_${sha256(
    `${input.runId}${input.tenantId ? input.tenantId : "global"}${input.userId}`,
  ).slice(0, 64)}`;

  const command = await executeSecurityCommand<LegacyBackfillResult>({
    principal: {
      kind: "system",
      service: LEGACY_NON_ADMIN_BACKFILL_SERVICE,
      context,
    },
    idempotencyKey,
    commandName: "legacy-non-admin.backfill-user",
    payload: { userId: input.userId, tenantId: input.tenantId },
    correlationId: input.correlationId,
    deriveContext: async () => context,
    authorizeAndMutate: async ({ actor, transaction }) => {
      if (actor.kind !== "system") throw new SecurityCommandError("context-denied");
      const snapshot = await loadLockedSnapshot(transaction.database, input.userId);
      if (!snapshot) {
        return {
          result: { status: "skipped", roleId: null, assignmentId: null, findingCode: null },
          auditEvents: [
            {
              purpose: "legacy-user-missing",
              order: "summary",
              eventType: "tenant_role.legacy_migration_skipped",
              outcome: "annotated",
              metadata: { migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY, reason: "user-missing" },
            },
          ],
        };
      }
      // A concurrent same-role backfill may race on the normalized role name;
      // the store retries the whole transaction when that unique constraint
      // fires, and the re-snapshot converges to assign-existing.
      return executePlan(transaction.database, planLegacyNonAdminBackfill(snapshot), snapshot, input.userId, input.runId, new Date());
    },
  });
  return command.result;
}

export async function listLegacyNonAdminBackfillCandidates(
  afterUserId = "",
  limit = 100,
): Promise<LegacyNonAdminBackfillCandidate[]> {
  return db
    .select({ userId: user.id, tenantId: user.tenantId })
    .from(user)
    .where(
      and(
        afterUserId.length > 0 ? gt(user.id, afterUserId) : undefined,
        or(isNotNull(user.tenantId), isNotNull(user.tenantRole)),
        or(isNull(user.tenantRole), ne(user.tenantRole, "school-admin")),
      ),
    )
    .orderBy(user.id)
    .limit(limit);
}

export type LegacyBackfillCheckpointState = Readonly<{
  migrationKey: string;
  shardKey: string;
  state: string;
  cursor: string | null;
  sourceWatermark: string | null;
  registryVersion: string;
  operationMapVersion: string;
  examinedCount: number;
  migratedCount: number;
  findingCount: number;
}>;

export async function getLegacyBackfillCheckpoint(): Promise<LegacyBackfillCheckpointState | null> {
  const [row] = await db
    .select()
    .from(securityMigrationCheckpoint)
    .where(
      and(
        eq(securityMigrationCheckpoint.migrationKey, LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY),
        eq(securityMigrationCheckpoint.shardKey, "all"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    migrationKey: row.migrationKey,
    shardKey: row.shardKey,
    state: row.state,
    cursor: row.cursor,
    sourceWatermark: row.sourceWatermark,
    registryVersion: row.registryVersion,
    operationMapVersion: row.operationMapVersion,
    examinedCount: row.examinedCount,
    migratedCount: row.migratedCount,
    findingCount: row.findingCount,
  };
}

export async function startLegacyBackfillCheckpoint(): Promise<void> {
  const now = new Date();
  await db
    .insert(securityMigrationCheckpoint)
    .values({
      migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
      shardKey: "all",
      state: "running",
      cursor: null,
      sourceWatermark: null,
      registryVersion: PERMISSION_REGISTRY_VERSION,
      operationMapVersion: OPERATION_MAP_VERSION,
      examinedCount: 0,
      migratedCount: 0,
      findingCount: 0,
      version: 1,
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        state: "running",
        cursor: null,
        sourceWatermark: null,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      },
    });
}

export async function resetLegacyBackfillCheckpoint(): Promise<void> {
  const now = new Date();
  await db
    .insert(securityMigrationCheckpoint)
    .values({
      migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
      shardKey: "all",
      state: "pending",
      cursor: null,
      sourceWatermark: null,
      registryVersion: PERMISSION_REGISTRY_VERSION,
      operationMapVersion: OPERATION_MAP_VERSION,
      examinedCount: 0,
      migratedCount: 0,
      findingCount: 0,
      version: 1,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        state: "pending",
        cursor: null,
        sourceWatermark: null,
        startedAt: null,
        completedAt: null,
        examinedCount: 0,
        migratedCount: 0,
        findingCount: 0,
        updatedAt: now,
      },
    });
}

export async function advanceLegacyBackfillCheckpoint(input: Readonly<{
  cursor: string;
  examinedCount: number;
  migratedCount: number;
  findingCount: number;
}>): Promise<void> {
  await db
    .update(securityMigrationCheckpoint)
    .set({
      cursor: input.cursor,
      examinedCount: input.examinedCount,
      migratedCount: input.migratedCount,
      findingCount: input.findingCount,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(securityMigrationCheckpoint.migrationKey, LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY),
        eq(securityMigrationCheckpoint.shardKey, "all"),
        eq(securityMigrationCheckpoint.state, "running"),
      ),
    );
}

export async function completeLegacyBackfillCheckpoint(input: Readonly<{
  sourceWatermark: string;
  examinedCount: number;
  migratedCount: number;
  findingCount: number;
}>): Promise<void> {
  const now = new Date();
  await db
    .update(securityMigrationCheckpoint)
    .set({
      state: "completed",
      cursor: input.sourceWatermark,
      sourceWatermark: input.sourceWatermark,
      examinedCount: input.examinedCount,
      migratedCount: input.migratedCount,
      findingCount: input.findingCount,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(securityMigrationCheckpoint.migrationKey, LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY),
        eq(securityMigrationCheckpoint.shardKey, "all"),
        eq(securityMigrationCheckpoint.state, "running"),
      ),
    );
}

export type LegacyBackfillPassSummary = Readonly<{
  done: boolean;
  examined: number;
  migrated: number;
  findings: number;
  blockingFindings: number;
  cursor: string | null;
}>;

/**
 * Runs one bounded pass over backfill candidates using the persisted
 * checkpoint. A pass never examines a user the checkpoint already passed, and
 * per-user commands are idempotent within the pass, so restarts and reruns
 * converge without duplicates.
 */
export async function runLegacyNonAdminBackfillPass(input: Readonly<{
  batchSize?: number;
  runId?: string;
  force?: boolean;
}>): Promise<LegacyBackfillPassSummary> {
  const batchSize = input.batchSize ?? 100;
  let checkpoint = await getLegacyBackfillCheckpoint();
  if (!checkpoint || checkpoint.state === "pending") {
    await startLegacyBackfillCheckpoint();
    checkpoint = await getLegacyBackfillCheckpoint();
  }
  if (!checkpoint) throw new SecurityCommandError("integrity-failure");
  if (checkpoint.state === "completed") {
    if (!input.force) {
      return {
        done: true,
        examined: checkpoint.examinedCount,
        migrated: checkpoint.migratedCount,
        findings: checkpoint.findingCount,
        blockingFindings: 0,
        cursor: checkpoint.sourceWatermark,
      };
    }
    await resetLegacyBackfillCheckpoint();
    await startLegacyBackfillCheckpoint();
    checkpoint = await getLegacyBackfillCheckpoint();
    if (!checkpoint) throw new SecurityCommandError("integrity-failure");
  }

  const runId = input.runId ?? randomUUID();
  const candidates = await listLegacyNonAdminBackfillCandidates(checkpoint.cursor ?? "", batchSize);
  const hasMore = candidates.length >= batchSize;
  const batch = hasMore ? candidates.slice(0, batchSize) : candidates;

  let examined = checkpoint.examinedCount;
  let migrated = checkpoint.migratedCount;
  let findings = checkpoint.findingCount;
  let blockingFindings = 0;
  let cursor = checkpoint.cursor ?? "";
  for (const candidate of batch) {
    cursor = candidate.userId;
    examined += 1;
    const result = await backfillLegacyNonAdminUser({
      userId: candidate.userId,
      tenantId: candidate.tenantId,
      runId,
      correlationId: randomUUID(),
    });
    if (result.status === "backfilled" || result.status === "assigned") migrated += 1;
    if (result.status === "finding") {
      findings += 1;
      if (isBlockingBackfillFinding(result.findingCode)) blockingFindings += 1;
      console.error({
        event: "legacy_backfill_finding",
        userId: candidate.userId,
        reasonCode: result.findingCode,
        tenantId: candidate.tenantId,
      });
    }
  }
  await advanceLegacyBackfillCheckpoint({ cursor, examinedCount: examined, migratedCount: migrated, findingCount: findings });
  if (!hasMore) {
    await completeLegacyBackfillCheckpoint({ sourceWatermark: cursor, examinedCount: examined, migratedCount: migrated, findingCount: findings });
  }
  return { done: !hasMore, examined, migrated, findings, blockingFindings, cursor };
}

export type PersistedLegacyBackfillVerification = Readonly<{
  equivalent: boolean;
  contractDigest: string;
  registryVersion: string;
  operationMapVersion: string;
  watermark: string | null;
  evaluatedUserCount: number;
  roleCount: number;
  assignmentCount: number;
  mismatchedRoleIds: readonly string[];
  widened: readonly LegacyEquivalenceTuple[];
  narrowed: readonly LegacyEquivalenceTuple[];
}>;

/**
 * Repeatable verifier: reads persisted legacy-migration roles and active
 * assignments, proves every frozen role grants exactly the approved permission
 * set and no migrated user accumulates permissions beyond the frozen set, then
 * combines that with the static operation-tuple equivalence. The recorded
 * watermark and contract digest bind the proof to a point in time.
 */
export async function verifyLegacyNonAdminBackfill(): Promise<PersistedLegacyBackfillVerification> {
  const checkpoint = await getLegacyBackfillCheckpoint();
  const watermark =
    checkpoint?.state === "completed" ? checkpoint.sourceWatermark ?? checkpoint.cursor : checkpoint?.cursor ?? null;

  const staticResult = computeLegacyEquivalence(defaultFrozenByRole());

  const roleRows = await db
    .select({
      roleId: tenantRole.id,
      legacyRole: tenantRole.legacyRole,
      lifecycle: tenantRole.lifecycle,
      origin: tenantRole.origin,
      migrationRunId: tenantRole.migrationRunId,
      migrationVersion: tenantRole.migrationVersion,
      migrationVerification: tenantRole.migrationVerification,
    })
    .from(tenantRole)
    .where(eq(tenantRole.origin, "legacy-migration"));

  const permissionRows = roleRows.length
    ? await db
        .select({ roleId: tenantRolePermission.roleId, permissionKey: tenantRolePermission.permissionKey })
        .from(tenantRolePermission)
        .where(
          inArray(
            tenantRolePermission.roleId,
            roleRows.map((row) => row.roleId),
          ),
        )
    : [];
  const permissionsByRole = new Map<string, string[]>();
  for (const row of permissionRows) {
    const list = permissionsByRole.get(row.roleId) ?? [];
    list.push(row.permissionKey);
    permissionsByRole.set(row.roleId, list);
  }

  const mismatchedRoleIds: string[] = [];
  for (const role of roleRows) {
    const frozen = role.legacyRole ? resolveLegacyPermissionKeys(role.legacyRole) : [];
    const actual = [...(permissionsByRole.get(role.roleId) ?? [])].sort();
    const valid =
      role.lifecycle === "active" &&
      role.origin === "legacy-migration" &&
      role.legacyRole !== null &&
      (LEGACY_NON_ADMIN_ROLES as readonly string[]).includes(role.legacyRole) &&
      role.migrationRunId !== null &&
      role.migrationVersion !== null &&
      role.migrationVerification !== null &&
      actual.length === frozen.length &&
      frozen.every((key) => actual.includes(key));
    if (!valid) mismatchedRoleIds.push(role.roleId);
    await db
      .update(tenantRole)
      .set({ migrationVerification: valid ? "verified" : "mismatch", updatedAt: new Date() })
      .where(eq(tenantRole.id, role.roleId));
  }

  const activeRoleIds = roleRows.map((row) => row.roleId);
  const assignmentRows = activeRoleIds.length
    ? await db
        .select({
          assignmentId: tenantRoleAssignment.id,
          userId: tenantRoleAssignment.userId,
          roleId: tenantRoleAssignment.roleId,
          tenantId: tenantRoleAssignment.tenantId,
          state: tenantRoleAssignment.state,
        })
        .from(tenantRoleAssignment)
        .where(and(eq(tenantRoleAssignment.state, "active"), inArray(tenantRoleAssignment.roleId, activeRoleIds)))
    : [];

  const frozenSuperset = new Set(defaultFrozenByRole()[LEGACY_NON_ADMIN_ROLES[0]] ?? []);
  const effectiveByUser = new Map<string, Set<string>>();
  let widenedPermissionUsers = 0;
  for (const assignment of assignmentRows) {
    if (!effectiveByUser.has(assignment.userId)) effectiveByUser.set(assignment.userId, new Set());
    const permissions = permissionsByRole.get(assignment.roleId) ?? [];
    for (const key of permissions) effectiveByUser.get(assignment.userId)!.add(key);
  }
  for (const effective of effectiveByUser.values()) {
    let widened = false;
    for (const key of effective) {
      if (!frozenSuperset.has(key)) {
        widened = true;
        break;
      }
    }
    if (widened) widenedPermissionUsers += 1;
  }

  const equivalent =
    staticResult.equivalent && mismatchedRoleIds.length === 0 && widenedPermissionUsers === 0;
  const contractDigest = staticResult.contractDigest;
  const now = new Date();
  await db
    .insert(securityReconciliationFinding)
    .values({
      id: randomUUID(),
      migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
      scopeKey: "verifier",
      findingKey: "equivalence-attestation",
      tenantId: null,
      userId: null,
      reasonCode: "legacy-rbac-equivalence",
      severity: "warning",
      state: equivalent ? "resolved" : "open",
      safeDetails: {
        contractDigest,
        watermark,
        registryVersion: staticResult.registryVersion,
        operationMapVersion: staticResult.operationMapVersion,
        evaluatedTupleCount: staticResult.tuples.length,
        widenedTupleCount: staticResult.widened.length,
        narrowedTupleCount: staticResult.narrowed.length,
        mismatchedRoleCount: mismatchedRoleIds.length,
        widenedPermissionUserCount: widenedPermissionUsers,
      },
      detectedAt: now,
      resolvedAt: equivalent ? now : null,
    })
    .onDuplicateKeyUpdate({
      set: {
        state: equivalent ? "resolved" : "open",
        safeDetails: {
          contractDigest,
          watermark,
          registryVersion: staticResult.registryVersion,
          operationMapVersion: staticResult.operationMapVersion,
          evaluatedTupleCount: staticResult.tuples.length,
          widenedTupleCount: staticResult.widened.length,
          narrowedTupleCount: staticResult.narrowed.length,
          mismatchedRoleCount: mismatchedRoleIds.length,
          widenedPermissionUserCount: widenedPermissionUsers,
        },
        detectedAt: now,
        resolvedAt: equivalent ? now : null,
      },
    });

  return {
    equivalent,
    contractDigest,
    registryVersion: staticResult.registryVersion,
    operationMapVersion: staticResult.operationMapVersion,
    watermark,
    evaluatedUserCount: effectiveByUser.size,
    roleCount: roleRows.length,
    assignmentCount: assignmentRows.length,
    mismatchedRoleIds,
    widened: staticResult.widened,
    narrowed: staticResult.narrowed,
  };
}
