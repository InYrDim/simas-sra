import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import {
  SecurityCommandError,
  type JsonValue,
  type OptimisticVersion,
  type SecurityActor,
  type SecurityCommandMutation,
  type SecurityCommandResult,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";

export type AccountLifecycle = "pending-activation" | "active" | "inactive";
export type LifecycleCaseKind = "activation" | "recovery";
export type LifecycleDeliveryChannel = "email" | "temporary-credential";

export type TenantLifecycleAccount = Readonly<{
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  lifecycle: AccountLifecycle;
  version: number;
  assignmentVersion: number;
  schoolAdmin: boolean;
  linkedPersonId: string | null;
}>;

export type AccountLifecycleCase = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  kind: LifecycleCaseKind;
  state: "pending" | "completed" | "expired" | "cancelled" | "revoked";
  deliveryChannel: LifecycleDeliveryChannel;
  secretDigest: string;
  expiresAt: Date;
  consumedAt: Date | null;
  deliveryAttempts: number;
  version: number;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type LifecycleRole = Readonly<{ id: string; tenantId: string; lifecycle: "draft" | "active" | "archived" }>;
export type LifecycleAssignment = Readonly<{ id: string; roleId: string; state: "active" | "suspended"; version: number }>;
export type LifecyclePerson = Readonly<{ id: string; tenantId: string; accountUserId: string | null; archived: boolean }>;

export interface AccountLifecycleRepository {
  lockTenant(tenantId: string): Promise<boolean>;
  isSchoolAdmin(tenantId: string, userId: string): Promise<boolean>;
  findIdentityByEmail(email: string): Promise<TenantLifecycleAccount | null>;
  getAccount(tenantId: string, userId: string): Promise<TenantLifecycleAccount | null>;
  getPerson(tenantId: string, personId: string): Promise<LifecyclePerson | null>;
  listRoles(tenantId: string): Promise<readonly LifecycleRole[]>;
  listAssignments(tenantId: string, userId: string): Promise<readonly LifecycleAssignment[]>;
  findPendingCase(tenantId: string, userId: string, kind: LifecycleCaseKind): Promise<AccountLifecycleCase | null>;
  createAccount(input: Readonly<{ userId: string; accountId: string; tenantId: string; name: string; email: string; lifecycle: AccountLifecycle; initialCredential: string; createdAt: Date }>): Promise<TenantLifecycleAccount>;
  linkPerson(tenantId: string, personId: string, userId: string, expectedVersion: number, updatedAt: Date): Promise<void>;
  createCase(value: AccountLifecycleCase): Promise<void>;
  revokePendingCases(tenantId: string, userId: string, updatedAt: Date): Promise<void>;
  transitionLifecycle(input: Readonly<{ tenantId: string; userId: string; expectedVersion: number; lifecycle: AccountLifecycle; bumpAssignmentVersion: boolean; updatedAt: Date }>): Promise<boolean>;
  suspendAssignments(tenantId: string, userId: string, updatedAt: Date): Promise<readonly string[]>;
  restoreAssignments(tenantId: string, userId: string, roleIds: readonly string[], updatedAt: Date): Promise<readonly string[]>;
  revokeSessions(userId: string): Promise<number>;
}

type Executor<TTransaction extends object> = <TResult extends JsonValue>(input: Readonly<{
  principal: SecurityPrincipal;
  idempotencyKey: string;
  commandName: string;
  payload: JsonValue;
  expectedVersions?: readonly OptimisticVersion[];
  correlationId: string;
  requestId?: string;
  deriveContext?: (input: Readonly<{ actor: SecurityActor; transaction: SecurityCommandStoreTransaction & TTransaction }>) => Promise<SecurityContext>;
  authorizeAndMutate: (input: Readonly<{ actor: SecurityActor; context: SecurityContext; expectedVersions: readonly OptimisticVersion[]; transaction: SecurityCommandStoreTransaction & TTransaction }>) => Promise<SecurityCommandMutation<TResult>>;
}>) => Promise<SecurityCommandResult<TResult>>;

type CommandBase = Readonly<{ principal: SecurityPrincipal; tenantId: string; idempotencyKey: string; correlationId: string; requestId?: string }>;
type TargetCommand = CommandBase & Readonly<{ targetUserId: string; expectedVersion: number }>;

type IssueResult = Readonly<{ status: "issued" | "resent"; caseId: string; expiresAt: string; secret?: string }>;
type TransitionResult = Readonly<{ status: "deactivated" | "reactivated" | "activated"; targetUserId: string; version: number; roleIds: readonly string[] }>;
type CreateResult = Readonly<{ status: "created"; targetUserId: string; version: number; caseId: string | null; secret?: string }>;

export function deriveLifecycleSecret(input: Readonly<{ key: string; caseId: string; purpose: LifecycleCaseKind; tenantId: string; userId: string; expiresAt: Date }>): string {
  if (Buffer.byteLength(input.key, "utf8") < 32) throw new SecurityCommandError("integrity-failure");
  return createHmac("sha256", input.key)
    .update(`simas:lifecycle-delivery:v1\0${input.caseId}\0${input.purpose}\0${input.tenantId}\0${input.userId}\0${input.expiresAt.toISOString()}`, "utf8")
    .digest("base64url");
}

export function digestLifecycleSecret(input: Readonly<{ purpose: LifecycleCaseKind; tenantId: string; userId: string; expiresAt: Date; secret: string }>): string {
  return createHash("sha256")
    .update(`simas:lifecycle:v1\0${input.purpose}\0${input.tenantId}\0${input.userId}\0${input.expiresAt.toISOString()}\0${input.secret}`, "utf8")
    .digest("hex");
}

function identifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) throw new SecurityCommandError("invalid-command");
}

