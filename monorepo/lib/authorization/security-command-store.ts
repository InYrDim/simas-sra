import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  providerAdmin,
  securityAuditEvent,
  securityAuditHead,
  securityCommand,
  securityOutbox,
  tenantRbacRollout,
  user,
} from "@/db/schema";
import {
  actorColumns,
  actorEvidence,
  contextColumns,
  SecurityCommandError,
  type JsonValue,
  type SecurityActor,
  type SecurityAuditEvidence,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import { validateEmergencyOverlay, type EmergencyOverlay } from "@/lib/authorization/tenant-rbac-rollout";

export type StoredSecurityCommand = Readonly<{
  id: string;
  commandName: string;
  fingerprint: string;
  status: "pending" | "completed" | "failed";
  result: JsonValue | null;
}>;

export type SecurityAuditHead = Readonly<{
  nextSequence: bigint;
  headHash: string;
  version: number;
}>;

export type PersistedSecurityCommand = Readonly<{
  id: string;
  context: SecurityContext;
  idempotencyKey: string;
  commandName: string;
  fingerprint: string;
  createdAt: Date;
}>;

export type PersistedSecurityAuditEvent = Readonly<{
  id: string;
  context: SecurityContext;
  sequence: bigint;
  eventKey: string;
  schemaVersion: number;
  eventType: string;
  outcome: "succeeded" | "annotated";
  actor: SecurityActor;
  commandId: string;
  targets: Readonly<{
    userId?: string;
    roleId?: string;
    assignmentId?: string;
    schoolAdminAuthorityId?: string;
    schoolAdminProofId?: string;
  }>;
  correlationId: string;
  requestId?: string;
  reason?: string;
  evidence: SecurityAuditEvidence;
  metadata: JsonValue;
  canonicalPayloadDigest: string;
  previousHash: string;
  eventHash: string;
  occurredAt: Date;
}>;

export type PersistedSecurityOutbox = Readonly<{
  id: string;
  context: SecurityContext;
  commandId: string;
  eventKey: string;
  eventType: string;
  payload: JsonValue;
  occurredAt: Date;
  availableAt: Date;
}>;

export type SecurityCommandTransactionStep = "idempotency" | "state" | "audit" | "head" | "outbox";

export type SecurityCommandStoreTransaction = Readonly<{
  resolveActor(principal: SecurityPrincipal): Promise<SecurityActor | null>;
  defaultContext(principal: SecurityPrincipal, actor: SecurityActor): Promise<SecurityContext>;
  findCommand(context: SecurityContext, idempotencyKey: string): Promise<StoredSecurityCommand | null>;
  insertCommand(command: PersistedSecurityCommand): Promise<void>;
  lockAuditHead(context: SecurityContext, now: Date): Promise<SecurityAuditHead>;
  insertAuditEvents(events: readonly PersistedSecurityAuditEvent[]): Promise<void>;
  updateAuditHead(
    context: SecurityContext,
    previous: SecurityAuditHead,
    next: SecurityAuditHead,
    now: Date,
  ): Promise<boolean>;
  insertOutbox(events: readonly PersistedSecurityOutbox[]): Promise<void>;
  completeCommand(context: SecurityContext, commandId: string, result: JsonValue, now: Date): Promise<void>;
  checkpoint?(step: SecurityCommandTransactionStep): void | Promise<void>;
}>;

export type SecurityCommandStore<TDomainTransaction extends object = object> = Readonly<{
  transaction<T>(
    work: (transaction: SecurityCommandStoreTransaction & TDomainTransaction) => Promise<T>,
  ): Promise<T>;
}>;

export type SecurityCommandDatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type MySqlSecurityCommandTransaction = Readonly<{
  database: SecurityCommandDatabaseTransaction;
  readState?(id: string): Promise<Readonly<{ id: string; version: number; value: JsonValue }> | null>;
  writeState?(input: Readonly<{ id: string; expectedVersion: number; value: JsonValue }>): Promise<boolean>;
}>;

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  return `${error.message} ${cause ? errorDetails(cause) : ""}`;
}

function retryableTransactionError(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  if ([1205, 1213].includes(candidate.errno ?? 0)) return true;
  if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT"].includes(candidate.code ?? "")) {
    return true;
  }
  const details = errorDetails(error);
  return details.includes("security_command_idempotency_unique")
    || details.includes("tenant_role_tenant_name_unique")
    || details.includes("Deadlock found");
}

function valuesForContext(context: SecurityContext): Readonly<{
  securityContextKind: "tenant" | "provider";
  contextId: string;
  tenantId: string | null;
  providerContextId: string | null;
}> {
  return {
    securityContextKind: context.kind,
    contextId: context.contextId,
    ...contextColumns(context),
  };
}

