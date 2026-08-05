import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import {
  securityAuditEvidence,
  SecurityCommandError,
  type JsonValue,
  type OptimisticVersion,
  type SecurityActor,
  type SecurityAuditEventDraft,
  type SecurityCommandMutation,
  type SecurityCommandResult,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";

export const SCHOOL_ADMIN_PROOF_EXPIRY_MS = 72 * 60 * 60 * 1000;
export const SCHOOL_ADMIN_PROOF_SECRET_BYTES = 32;
export const SCHOOL_ADMIN_REASON_MAX_LENGTH = 1000;

/**
 * Canonical lifecycle event names. These names and their meanings must never
 * vary; UI labels are localized separately. The first seven are the canonical
 * lifecycle set from the design contract; the last two live in the credential
 * namespace and never imply an authority change.
 */
export const SCHOOL_ADMIN_EVENT_TYPES = {
  NOMINATION_CREATED: "school_admin.nomination_created",
  ACCOUNT_CONTROL_PROOF_COMPLETED: "school_admin.account_control_proof_completed",
  AUTHORITY_GRANTED: "school_admin.authority_granted",
  AUTHORITY_DISABLED: "school_admin.authority_disabled",
  REPLACEMENT_CUTOVER_COMPLETED: "school_admin.replacement_cutover_completed",
  RECOVERY_PROOF_COMPLETED: "school_admin.recovery_proof_completed",
  AUTHORITY_REACTIVATED: "school_admin.authority_reactivated",
  RECOVERY_STARTED: "school_admin.recovery_started",
  PROOF_SECRET_ROTATED: "school_admin.proof_secret_rotated",
} as const;

export type SchoolAdminAuthorityState = "none" | "active" | "disabled";
export type SchoolAdminProofState = "pending" | "completed" | "expired" | "cancelled";
export type SchoolAdminProofKind = "nomination" | "recovery";

export function normalizeSchoolAdminReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > SCHOOL_ADMIN_REASON_MAX_LENGTH) {
    throw new SecurityCommandError("invalid-command");
  }
  return normalized;
}

export function normalizeTargetEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new SecurityCommandError("invalid-command");
  }
  return normalized;
}