function reason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 1000) throw new SecurityCommandError("invalid-command");
  return normalized;
}

function email(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new SecurityCommandError("invalid-command");
  return normalized;
}

function name(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 255) throw new SecurityCommandError("invalid-command");
  return normalized;
}

function tenantContext(tenantId: string): SecurityContext {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

async function authorize(repository: AccountLifecycleRepository, actor: SecurityActor, tenantId: string): Promise<void> {
  if (actor.kind !== "tenant-user" || actor.tenantId !== tenantId) throw new SecurityCommandError("context-denied");
  if (!await repository.lockTenant(tenantId) || !await repository.isSchoolAdmin(tenantId, actor.userId)) throw new SecurityCommandError("context-denied");
}

async function target(repository: AccountLifecycleRepository, tenantId: string, userId: string): Promise<TenantLifecycleAccount> {
  const value = await repository.getAccount(tenantId, userId);
  if (!value || value.tenantId !== tenantId || value.schoolAdmin) throw new SecurityCommandError("context-denied");
  return value;
}

export function createTenantAccountLifecycleService<TTransaction extends object>(dependencies: Readonly<{
  execute: Executor<TTransaction>;
  repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => AccountLifecycleRepository;
  createId?: () => string;
  generateSecret?: () => string;
  now?: () => Date;
  lifetimeMs?: number;
  lifecycleSecretKey?: string;
}>) {
  const createId = dependencies.createId ?? randomUUID;
  const generateSecret = dependencies.generateSecret ?? (() => randomBytes(32).toString("base64url"));
  const now = dependencies.now ?? (() => new Date());
  const lifetimeMs = dependencies.lifetimeMs ?? 24 * 60 * 60 * 1000;

  async function issue(input: TargetCommand & Readonly<{ kind: LifecycleCaseKind; deliveryChannel: LifecycleDeliveryChannel; mode: "resend" | "reissue" }>): Promise<IssueResult> {
    identifier(input.tenantId); identifier(input.targetUserId);
    return (await dependencies.execute<IssueResult>({
      principal: input.principal,
      idempotencyKey: input.idempotencyKey,
      commandName: `tenant-account.${input.kind}.${input.mode}`,
      payload: { tenantId: input.tenantId, targetUserId: input.targetUserId, deliveryChannel: input.deliveryChannel, mode: input.mode },
      expectedVersions: [{ resourceType: "tenant-account", resourceId: input.targetUserId, expectedVersion: input.expectedVersion }],
      correlationId: input.correlationId,
      requestId: input.requestId,
      deriveContext: async () => tenantContext(input.tenantId),
      authorizeAndMutate: async ({ actor, transaction }) => {
        const repository = dependencies.repository(transaction);
        await authorize(repository, actor, input.tenantId);
        const account = await target(repository, input.tenantId, input.targetUserId);
        if (account.version !== input.expectedVersion || (input.kind === "activation" && account.lifecycle !== "pending-activation")) throw new SecurityCommandError("stale-version");
        const at = now();
        const pending = await repository.findPendingCase(input.tenantId, input.targetUserId, input.kind);
        if (input.mode === "resend") {
          if (!pending || pending.expiresAt <= at || pending.deliveryChannel !== input.deliveryChannel) {
            throw new SecurityCommandError("stale-version");
          }
          const result: IssueResult = { status: "resent", caseId: pending.id, expiresAt: pending.expiresAt.toISOString() };
          return {
            result,
            auditEvents: [{ purpose: `${input.kind}-resent`, order: "summary", eventType: `tenant_account.${input.kind}_resent`, targets: { userId: account.userId }, metadata: { caseId: pending.id, deliveryChannel: pending.deliveryChannel } }],
            outbox: [{ purpose: `${input.kind}-delivery-${pending.id}`, eventType: "tenant_account.lifecycle_delivery_requested", payload: { caseId: pending.id, tenantId: input.tenantId, userId: account.userId, kind: input.kind, deliveryChannel: pending.deliveryChannel } }],
          };
        }
        await repository.revokePendingCases(input.tenantId, account.userId, at);
        const caseId = createId();
        const expiresAt = new Date(at.getTime() + lifetimeMs);
        const secret = input.deliveryChannel === "email"
          ? deriveLifecycleSecret({ key: dependencies.lifecycleSecretKey ?? process.env.TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY ?? "", caseId, purpose: input.kind, tenantId: input.tenantId, userId: account.userId, expiresAt })
          : generateSecret();
        if (Buffer.byteLength(secret, "utf8") < 24) throw new SecurityCommandError("integrity-failure");
        await repository.createCase({ id: caseId, tenantId: input.tenantId, userId: account.userId, kind: input.kind, state: "pending", deliveryChannel: input.deliveryChannel, secretDigest: digestLifecycleSecret({ purpose: input.kind, tenantId: input.tenantId, userId: account.userId, expiresAt, secret }), expiresAt, consumedAt: null, deliveryAttempts: 0, version: 1, idempotencyKey: input.idempotencyKey, createdAt: at, updatedAt: at });
        const result: IssueResult = { status: "issued", caseId, expiresAt: expiresAt.toISOString(), ...(input.deliveryChannel === "temporary-credential" ? { secret } : {}) };
        return {
          result,
          auditEvents: [{ purpose: `${input.kind}-issued`, order: "summary", eventType: `tenant_account.${input.kind}_issued`, targets: { userId: account.userId }, metadata: { caseId, deliveryChannel: input.deliveryChannel, expiresAt: expiresAt.toISOString() } }],
          outbox: [{ purpose: `${input.kind}-delivery-${caseId}`, eventType: "tenant_account.lifecycle_delivery_requested", payload: { caseId, tenantId: input.tenantId, userId: account.userId, kind: input.kind, deliveryChannel: input.deliveryChannel } }],
        };
      },
    })).result;
  }

  async function transition(input: TargetCommand & Readonly<{ operation: "deactivate" | "reactivate" | "activate"; reason: string; roleIds?: readonly string[] }>): Promise<TransitionResult> {
    identifier(input.tenantId); identifier(input.targetUserId);
    const normalizedReason = reason(input.reason);
    const roleIds = [...new Set(input.roleIds ?? [])].sort(); roleIds.forEach(identifier);
    return (await dependencies.execute<TransitionResult>({
      principal: input.principal, idempotencyKey: input.idempotencyKey, commandName: `tenant-account.${input.operation}`,
      payload: { tenantId: input.tenantId, targetUserId: input.targetUserId, reason: normalizedReason, roleIds },
      expectedVersions: [{ resourceType: "tenant-account", resourceId: input.targetUserId, expectedVersion: input.expectedVersion }], correlationId: input.correlationId, requestId: input.requestId,
      deriveContext: async () => tenantContext(input.tenantId),
      authorizeAndMutate: async ({ actor, transaction }) => {
        const repository = dependencies.repository(transaction); await authorize(repository, actor, input.tenantId);
        const account = await target(repository, input.tenantId, input.targetUserId);
        if (account.version !== input.expectedVersion) throw new SecurityCommandError("stale-version");
        if ((input.operation === "deactivate" && account.lifecycle !== "active") || (input.operation === "reactivate" && account.lifecycle !== "inactive") || (input.operation === "activate" && account.lifecycle !== "pending-activation")) throw new SecurityCommandError("stale-version");
        if (input.operation === "reactivate") {
          const valid = new Set((await repository.listRoles(input.tenantId)).filter((role) => role.lifecycle === "active").map((role) => role.id));
          if (roleIds.some((id) => !valid.has(id))) throw new SecurityCommandError("invalid-command");
          const former = new Set((await repository.listAssignments(input.tenantId, account.userId)).map((assignment) => assignment.roleId));
          if (roleIds.some((id) => !former.has(id))) throw new SecurityCommandError("invalid-command");
        }
        const at = now(); let affectedRoleIds: readonly string[] = roleIds; let revokedSessions = 0;
        if (input.operation === "deactivate") {
          revokedSessions = await repository.revokeSessions(account.userId);
          await repository.revokePendingCases(input.tenantId, account.userId, at);
          affectedRoleIds = await repository.suspendAssignments(input.tenantId, account.userId, at);
        } else if (input.operation === "reactivate") {
          affectedRoleIds = await repository.restoreAssignments(input.tenantId, account.userId, roleIds, at);
        } else {
          await repository.revokePendingCases(input.tenantId, account.userId, at);
        }
        const lifecycle = input.operation === "deactivate" ? "inactive" : "active";
        if (!await repository.transitionLifecycle({ tenantId: input.tenantId, userId: account.userId, expectedVersion: input.expectedVersion, lifecycle, bumpAssignmentVersion: input.operation !== "activate", updatedAt: at })) throw new SecurityCommandError("stale-version");
        const status = input.operation === "deactivate" ? "deactivated" : input.operation === "reactivate" ? "reactivated" : "activated";
        return { result: { status, targetUserId: account.userId, version: input.expectedVersion + 1, roleIds: affectedRoleIds }, versionTransitions: [{ resourceType: "tenant-account", resourceId: account.userId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }], auditEvents: [{ purpose: status, order: "summary", eventType: `tenant_account.${status}`, targets: { userId: account.userId }, reason: normalizedReason, metadata: { roleIds: affectedRoleIds, revokedSessions } }] };
      },
    })).result;
  }

  return {
    issueActivation: (input: TargetCommand & Readonly<{ deliveryChannel: LifecycleDeliveryChannel; mode: "resend" | "reissue" }>) => issue({ ...input, kind: "activation" }),
    initiateRecovery: (input: TargetCommand & Readonly<{ deliveryChannel: LifecycleDeliveryChannel; mode: "resend" | "reissue" }>) => issue({ ...input, kind: "recovery" }),
    deactivate: (input: TargetCommand & Readonly<{ reason: string }>) => transition({ ...input, operation: "deactivate" }),
    reactivate: (input: TargetCommand & Readonly<{ reason: string; roleIds: readonly string[] }>) => transition({ ...input, operation: "reactivate" }),
    activateAdministratively: (input: TargetCommand & Readonly<{ reason: string }>) => transition({ ...input, operation: "activate" }),
    async create(input: CommandBase & Readonly<{ name: string; email: string; personId?: string; deliveryChannel: LifecycleDeliveryChannel | "administrative" }>): Promise<CreateResult> {
      const normalizedName = name(input.name); const normalizedEmail = email(input.email); if (input.personId) identifier(input.personId);
      return (await dependencies.execute<CreateResult>({
        principal: input.principal, idempotencyKey: input.idempotencyKey, commandName: "tenant-account.create", payload: { tenantId: input.tenantId, name: normalizedName, email: normalizedEmail, personId: input.personId ?? null, deliveryChannel: input.deliveryChannel }, correlationId: input.correlationId, requestId: input.requestId, deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const repository = dependencies.repository(transaction); await authorize(repository, actor, input.tenantId);
          if (await repository.findIdentityByEmail(normalizedEmail)) throw new SecurityCommandError("context-denied");
          if (input.personId) { const person = await repository.getPerson(input.tenantId, input.personId); if (!person || person.tenantId !== input.tenantId || person.archived || person.accountUserId) throw new SecurityCommandError("context-denied"); }
          const at = now(); const userId = createId(); const lifecycle = input.deliveryChannel === "administrative" ? "active" : "pending-activation";
          const caseId = input.deliveryChannel === "administrative" ? null : createId();
          const expiresAt = new Date(at.getTime() + lifetimeMs);
          const secret = input.deliveryChannel === "administrative"
            ? generateSecret()
            : input.deliveryChannel === "email"
              ? deriveLifecycleSecret({ key: dependencies.lifecycleSecretKey ?? process.env.TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY ?? "", caseId: caseId!, purpose: "activation", tenantId: input.tenantId, userId, expiresAt })
              : generateSecret();
          const created = await repository.createAccount({ userId, accountId: createId(), tenantId: input.tenantId, name: normalizedName, email: normalizedEmail, lifecycle, initialCredential: secret, createdAt: at });
          if (input.personId) await repository.linkPerson(input.tenantId, input.personId, userId, 1, at);
          if (input.deliveryChannel === "administrative") return { result: { status: "created", targetUserId: userId, version: created.version, caseId: null, secret }, auditEvents: [{ purpose: "account-created", order: "summary", eventType: "tenant_account.created", targets: { userId }, metadata: { lifecycle, linkedPersonId: input.personId ?? null } }] };
          await repository.createCase({ id: caseId!, tenantId: input.tenantId, userId, kind: "activation", state: "pending", deliveryChannel: input.deliveryChannel, secretDigest: digestLifecycleSecret({ purpose: "activation", tenantId: input.tenantId, userId, expiresAt, secret }), expiresAt, consumedAt: null, deliveryAttempts: 0, version: 1, idempotencyKey: input.idempotencyKey, createdAt: at, updatedAt: at });
          return { result: { status: "created", targetUserId: userId, version: created.version, caseId, ...(input.deliveryChannel === "temporary-credential" ? { secret } : {}) }, auditEvents: [{ purpose: "account-created", order: "summary", eventType: "tenant_account.created", targets: { userId }, metadata: { lifecycle, linkedPersonId: input.personId ?? null, caseId } }], outbox: [{ purpose: `activation-delivery-${caseId}`, eventType: "tenant_account.lifecycle_delivery_requested", payload: { caseId, tenantId: input.tenantId, userId, kind: "activation", deliveryChannel: input.deliveryChannel } }] };
        },
      })).result;
    },
  };
}