function contextWhere(context: SecurityContext) {
  return and(
    eq(securityCommand.securityContextKind, context.kind),
    eq(securityCommand.contextId, context.contextId),
  );
}

function auditHeadWhere(context: SecurityContext) {
  return and(
    eq(securityAuditHead.securityContextKind, context.kind),
    eq(securityAuditHead.contextId, context.contextId),
  );
}

export function createMySqlSecurityCommandStore(options: Readonly<{
  providerContextId: string;
  maxTransactionAttempts?: number;
  afterStep?: (step: SecurityCommandTransactionStep) => void | Promise<void>;
}>): SecurityCommandStore<MySqlSecurityCommandTransaction> {
  if (!options.providerContextId || options.providerContextId.length > 36) {
    throw new SecurityCommandError("invalid-command");
  }
  const maximumAttempts = options.maxTransactionAttempts ?? 3;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 10) {
    throw new SecurityCommandError("invalid-command");
  }

  return {
    async transaction(work) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await db.transaction(async (database) => work({
            database,
            async readState(id) {
              const [row] = await database
                .select({
                  id: tenantRbacRollout.tenantId,
                  version: tenantRbacRollout.version,
                  httpMode: tenantRbacRollout.httpMode,
                  workerMode: tenantRbacRollout.workerMode,
                  epoch: tenantRbacRollout.epoch,
                  resolverVersion: tenantRbacRollout.resolverVersion,
                  registryVersion: tenantRbacRollout.registryVersion,
                  operationMapVersion: tenantRbacRollout.operationMapVersion,
                  overlayHash: tenantRbacRollout.overlayHash,
                  overlayPolicyVersion: tenantRbacRollout.overlayPolicyVersion,
                  overlayDeniedOperationIds: tenantRbacRollout.overlayDeniedOperationIds,
                  overlayDeniedPermissionKeys: tenantRbacRollout.overlayDeniedPermissionKeys,
                  overlayDenyMutations: tenantRbacRollout.overlayDenyMutations,
                  overlayReviewAt: tenantRbacRollout.overlayReviewAt,
                  overlayExpiresAt: tenantRbacRollout.overlayExpiresAt,
                  multiRoleAcceptedAt: tenantRbacRollout.multiRoleAcceptedAt,
                  updatedAt: tenantRbacRollout.updatedAt,
                })
                .from(tenantRbacRollout)
                .where(eq(tenantRbacRollout.tenantId, id))
                .limit(1)
                .for("update");
              if (!row) return null;
              return {
                id: row.id,
                version: row.version,
                value: {
                  httpMode: row.httpMode,
                  workerMode: row.workerMode,
                  epoch: row.epoch.toString(),
                  version: row.version,
                  resolverVersion: row.resolverVersion,
                  registryVersion: row.registryVersion,
                  operationMapVersion: row.operationMapVersion,
                  emergencyOverlay: row.overlayHash === null ? null : {
                    overlayHash: row.overlayHash,
                    deniedOperationIds: row.overlayDeniedOperationIds ?? [],
                    deniedPermissionKeys: row.overlayDeniedPermissionKeys ?? [],
                    denyMutations: row.overlayDenyMutations ?? false,
                    policyVersion: row.overlayPolicyVersion ?? "",
                    reviewAt: row.overlayReviewAt?.toISOString() ?? "",
                    expiresAt: row.overlayExpiresAt?.toISOString() ?? "",
                  },
                  multiRoleAcceptedAt: row.multiRoleAcceptedAt?.toISOString() ?? null,
                  legacyAuthorityDisabledAt: null,
                  rollbackEligible: row.multiRoleAcceptedAt === null,
                },
              };
            },
            async writeState(input) {
              if (typeof input.value !== "object" || input.value === null || Array.isArray(input.value)) return false;
              const value = input.value as Record<string, JsonValue>;
              const modes = new Set(["legacy", "intersection", "rbac", "rbac-emergency"]);
              if (
                typeof value.httpMode !== "string" || !modes.has(value.httpMode)
                || typeof value.workerMode !== "string" || !modes.has(value.workerMode)
                || typeof value.epoch !== "string" || typeof value.version !== "number"
                || typeof value.resolverVersion !== "string" || typeof value.registryVersion !== "string"
                || typeof value.operationMapVersion !== "string"
                || (value.emergencyOverlay !== null && (typeof value.emergencyOverlay !== "object" || Array.isArray(value.emergencyOverlay)))
              ) return false;
              const overlay = value.emergencyOverlay as Record<string, JsonValue> | null;
              if ((value.httpMode === "rbac-emergency" || value.workerMode === "rbac-emergency") !== Boolean(overlay)
                || (value.httpMode === "rbac-emergency") !== (value.workerMode === "rbac-emergency")) return false;
              if (overlay && (
                typeof overlay.overlayHash !== "string" || !Array.isArray(overlay.deniedOperationIds)
                || !overlay.deniedOperationIds.every((item) => typeof item === "string")
                || !Array.isArray(overlay.deniedPermissionKeys) || !overlay.deniedPermissionKeys.every((item) => typeof item === "string")
                || typeof overlay.denyMutations !== "boolean" || typeof overlay.policyVersion !== "string"
                || typeof overlay.reviewAt !== "string" || Number.isNaN(new Date(overlay.reviewAt).getTime())
                || typeof overlay.expiresAt !== "string" || Number.isNaN(new Date(overlay.expiresAt).getTime())
              )) return false;
              let validatedOverlay: EmergencyOverlay | null = null;
              if (overlay) {
                try {
                  validatedOverlay = validateEmergencyOverlay({
                    overlayHash: overlay.overlayHash as string,
                    deniedOperationIds: overlay.deniedOperationIds as string[],
                    deniedPermissionKeys: overlay.deniedPermissionKeys as string[],
                    denyMutations: overlay.denyMutations as boolean,
                    policyVersion: overlay.policyVersion as string,
                    reviewAt: new Date(overlay.reviewAt as string),
                    expiresAt: new Date(overlay.expiresAt as string),
                  });
                } catch {
                  return false;
                }
              }
              const updated = await database.update(tenantRbacRollout).set({
                httpMode: value.httpMode as "legacy" | "intersection" | "rbac" | "rbac-emergency",
                workerMode: value.workerMode as "legacy" | "intersection" | "rbac" | "rbac-emergency",
                epoch: BigInt(value.epoch),
                resolverVersion: value.resolverVersion,
                registryVersion: value.registryVersion,
                operationMapVersion: value.operationMapVersion,
                overlayHash: validatedOverlay?.overlayHash ?? null,
                overlayPolicyVersion: validatedOverlay?.policyVersion ?? null,
                overlayDeniedOperationIds: validatedOverlay?.deniedOperationIds ?? null,
                overlayDeniedPermissionKeys: validatedOverlay?.deniedPermissionKeys ?? null,
                overlayDenyMutations: validatedOverlay?.denyMutations ?? null,
                overlayReviewAt: validatedOverlay?.reviewAt ?? null,
                overlayExpiresAt: validatedOverlay?.expiresAt ?? null,
                multiRoleAcceptedAt: typeof value.multiRoleAcceptedAt === "string" ? new Date(value.multiRoleAcceptedAt) : null,
                version: input.expectedVersion + 1,
                updatedAt: new Date(),
              }).where(and(
                eq(tenantRbacRollout.tenantId, input.id),
                eq(tenantRbacRollout.version, input.expectedVersion),
              ));
              return (updated.rowCount ?? 0) === 1;
            },
            async resolveActor(principal) {
              if (principal.kind === "system") return { kind: "system", service: principal.service };
              const [account] = await database
                .select({ id: user.id, tenantId: user.tenantId, name: user.name, email: user.email })
                .from(user)
                .where(eq(user.id, principal.userId))
                .limit(1)
                .for("update");
              if (!account) return null;
              const [provider] = await database
                .select({ userId: providerAdmin.userId })
                .from(providerAdmin)
                .where(eq(providerAdmin.userId, principal.userId))
                .limit(1)
                .for("update");
              if (provider) {
                return principal.kind === "support-recovery"
                  ? {
                      kind: "support-recovery",
                      userId: account.id,
                      displayName: account.name,
                      email: account.email,
                      recoveryCaseId: principal.recoveryCaseId,
                    }
                  : {
                      kind: "provider-admin",
                      userId: account.id,
                      displayName: account.name,
                      email: account.email,
                    };
              }
              if (principal.kind === "support-recovery" || !account.tenantId) return null;
              return {
                kind: "tenant-user",
                userId: account.id,
                tenantId: account.tenantId,
                displayName: account.name,
                email: account.email,
              };
            },
            async defaultContext(principal, actor) {
              if (principal.kind === "system") return principal.context;
              if (actor.kind === "tenant-user") {
                return { kind: "tenant", contextId: actor.tenantId, tenantId: actor.tenantId };
              }
              return {
                kind: "provider",
                contextId: options.providerContextId,
                providerContextId: options.providerContextId,
              };
            },
            async findCommand(context, idempotencyKey) {
              const [row] = await database
                .select({
                  id: securityCommand.id,
                  commandName: securityCommand.commandName,
                  fingerprint: securityCommand.fingerprint,
                  status: securityCommand.status,
                  result: securityCommand.result,
                })
                .from(securityCommand)
                .where(and(contextWhere(context), eq(securityCommand.idempotencyKey, idempotencyKey)))
                .limit(1)
                .for("update");
              if (!row) return null;
              return { ...row, result: row.result as JsonValue | null };
            },
            async insertCommand(command) {
              await database.insert(securityCommand).values({
                ...valuesForContext(command.context),
                id: command.id,
                idempotencyKey: command.idempotencyKey,
                commandName: command.commandName,
                fingerprint: command.fingerprint,
                status: "pending",
                result: null,
                createdAt: command.createdAt,
                completedAt: null,
              });
            },
            async lockAuditHead(context, now) {
              await database.insert(securityAuditHead).values({
                ...valuesForContext(context),
                nextSequence: BigInt(1),
                headHash: "0".repeat(64),
                version: 1,
                updatedAt: now,
              }).onConflictDoUpdate({
                target: [securityAuditHead.securityContextKind, securityAuditHead.contextId],
                set: { contextId: sql`${securityAuditHead.contextId}` },
              });
              const [head] = await database
                .select({
                  nextSequence: securityAuditHead.nextSequence,
                  headHash: securityAuditHead.headHash,
                  version: securityAuditHead.version,
                })
                .from(securityAuditHead)
                .where(auditHeadWhere(context))
                .limit(1)
                .for("update");
              if (!head) throw new SecurityCommandError("integrity-failure");
              return head;
            },
            async insertAuditEvents(events) {
              if (!events.length) throw new SecurityCommandError("integrity-failure");
              await database.insert(securityAuditEvent).values(events.map((event) => ({
                ...valuesForContext(event.context),
                ...actorColumns(event.actor),
                id: event.id,
                sequence: event.sequence,
                eventKey: event.eventKey,
                schemaVersion: event.schemaVersion,
                eventType: event.eventType,
                outcome: event.outcome,
                actorKind: event.actor.kind,
                commandId: event.commandId,
                targetUserId: event.targets.userId ?? null,
                targetRoleId: event.targets.roleId ?? null,
                targetAssignmentId: event.targets.assignmentId ?? null,
                targetSchoolAdminAuthorityId: event.targets.schoolAdminAuthorityId ?? null,
                targetSchoolAdminProofId: event.targets.schoolAdminProofId ?? null,
                correlationId: event.correlationId,
                requestId: event.requestId ?? null,
                reason: event.reason ?? null,
                metadata: event.schemaVersion === 1
                  ? event.metadata
                  : { actor: actorEvidence(event.actor), evidence: event.evidence, details: event.metadata },
                canonicalPayloadDigest: event.canonicalPayloadDigest,
                previousHash: event.previousHash,
                eventHash: event.eventHash,
                occurredAt: event.occurredAt,
              })));
            },
            async updateAuditHead(context, previous, next, now) {
              const updated = await database.update(securityAuditHead).set({
                nextSequence: next.nextSequence,
                headHash: next.headHash,
                version: next.version,
                updatedAt: now,
              }).where(and(
                auditHeadWhere(context),
                eq(securityAuditHead.version, previous.version),
                eq(securityAuditHead.nextSequence, previous.nextSequence),
                eq(securityAuditHead.headHash, previous.headHash),
              ));
              return (updated.rowCount ?? 0) === 1;
            },
            async insertOutbox(events) {
              if (!events.length) return;
              await database.insert(securityOutbox).values(events.map((event) => ({
                ...valuesForContext(event.context),
                id: event.id,
                commandId: event.commandId,
                eventKey: event.eventKey,
                eventType: event.eventType,
                payload: event.payload,
                occurredAt: event.occurredAt,
                availableAt: event.availableAt,
              })));
            },
            async completeCommand(context, commandId, result, now) {
              const completed = await database.update(securityCommand).set({
                status: "completed",
                result,
                completedAt: now,
              }).where(and(
                contextWhere(context),
                eq(securityCommand.id, commandId),
                eq(securityCommand.status, "pending"),
              ));
              if ((completed.rowCount ?? 0) !== 1) throw new SecurityCommandError("integrity-failure");
            },
            checkpoint: options.afterStep,
          }));
        } catch (error) {
          if (attempt < maximumAttempts && retryableTransactionError(error)) continue;
          throw error;
        }
      }
    },
  };
}

const providerContextId = process.env.PROVIDER_SECURITY_CONTEXT_ID?.trim() || "simas-provider";
export const securityCommandStore = createMySqlSecurityCommandStore({ providerContextId });