export function computeProofSecretDigest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateProofSecret(bytes = SCHOOL_ADMIN_PROOF_SECRET_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

export function constantTimeSecretMatches(secret: string, digest: string): boolean {
  const candidate = Buffer.from(computeProofSecretDigest(secret), "hex");
  const expected = Buffer.from(digest, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

/** A School Admin authority row joined with the account's legacy role and lifecycle. */
export type LifecycleAuthorityRow = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  authorityState: SchoolAdminAuthorityState;
  version: number;
  grantedAt: Date | null;
  disabledAt: Date | null;
  legacyRole: string | null;
  accountLifecycle: string | null;
}>;

export type LifecycleProofRow = Readonly<{
  id: string;
  tenantId: string;
  authorityId: string;
  caseId: string;
  kind: SchoolAdminProofKind;
  proofState: SchoolAdminProofState;
  secretDigest: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  version: number;
}>;

export type LifecycleUserRow = Readonly<{
  id: string;
  tenantId: string | null;
  tenantRole: string | null;
  providerAdmin: boolean;
  applicant: boolean;
}>;

/**
 * The persistence surface each lifecycle command needs. Implemented once over
 * the Drizzle/MySQL transaction and once over an in-memory fixture for unit
 * tests. All row reads used in a decision must be versioned/locked so the
 * caller sees a stable snapshot inside the transaction.
 */
export interface SchoolAdminLifecycleRepository {
  lockTenant(tenantId: string): Promise<boolean>;
  loadUserByEmail(email: string): Promise<LifecycleUserRow | null>;
  listAuthorities(tenantId: string): Promise<readonly LifecycleAuthorityRow[]>;
  insertAuthority(row: Readonly<{ id: string; tenantId: string; userId: string; createdAt: Date }>): Promise<void>;
  updateAuthority(input: Readonly<{
    id: string;
    tenantId: string;
    expectedVersion: number;
    authorityState: SchoolAdminAuthorityState;
    grantedAt: Date | null;
    disabledAt: Date | null;
    updatedAt: Date;
  }>): Promise<boolean>;
  loadProofByCaseId(tenantId: string, caseId: string): Promise<LifecycleProofRow | null>;
  listProofsByAuthority(tenantId: string, authorityId: string): Promise<readonly LifecycleProofRow[]>;
  insertProof(row: Readonly<{
    id: string;
    tenantId: string;
    authorityId: string;
    caseId: string;
    kind: SchoolAdminProofKind;
    proofState: "pending";
    secretDigest: string;
    expiresAt: Date;
    version: number;
    idempotencyKey: string;
    createdAt: Date;
  }>): Promise<void>;
  updateProof(input: Readonly<{
    id: string;
    tenantId: string;
    expectedVersion: number;
    proofState: SchoolAdminProofState;
    secretDigest?: string | null;
    expiresAt?: Date | null;
    completedAt?: Date | null;
    updatedAt: Date;
  }>): Promise<boolean>;
  setUserTenantRole(input: Readonly<{
    userId: string;
    tenantId: string;
    tenantRole: "school-admin" | null;
  }>): Promise<boolean>;
  revokeSessions(userId: string): Promise<number>;
}

export type SchoolAdminLifecycleExecutor<TTransaction extends object> = <TResult extends JsonValue>(input: Readonly<{
  principal: SecurityPrincipal;
  idempotencyKey: string;
  commandName: string;
  payload: JsonValue;
  expectedVersions?: readonly OptimisticVersion[];
  correlationId: string;
  requestId?: string;
  deriveContext?: (input: Readonly<{
    actor: SecurityActor;
    transaction: SecurityCommandStoreTransaction & TTransaction;
  }>) => Promise<SecurityContext>;
  authorizeAndMutate: (input: Readonly<{
    actor: SecurityActor;
    context: SecurityContext;
    expectedVersions: readonly OptimisticVersion[];
    transaction: SecurityCommandStoreTransaction & TTransaction;
  }>) => Promise<SecurityCommandMutation<TResult>>;
}>) => Promise<SecurityCommandResult<TResult>>;

export type SchoolAdminLifecycleService = Readonly<{
  nominateSchoolAdmin(input: SchoolAdminNominationInput): Promise<SchoolAdminNominationResult>;
  resendProofSecret(input: SchoolAdminProofResendInput): Promise<SchoolAdminProofResendResult>;
  completeAccountControlProof(input: SchoolAdminProofCompletionInput): Promise<SchoolAdminProofCompletionResult>;
  grantSchoolAdminAuthority(input: SchoolAdminGrantInput): Promise<SchoolAdminGrantResult>;
  disableSchoolAdminAuthority(input: SchoolAdminDisableInput): Promise<SchoolAdminDisableResult>;
  completeSchoolAdminReplacement(input: SchoolAdminReplacementInput): Promise<SchoolAdminReplacementResult>;
  startSchoolAdminRecovery(input: SchoolAdminRecoveryStartInput): Promise<SchoolAdminRecoveryStartResult>;
  completeRecoveryProof(input: SchoolAdminProofCompletionInput): Promise<SchoolAdminRecoveryProofCompletionResult>;
  reactivateSchoolAdminAuthority(input: SchoolAdminReactivateInput): Promise<SchoolAdminReactivateResult>;
}>;

export type SchoolAdminNominationInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  email: string;
  reason: string;
  caseId: string;
  incumbentAuthorityId?: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminNominationResult = Readonly<{
  status: "nomination-created";
  authorityId: string;
  proofId: string;
  caseId: string;
  proofState: "pending";
  secret: string;
  secretExpiresAt: string;
  nomineeUserId: string;
  replacement: boolean;
}>;

export type SchoolAdminProofResendInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  caseId: string;
  expectedProofVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminProofResendResult = Readonly<{
  status: "secret-rotated";
  proofId: string;
  caseId: string;
  proofState: "pending";
  secret: string;
  secretExpiresAt: string;
}>;

export type SchoolAdminProofCompletionInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  caseId: string;
  expectedProofVersion: number;
  secret: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminProofCompletionResult = Readonly<{
  status: "proof-completed";
  proofId: string;
  caseId: string;
  proofState: "completed";
  authorityState: SchoolAdminAuthorityState;
}>;

export type SchoolAdminGrantInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  caseId: string;
  authorityId: string;
  expectedAuthorityVersion: number;
  expectedProofVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminGrantResult = Readonly<{
  status: "granted";
  authorityId: string;
  proofId: string;
  activeCount: number;
}>;

export type SchoolAdminDisableInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  authorityId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminDisableResult = Readonly<{
  status: "disabled";
  remainingActive: number;
}>;

export type SchoolAdminReplacementInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  caseId: string;
  successorAuthorityId: string;
  successorExpectedVersion: number;
  incumbentAuthorityId: string;
  incumbentExpectedVersion: number;
  expectedProofVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminReplacementResult = Readonly<{
  status: "cutover-completed";
  successorAuthorityId: string;
  incumbentAuthorityId: string;
  activeCount: number;
}>;

export type SchoolAdminRecoveryStartInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  authorityId: string;
  expectedAuthorityVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminRecoveryStartResult = Readonly<{
  status: "recovery-started";
  proofId: string;
  caseId: string;
  proofState: "pending";
  secret: string;
  secretExpiresAt: string;
}>;

export type SchoolAdminRecoveryProofCompletionResult = Readonly<{
  status: "proof-completed";
  proofId: string;
  caseId: string;
  proofState: "completed";
  authorityState: SchoolAdminAuthorityState;
}>;

export type SchoolAdminReactivateInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  caseId: string;
  authorityId: string;
  expectedAuthorityVersion: number;
  expectedProofVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type SchoolAdminReactivateResult = Readonly<{
  status: "reactivated";
  authorityId: string;
  proofId: string;
  activeCount: number;
}>;

function usableActiveRows(rows: readonly LifecycleAuthorityRow[]): LifecycleAuthorityRow[] {
  return rows.filter((row) =>
    row.authorityState === "active"
    && row.legacyRole === "school-admin"
    && (row.accountLifecycle === null || row.accountLifecycle === "active"));
}

function tenantContext(tenantId: string): SecurityContext {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

function schoolAdminAudit(metadata: Readonly<Record<string, JsonValue>>): Readonly<{
  evidence: ReturnType<typeof securityAuditEvidence>;
  metadata: Readonly<Record<string, JsonValue>>;
}> {
  const before: Record<string, JsonValue> = {};
  const after: Record<string, JsonValue> = {};
  const diff: Record<string, JsonValue> = {};
  const eventMetadata: Record<string, JsonValue> = {};
  const versionFields: string[] = [];

  for (const key of Object.keys(metadata).sort()) {
    if (key === "caseId" || key.endsWith("After")) continue;
    if (key.endsWith("Before")) {
      const field = key.slice(0, -"Before".length);
      const afterKey = `${field}After`;
      if (Object.hasOwn(metadata, afterKey)) {
        before[field] = metadata[key];
        after[field] = metadata[afterKey];
        diff[field] = { before: metadata[key], after: metadata[afterKey] };
        if (field.endsWith("Version")) versionFields.push(field);
        continue;
      }
    }
    eventMetadata[key] = metadata[key];
  }

  const versionField = versionFields.length === 1 ? versionFields[0] : null;
  return {
    evidence: securityAuditEvidence({
      before: Object.keys(before).length === 0 ? null : before,
      after: Object.keys(after).length === 0 ? null : after,
      diff: Object.keys(diff).length === 0 ? null : diff,
      version: versionField === null ? undefined : {
        before: before[versionField] as number,
        after: after[versionField] as number,
      },
      caseId: typeof metadata.caseId === "string" ? metadata.caseId : null,
    }),
    metadata: eventMetadata,
  };
}

export function createSchoolAdminLifecycleService<TTransaction extends object>(dependencies: Readonly<{
  execute: SchoolAdminLifecycleExecutor<TTransaction>;
  repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => SchoolAdminLifecycleRepository;
  createId?: () => string;
  generateSecret?: () => string;
  now?: () => Date;
}>): SchoolAdminLifecycleService {
  const createId = dependencies.createId ?? randomUUID;
  const generateSecret = dependencies.generateSecret ?? generateProofSecret;
  const now = dependencies.now ?? (() => new Date());

  const service: SchoolAdminLifecycleService = {
    async nominateSchoolAdmin(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      if (input.incumbentAuthorityId !== undefined) assertIdentifier(input.incumbentAuthorityId);
      const reason = normalizeSchoolAdminReason(input.reason);
      const email = normalizeTargetEmail(input.email);
      const secret = generateSecret();
      const secretDigest = computeProofSecretDigest(secret);
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + SCHOOL_ADMIN_PROOF_EXPIRY_MS);
      const authorityId = createId();
      const proofId = createId();

      const command = await dependencies.execute<SchoolAdminNominationResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.nominate",
        payload: {
          tenantId: input.tenantId,
          email,
          caseId: input.caseId,
          incumbentAuthorityId: input.incumbentAuthorityId ?? null,
        },
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const candidate = await repo.loadUserByEmail(email);
          if (!candidate) throw new SecurityCommandError("context-denied");
          if (candidate.tenantId !== input.tenantId || candidate.providerAdmin || candidate.applicant) {
            throw new SecurityCommandError("context-denied");
          }
          const roster = await repo.listAuthorities(input.tenantId);
          if (roster.some((row) => row.userId === candidate.id)) throw new SecurityCommandError("context-denied");
          let incumbentUserId: string | null = null;
          if (input.incumbentAuthorityId !== undefined) {
            const incumbent = roster.find((row) => row.id === input.incumbentAuthorityId);
            if (!incumbent || incumbent.userId === candidate.id || incumbent.authorityState !== "active"
              || incumbent.legacyRole !== "school-admin") {
              throw new SecurityCommandError("context-denied");
            }
            incumbentUserId = incumbent.userId;
          }
          const activeBefore = usableActiveRows(roster).length;
          await repo.insertAuthority({ id: authorityId, tenantId: input.tenantId, userId: candidate.id, createdAt });
          await repo.insertProof({
            id: proofId,
            tenantId: input.tenantId,
            authorityId,
            caseId: input.caseId,
            kind: "nomination",
            proofState: "pending",
            secretDigest,
            expiresAt,
            version: 1,
            idempotencyKey: input.idempotencyKey,
            createdAt,
          });
          return {
            result: {
              status: "nomination-created",
              authorityId,
              proofId,
              caseId: input.caseId,
              proofState: "pending",
              secret,
              secretExpiresAt: expiresAt.toISOString(),
              nomineeUserId: candidate.id,
              replacement: input.incumbentAuthorityId !== undefined,
            },
            versionTransitions: [],
            auditEvents: [{
              purpose: "nomination-created",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.NOMINATION_CREATED,
              targets: { userId: candidate.id, schoolAdminAuthorityId: authorityId, schoolAdminProofId: proofId },
              reason,
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "nomination",
                incumbentAuthorityId: input.incumbentAuthorityId ?? null,
                incumbentUserId,
                authorityStateBefore: "none",
                authorityStateAfter: "none",
                proofStateBefore: null,
                proofStateAfter: "pending",
                proofExpiresAt: expiresAt.toISOString(),
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore,
                replacement: input.incumbentAuthorityId !== undefined,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async resendProofSecret(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      const reason = normalizeSchoolAdminReason(input.reason);
      const secret = generateSecret();
      const secretDigest = computeProofSecretDigest(secret);
      const expiresAt = new Date(now().getTime() + SCHOOL_ADMIN_PROOF_EXPIRY_MS);

      const command = await dependencies.execute<SchoolAdminProofResendResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.proof-resend",
        payload: { tenantId: input.tenantId, caseId: input.caseId },
        expectedVersions: [{
          resourceType: "school-admin-proof",
          resourceId: input.caseId,
          expectedVersion: input.expectedProofVersion,
        }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.proofState !== "pending") throw new SecurityCommandError("context-denied");
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          const authority = (await repo.listAuthorities(input.tenantId)).find((row) => row.id === proof.authorityId);
          if (!authority) throw new SecurityCommandError("integrity-failure");
          const updated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "pending",
            secretDigest,
            expiresAt,
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");
          return {
            result: {
              status: "secret-rotated",
              proofId: proof.id,
              caseId: input.caseId,
              proofState: "pending",
              secret,
              secretExpiresAt: expiresAt.toISOString(),
            },
            versionTransitions: [{
              resourceType: "school-admin-proof",
              resourceId: input.caseId,
              expectedVersion: input.expectedProofVersion,
              toVersion: input.expectedProofVersion + 1,
            }],
            auditEvents: [{
              purpose: "proof-secret-rotated",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.PROOF_SECRET_ROTATED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proof.id },
              reason,
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: proof.kind,
                authorityStateBefore: authority.authorityState,
                authorityStateAfter: authority.authorityState,
                proofStateBefore: "pending",
                proofStateAfter: "pending",
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                proofExpiresAt: expiresAt.toISOString(),
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async completeAccountControlProof(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      if (!input.secret || input.secret.length > 512) throw new SecurityCommandError("invalid-command");

      const command = await dependencies.execute<SchoolAdminProofCompletionResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.account-control-proof",
        payload: { tenantId: input.tenantId, caseId: input.caseId },
        expectedVersions: [{
          resourceType: "school-admin-proof",
          resourceId: input.caseId,
          expectedVersion: input.expectedProofVersion,
        }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin" && actor.kind !== "tenant-user") {
            throw new SecurityCommandError("context-denied");
          }
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.kind !== "nomination" || proof.proofState !== "pending") {
            throw new SecurityCommandError("context-denied");
          }
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          if (!proof.expiresAt || proof.expiresAt.getTime() <= now().getTime()) {
            await repo.updateProof({
              id: proof.id,
              tenantId: input.tenantId,
              expectedVersion: proof.version,
              proofState: "expired",
              updatedAt: now(),
            });
            throw new SecurityCommandError("context-denied");
          }
          if (!proof.secretDigest || !constantTimeSecretMatches(input.secret, proof.secretDigest)) {
            throw new SecurityCommandError("context-denied");
          }
          const authority = (await repo.listAuthorities(input.tenantId)).find((row) => row.id === proof.authorityId);
          if (!authority || authority.authorityState !== "none") throw new SecurityCommandError("context-denied");
          const updated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "completed",
            completedAt: now(),
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");
          const roster = await repo.listAuthorities(input.tenantId);
          const activeCount = usableActiveRows(roster).length;
          return {
            result: {
              status: "proof-completed",
              proofId: proof.id,
              caseId: input.caseId,
              proofState: "completed",
              authorityState: "none",
            },
            versionTransitions: [{
              resourceType: "school-admin-proof",
              resourceId: input.caseId,
              expectedVersion: input.expectedProofVersion,
              toVersion: input.expectedProofVersion + 1,
            }],
            auditEvents: [{
              purpose: "account-control-proof-completed",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.ACCOUNT_CONTROL_PROOF_COMPLETED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proof.id },
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "nomination",
                authorityStateBefore: "none",
                authorityStateAfter: "none",
                proofStateBefore: "pending",
                proofStateAfter: "completed",
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                activeCountBefore: activeCount,
                activeCountAfter: activeCount,
                revocationCount: 0,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async grantSchoolAdminAuthority(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      assertIdentifier(input.authorityId);
      const reason = normalizeSchoolAdminReason(input.reason);

      const command = await dependencies.execute<SchoolAdminGrantResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.authority-grant",
        payload: { tenantId: input.tenantId, caseId: input.caseId, authorityId: input.authorityId },
        expectedVersions: [
          {
            resourceType: "school-admin-authority",
            resourceId: input.authorityId,
            expectedVersion: input.expectedAuthorityVersion,
          },
          {
            resourceType: "school-admin-proof",
            resourceId: input.caseId,
            expectedVersion: input.expectedProofVersion,
          },
        ],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.kind !== "nomination" || proof.proofState !== "completed") {
            throw new SecurityCommandError("context-denied");
          }
          if (proof.authorityId !== input.authorityId) throw new SecurityCommandError("context-denied");
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          const roster = await repo.listAuthorities(input.tenantId);
          const authority = roster.find((row) => row.id === input.authorityId);
          if (!authority || authority.authorityState !== "none") throw new SecurityCommandError("context-denied");
          if (authority.version !== input.expectedAuthorityVersion) throw new SecurityCommandError("stale-version");
          const activeBefore = usableActiveRows(roster).length;
          if (activeBefore < 1) throw new SecurityCommandError("integrity-failure");
          const updatedAt = now();
          const grantedAt = now();
          const authorityUpdated = await repo.updateAuthority({
            id: authority.id,
            tenantId: input.tenantId,
            expectedVersion: authority.version,
            authorityState: "active",
            grantedAt,
            disabledAt: null,
            updatedAt,
          });
          if (!authorityUpdated) throw new SecurityCommandError("stale-version");
          const roleUpdated = await repo.setUserTenantRole({
            userId: authority.userId,
            tenantId: input.tenantId,
            tenantRole: "school-admin",
          });
          if (!roleUpdated) throw new SecurityCommandError("integrity-failure");
          const obsolete = (await repo.listProofsByAuthority(input.tenantId, authority.id))
            .filter((row) => row.proofState === "pending" && row.kind === "nomination");
          for (const row of obsolete) {
            await repo.updateProof({
              id: row.id,
              tenantId: input.tenantId,
              expectedVersion: row.version,
              proofState: "cancelled",
              updatedAt,
            });
          }
          const proofUpdated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "completed",
            completedAt: proof.completedAt,
            updatedAt,
          });
          if (!proofUpdated) throw new SecurityCommandError("stale-version");
          return {
            result: {
              status: "granted",
              authorityId: authority.id,
              proofId: proof.id,
              activeCount: activeBefore + 1,
            },
            versionTransitions: [
              {
                resourceType: "school-admin-authority",
                resourceId: input.authorityId,
                expectedVersion: input.expectedAuthorityVersion,
                toVersion: input.expectedAuthorityVersion + 1,
              },
              {
                resourceType: "school-admin-proof",
                resourceId: input.caseId,
                expectedVersion: input.expectedProofVersion,
                toVersion: input.expectedProofVersion + 1,
              },
            ],
            auditEvents: [{
              purpose: "authority-granted",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_GRANTED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proof.id },
              reason,
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "nomination",
                authorityStateBefore: "none",
                authorityStateAfter: "active",
                proofStateBefore: "completed",
                proofStateAfter: "completed",
                authorityVersionBefore: authority.version,
                authorityVersionAfter: authority.version + 1,
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore + 1,
                revocationCount: obsolete.length,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async disableSchoolAdminAuthority(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.authorityId);
      const reason = normalizeSchoolAdminReason(input.reason);

      const command = await dependencies.execute<SchoolAdminDisableResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.authority-disable",
        payload: { tenantId: input.tenantId, authorityId: input.authorityId },
        expectedVersions: [{
          resourceType: "school-admin-authority",
          resourceId: input.authorityId,
          expectedVersion: input.expectedVersion,
        }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const roster = await repo.listAuthorities(input.tenantId);
          const target = roster.find((row) => row.id === input.authorityId);
          if (!target || target.authorityState !== "active" || target.legacyRole !== "school-admin") {
            throw new SecurityCommandError("context-denied");
          }
          if (target.version !== input.expectedVersion) throw new SecurityCommandError("stale-version");
          const activeRows = usableActiveRows(roster);
          if (activeRows.length <= 1) throw new SecurityCommandError("integrity-failure");
          const updatedAt = now();
          const updated = await repo.updateAuthority({
            id: target.id,
            tenantId: input.tenantId,
            expectedVersion: target.version,
            authorityState: "disabled",
            grantedAt: target.grantedAt,
            disabledAt: updatedAt,
            updatedAt,
          });
          if (!updated) throw new SecurityCommandError("stale-version");
          const roleUpdated = await repo.setUserTenantRole({
            userId: target.userId,
            tenantId: input.tenantId,
            tenantRole: null,
          });
          if (!roleUpdated) throw new SecurityCommandError("integrity-failure");
          const revoked = await repo.revokeSessions(target.userId);
          return {
            result: { status: "disabled", remainingActive: activeRows.length - 1 },
            versionTransitions: [{
              resourceType: "school-admin-authority",
              resourceId: input.authorityId,
              expectedVersion: input.expectedVersion,
              toVersion: input.expectedVersion + 1,
            }],
            auditEvents: [{
              purpose: "authority-disabled",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_DISABLED,
              targets: { userId: target.userId, schoolAdminAuthorityId: target.id },
              reason,
              ...schoolAdminAudit({
                caseId: null,
                authorityStateBefore: "active",
                authorityStateAfter: "disabled",
                authorityVersionBefore: target.version,
                authorityVersionAfter: target.version + 1,
                activeCountBefore: activeRows.length,
                activeCountAfter: activeRows.length - 1,
                revocationCount: revoked,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async completeSchoolAdminReplacement(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      assertIdentifier(input.successorAuthorityId);
      assertIdentifier(input.incumbentAuthorityId);
      const reason = normalizeSchoolAdminReason(input.reason);

      const command = await dependencies.execute<SchoolAdminReplacementResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.replacement-cutover",
        payload: {
          tenantId: input.tenantId,
          caseId: input.caseId,
          successorAuthorityId: input.successorAuthorityId,
          incumbentAuthorityId: input.incumbentAuthorityId,
        },
        expectedVersions: [
          {
            resourceType: "school-admin-authority",
            resourceId: input.successorAuthorityId,
            expectedVersion: input.successorExpectedVersion,
          },
          {
            resourceType: "school-admin-authority",
            resourceId: input.incumbentAuthorityId,
            expectedVersion: input.incumbentExpectedVersion,
          },
          {
            resourceType: "school-admin-proof",
            resourceId: input.caseId,
            expectedVersion: input.expectedProofVersion,
          },
        ],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.kind !== "nomination" || proof.proofState !== "completed") {
            throw new SecurityCommandError("context-denied");
          }
          if (proof.authorityId !== input.successorAuthorityId) throw new SecurityCommandError("context-denied");
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          const roster = await repo.listAuthorities(input.tenantId);
          const successor = roster.find((row) => row.id === input.successorAuthorityId);
          const incumbent = roster.find((row) => row.id === input.incumbentAuthorityId);
          if (!successor || successor.authorityState !== "none") throw new SecurityCommandError("context-denied");
          if (successor.version !== input.successorExpectedVersion) throw new SecurityCommandError("stale-version");
          if (!incumbent || incumbent.authorityState !== "active" || incumbent.legacyRole !== "school-admin") {
            throw new SecurityCommandError("context-denied");
          }
          if (incumbent.version !== input.incumbentExpectedVersion) throw new SecurityCommandError("stale-version");
          if (successor.userId === incumbent.userId) throw new SecurityCommandError("context-denied");
          const activeBefore = usableActiveRows(roster).length;
          if (activeBefore < 1) throw new SecurityCommandError("integrity-failure");
          const updatedAt = now();
          const grantedAt = now();
          const successorUpdated = await repo.updateAuthority({
            id: successor.id,
            tenantId: input.tenantId,
            expectedVersion: successor.version,
            authorityState: "active",
            grantedAt,
            disabledAt: null,
            updatedAt,
          });
          if (!successorUpdated) throw new SecurityCommandError("stale-version");
          const incumbentUpdated = await repo.updateAuthority({
            id: incumbent.id,
            tenantId: input.tenantId,
            expectedVersion: incumbent.version,
            authorityState: "disabled",
            grantedAt: incumbent.grantedAt,
            disabledAt: updatedAt,
            updatedAt,
          });
          if (!incumbentUpdated) throw new SecurityCommandError("stale-version");
          const successorRole = await repo.setUserTenantRole({
            userId: successor.userId,
            tenantId: input.tenantId,
            tenantRole: "school-admin",
          });
          const incumbentRole = await repo.setUserTenantRole({
            userId: incumbent.userId,
            tenantId: input.tenantId,
            tenantRole: null,
          });
          if (!successorRole || !incumbentRole) throw new SecurityCommandError("integrity-failure");
          const revoked = await repo.revokeSessions(incumbent.userId);
          const proofUpdated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "completed",
            completedAt: proof.completedAt,
            updatedAt,
          });
          if (!proofUpdated) throw new SecurityCommandError("stale-version");
          const auditEvents: readonly SecurityAuditEventDraft[] = [
            {
              purpose: "replacement-cutover-completed",
              order: "parent",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.REPLACEMENT_CUTOVER_COMPLETED,
              targets: { schoolAdminProofId: proof.id },
              reason,
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "replacement",
                successorAuthorityId: successor.id,
                successorUserId: successor.userId,
                incumbentAuthorityId: incumbent.id,
                incumbentUserId: incumbent.userId,
                successorAuthorityStateBefore: "none",
                successorAuthorityStateAfter: "active",
                incumbentAuthorityStateBefore: "active",
                incumbentAuthorityStateAfter: "disabled",
                proofStateBefore: "completed",
                proofStateAfter: "completed",
                successorAuthorityVersionBefore: successor.version,
                successorAuthorityVersionAfter: successor.version + 1,
                incumbentAuthorityVersionBefore: incumbent.version,
                incumbentAuthorityVersionAfter: incumbent.version + 1,
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore,
                revocationCount: revoked,
              }),
            },
            {
              purpose: "successor-authority-granted",
              order: "child",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_GRANTED,
              targets: { userId: successor.userId, schoolAdminAuthorityId: successor.id, schoolAdminProofId: proof.id },
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "replacement",
                authorityStateBefore: "none",
                authorityStateAfter: "active",
                authorityVersionBefore: successor.version,
                authorityVersionAfter: successor.version + 1,
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore,
              }),
            },
            {
              purpose: "incumbent-authority-disabled",
              order: "child",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_DISABLED,
              targets: { userId: incumbent.userId, schoolAdminAuthorityId: incumbent.id },
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "replacement",
                authorityStateBefore: "active",
                authorityStateAfter: "disabled",
                authorityVersionBefore: incumbent.version,
                authorityVersionAfter: incumbent.version + 1,
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore,
                revocationCount: revoked,
              }),
            },
          ];
          return {
            result: {
              status: "cutover-completed",
              successorAuthorityId: successor.id,
              incumbentAuthorityId: incumbent.id,
              activeCount: activeBefore,
            },
            versionTransitions: [
              {
                resourceType: "school-admin-authority",
                resourceId: input.successorAuthorityId,
                expectedVersion: input.successorExpectedVersion,
                toVersion: input.successorExpectedVersion + 1,
              },
              {
                resourceType: "school-admin-authority",
                resourceId: input.incumbentAuthorityId,
                expectedVersion: input.incumbentExpectedVersion,
                toVersion: input.incumbentExpectedVersion + 1,
              },
              {
                resourceType: "school-admin-proof",
                resourceId: input.caseId,
                expectedVersion: input.expectedProofVersion,
                toVersion: input.expectedProofVersion + 1,
              },
            ],
            auditEvents,
          };
        },
      });
      return command.result;
    },

    async startSchoolAdminRecovery(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.authorityId);
      const reason = normalizeSchoolAdminReason(input.reason);
      const secret = generateSecret();
      const secretDigest = computeProofSecretDigest(secret);
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + SCHOOL_ADMIN_PROOF_EXPIRY_MS);
      const proofId = createId();
      const caseId = createId();

      const command = await dependencies.execute<SchoolAdminRecoveryStartResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.recovery-start",
        payload: { tenantId: input.tenantId, authorityId: input.authorityId },
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const roster = await repo.listAuthorities(input.tenantId);
          const authority = roster.find((row) => row.id === input.authorityId);
          if (!authority || authority.authorityState !== "disabled") throw new SecurityCommandError("context-denied");
          if (authority.version !== input.expectedAuthorityVersion) throw new SecurityCommandError("stale-version");
          const pending = (await repo.listProofsByAuthority(input.tenantId, authority.id))
            .some((row) => row.proofState === "pending" && row.kind === "recovery");
          if (pending) throw new SecurityCommandError("context-denied");
          const activeBefore = usableActiveRows(roster).length;
          await repo.insertProof({
            id: proofId,
            tenantId: input.tenantId,
            authorityId: authority.id,
            caseId,
            kind: "recovery",
            proofState: "pending",
            secretDigest,
            expiresAt,
            version: 1,
            idempotencyKey: input.idempotencyKey,
            createdAt,
          });
          return {
            result: {
              status: "recovery-started",
              proofId,
              caseId,
              proofState: "pending",
              secret,
              secretExpiresAt: expiresAt.toISOString(),
            },
            versionTransitions: [],
            auditEvents: [{
              purpose: "recovery-started",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.RECOVERY_STARTED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proofId },
              reason,
              ...schoolAdminAudit({
                caseId,
                kind: "recovery",
                authorityStateBefore: "disabled",
                authorityStateAfter: "disabled",
                proofStateBefore: null,
                proofStateAfter: "pending",
                proofExpiresAt: expiresAt.toISOString(),
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async completeRecoveryProof(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      if (!input.secret || input.secret.length > 512) throw new SecurityCommandError("invalid-command");

      const command = await dependencies.execute<SchoolAdminRecoveryProofCompletionResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.recovery-proof",
        payload: { tenantId: input.tenantId, caseId: input.caseId },
        expectedVersions: [{
          resourceType: "school-admin-proof",
          resourceId: input.caseId,
          expectedVersion: input.expectedProofVersion,
        }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") {
            throw new SecurityCommandError("context-denied");
          }
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.kind !== "recovery" || proof.proofState !== "pending") {
            throw new SecurityCommandError("context-denied");
          }
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          if (!proof.expiresAt || proof.expiresAt.getTime() <= now().getTime()) {
            await repo.updateProof({
              id: proof.id,
              tenantId: input.tenantId,
              expectedVersion: proof.version,
              proofState: "expired",
              updatedAt: now(),
            });
            throw new SecurityCommandError("context-denied");
          }
          if (!proof.secretDigest || !constantTimeSecretMatches(input.secret, proof.secretDigest)) {
            throw new SecurityCommandError("context-denied");
          }
          const authority = (await repo.listAuthorities(input.tenantId)).find((row) => row.id === proof.authorityId);
          if (!authority || authority.authorityState !== "disabled") throw new SecurityCommandError("context-denied");
          const updated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "completed",
            completedAt: now(),
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");
          const roster = await repo.listAuthorities(input.tenantId);
          const activeCount = usableActiveRows(roster).length;
          return {
            result: {
              status: "proof-completed",
              proofId: proof.id,
              caseId: input.caseId,
              proofState: "completed",
              authorityState: "disabled",
            },
            versionTransitions: [{
              resourceType: "school-admin-proof",
              resourceId: input.caseId,
              expectedVersion: input.expectedProofVersion,
              toVersion: input.expectedProofVersion + 1,
            }],
            auditEvents: [{
              purpose: "recovery-proof-completed",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.RECOVERY_PROOF_COMPLETED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proof.id },
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "recovery",
                authorityStateBefore: "disabled",
                authorityStateAfter: "disabled",
                proofStateBefore: "pending",
                proofStateAfter: "completed",
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                activeCountBefore: activeCount,
                activeCountAfter: activeCount,
                revocationCount: 0,
              }),
            }],
          };
        },
      });
      return command.result;
    },

    async reactivateSchoolAdminAuthority(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.caseId);
      assertIdentifier(input.authorityId);
      const reason = normalizeSchoolAdminReason(input.reason);

      const command = await dependencies.execute<SchoolAdminReactivateResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "school-admin.authority-reactivate",
        payload: { tenantId: input.tenantId, caseId: input.caseId, authorityId: input.authorityId },
        expectedVersions: [
          {
            resourceType: "school-admin-authority",
            resourceId: input.authorityId,
            expectedVersion: input.expectedAuthorityVersion,
          },
          {
            resourceType: "school-admin-proof",
            resourceId: input.caseId,
            expectedVersion: input.expectedProofVersion,
          },
        ],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
          const repo = dependencies.repository(transaction);
          if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
          const proof = await repo.loadProofByCaseId(input.tenantId, input.caseId);
          if (!proof || proof.kind !== "recovery" || proof.proofState !== "completed") {
            throw new SecurityCommandError("context-denied");
          }
          if (proof.authorityId !== input.authorityId) throw new SecurityCommandError("context-denied");
          if (proof.version !== input.expectedProofVersion) throw new SecurityCommandError("stale-version");
          const roster = await repo.listAuthorities(input.tenantId);
          const authority = roster.find((row) => row.id === input.authorityId);
          if (!authority || authority.authorityState !== "disabled") throw new SecurityCommandError("context-denied");
          if (authority.version !== input.expectedAuthorityVersion) throw new SecurityCommandError("stale-version");
          const activeBefore = usableActiveRows(roster).length;
          const updatedAt = now();
          const grantedAt = now();
          const authorityUpdated = await repo.updateAuthority({
            id: authority.id,
            tenantId: input.tenantId,
            expectedVersion: authority.version,
            authorityState: "active",
            grantedAt,
            disabledAt: null,
            updatedAt,
          });
          if (!authorityUpdated) throw new SecurityCommandError("stale-version");
          const roleUpdated = await repo.setUserTenantRole({
            userId: authority.userId,
            tenantId: input.tenantId,
            tenantRole: "school-admin",
          });
          if (!roleUpdated) throw new SecurityCommandError("integrity-failure");
          const proofUpdated = await repo.updateProof({
            id: proof.id,
            tenantId: input.tenantId,
            expectedVersion: proof.version,
            proofState: "completed",
            completedAt: proof.completedAt,
            updatedAt,
          });
          if (!proofUpdated) throw new SecurityCommandError("stale-version");
          return {
            result: {
              status: "reactivated",
              authorityId: authority.id,
              proofId: proof.id,
              activeCount: activeBefore + 1,
            },
            versionTransitions: [
              {
                resourceType: "school-admin-authority",
                resourceId: input.authorityId,
                expectedVersion: input.expectedAuthorityVersion,
                toVersion: input.expectedAuthorityVersion + 1,
              },
              {
                resourceType: "school-admin-proof",
                resourceId: input.caseId,
                expectedVersion: input.expectedProofVersion,
                toVersion: input.expectedProofVersion + 1,
              },
            ],
            auditEvents: [{
              purpose: "authority-reactivated",
              order: "summary",
              eventType: SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_REACTIVATED,
              targets: { userId: authority.userId, schoolAdminAuthorityId: authority.id, schoolAdminProofId: proof.id },
              reason,
              ...schoolAdminAudit({
                caseId: input.caseId,
                kind: "recovery",
                authorityStateBefore: "disabled",
                authorityStateAfter: "active",
                proofStateBefore: "completed",
                proofStateAfter: "completed",
                authorityVersionBefore: authority.version,
                authorityVersionAfter: authority.version + 1,
                proofVersionBefore: proof.version,
                proofVersionAfter: proof.version + 1,
                activeCountBefore: activeBefore,
                activeCountAfter: activeBefore + 1,
                revocationCount: 0,
              }),
            }],
          };
        },
      });
      return command.result;
    },
  };

  return service;
}
