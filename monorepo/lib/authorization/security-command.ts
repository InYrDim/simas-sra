import { createHash, randomUUID } from "node:crypto";

import type {
  PersistedSecurityAuditEvent,
  PersistedSecurityCommand,
  PersistedSecurityOutbox,
  SecurityAuditHead,
  SecurityCommandStore,
  SecurityCommandStoreTransaction,
} from "@/lib/authorization/security-command-store";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type SecurityContext = Readonly<
  | { kind: "tenant"; contextId: string; tenantId: string }
  | { kind: "provider"; contextId: string; providerContextId: string }
>;

export type SecurityActor = Readonly<
  | {
      kind: "tenant-user";
      userId: string;
      tenantId: string;
      displayName: string;
      email: string;
    }
  | {
      kind: "provider-admin";
      userId: string;
      displayName: string;
      email: string;
    }
  | {
      kind: "support-recovery";
      userId: string;
      displayName: string;
      email: string;
      recoveryCaseId: string;
    }
  | { kind: "system"; service: string }
>;

export type SecurityPrincipal = Readonly<
  | { kind: "authenticated-user"; userId: string }
  | { kind: "support-recovery"; userId: string; recoveryCaseId: string }
  | { kind: "system"; service: string; context: SecurityContext }
>;

export type OptimisticVersion = Readonly<{
  resourceType: string;
  resourceId: string;
  expectedVersion: number;
}>;

export type SecurityVersionTransition = OptimisticVersion & Readonly<{
  toVersion: number;
}>;

export type SecurityAuditEventDraft = Readonly<{
  purpose: string;
  order: "parent" | "summary" | "child" | "consequence";
  schemaVersion?: number;
  eventType: string;
  outcome?: "succeeded" | "annotated";
  targets?: Readonly<{
    userId?: string;
    roleId?: string;
    assignmentId?: string;
    schoolAdminAuthorityId?: string;
    schoolAdminProofId?: string;
  }>;
  reason?: string;
  metadata: JsonValue;
}>;

export type SecurityOutboxDraft = Readonly<{
  purpose: string;
  eventType: string;
  payload: JsonValue;
  availableAt?: Date;
}>;

export type SecurityCommandMutation<TResult extends JsonValue> = Readonly<{
  result: TResult;
  versionTransitions?: readonly SecurityVersionTransition[];
  auditEvents: readonly SecurityAuditEventDraft[];
  outbox?: readonly SecurityOutboxDraft[];
}>;

export type SecurityCommandResult<TResult extends JsonValue> = Readonly<{
  commandId: string;
  existing: boolean;
  result: TResult;
}>;

export type SecuritySignal = Readonly<{
  type: "security-command.idempotency-conflict";
  actorUserId?: string;
  context: SecurityContext;
  commandName: string;
  idempotencyKeyDigest: string;
}>;

export class SecurityCommandError extends Error {
  constructor(
    readonly code:
      | "invalid-command"
      | "unauthenticated"
      | "context-denied"
      | "idempotency-conflict"
      | "command-in-progress"
      | "stale-version"
      | "integrity-failure",
  ) {
    super(code);
    this.name = "SecurityCommandError";
  }
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]+$/;
const ZERO_HASH = "0".repeat(64);
const EVENT_ORDER = { parent: 0, summary: 1, child: 2, consequence: 3 } as const;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertJson(value: unknown, seen = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new SecurityCommandError("invalid-command");
  }
  if (typeof value !== "object" || value instanceof Date) {
    throw new SecurityCommandError("invalid-command");
  }
  if (seen.has(value)) throw new SecurityCommandError("invalid-command");
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertJson(item, seen);
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SecurityCommandError("invalid-command");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!key || item === undefined) throw new SecurityCommandError("invalid-command");
      assertJson(item, seen);
    }
  }
  seen.delete(value);
}

export function canonicalJson(value: JsonValue): string {
  assertJson(value);
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key]!)}`)
    .join(",")}}`;
}

function assertBoundedToken(value: string, maximum: number): void {
  if (!value || value.length > maximum || !TOKEN_PATTERN.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function assertIdentifier(value: string, maximum: number): void {
  if (!value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function normalizeVersions(versions: readonly OptimisticVersion[]): readonly OptimisticVersion[] {
  const normalized = [...versions].sort((left, right) =>
    left.resourceType.localeCompare(right.resourceType) || left.resourceId.localeCompare(right.resourceId),
  );
  const identities = new Set<string>();
  for (const version of normalized) {
    assertBoundedToken(version.resourceType, 64);
    assertIdentifier(version.resourceId, 128);
    if (!Number.isSafeInteger(version.expectedVersion) || version.expectedVersion < 0) {
      throw new SecurityCommandError("invalid-command");
    }
    const identity = `${version.resourceType}\u0000${version.resourceId}`;
    if (identities.has(identity)) throw new SecurityCommandError("invalid-command");
    identities.add(identity);
  }
  return normalized;
}

export function securityCommandFingerprint(input: Readonly<{
  commandName: string;
  payload: JsonValue;
  expectedVersions?: readonly OptimisticVersion[];
}>): string {
  assertBoundedToken(input.commandName, 128);
  assertJson(input.payload);
  const versions = normalizeVersions(input.expectedVersions ?? []);
  return sha256(canonicalJson({
    commandName: input.commandName,
    expectedVersions: versions.map((version) => ({
      expectedVersion: version.expectedVersion,
      resourceId: version.resourceId,
      resourceType: version.resourceType,
    })),
    payload: input.payload,
  }));
}

export function requireOptimisticUpdate(updated: boolean, resource = "resource"): void {
  if (!updated) {
    const error = new SecurityCommandError("stale-version");
    error.message = `stale-version:${resource}`;
    throw error;
  }
}

function contextColumns(context: SecurityContext): Readonly<{
  tenantId: string | null;
  providerContextId: string | null;
}> {
  return context.kind === "tenant"
    ? { tenantId: context.tenantId, providerContextId: null }
    : { tenantId: null, providerContextId: context.providerContextId };
}

function assertContext(context: SecurityContext, actor: SecurityActor, principal: SecurityPrincipal): void {
  assertIdentifier(context.contextId, 36);
  if (context.kind === "tenant") {
    if (context.tenantId !== context.contextId) throw new SecurityCommandError("context-denied");
    if (actor.kind === "tenant-user" && actor.tenantId !== context.tenantId) {
      throw new SecurityCommandError("context-denied");
    }
  } else if (context.providerContextId !== context.contextId || actor.kind === "tenant-user") {
    throw new SecurityCommandError("context-denied");
  }
  if (principal.kind === "system" && canonicalJson(principal.context) !== canonicalJson(context)) {
    throw new SecurityCommandError("context-denied");
  }
}

function targetOrderKey(targets: SecurityAuditEventDraft["targets"]): string {
  if (!targets) return "";
  return [
    targets.userId,
    targets.roleId,
    targets.assignmentId,
    targets.schoolAdminAuthorityId,
    targets.schoolAdminProofId,
  ].filter(Boolean).join("\u0000");
}

function orderAuditEvents(events: readonly SecurityAuditEventDraft[]): readonly SecurityAuditEventDraft[] {
  if (events.length === 0) throw new SecurityCommandError("integrity-failure");
  const purposes = new Set<string>();
  for (const event of events) {
    assertBoundedToken(event.purpose, 96);
    assertBoundedToken(event.eventType, 128);
    if (purposes.has(event.purpose)) throw new SecurityCommandError("integrity-failure");
    purposes.add(event.purpose);
    if ((event.schemaVersion ?? 1) < 1 || !Number.isSafeInteger(event.schemaVersion ?? 1)) {
      throw new SecurityCommandError("integrity-failure");
    }
    if (event.reason !== undefined && (event.reason !== event.reason.trim() || event.reason.length < 1 || event.reason.length > 1000)) {
      throw new SecurityCommandError("invalid-command");
    }
    assertJson(event.metadata);
    for (const identifier of Object.values(event.targets ?? {})) assertIdentifier(identifier, 36);
  }
  return [...events].sort((left, right) =>
    EVENT_ORDER[left.order] - EVENT_ORDER[right.order]
    || targetOrderKey(left.targets).localeCompare(targetOrderKey(right.targets))
    || left.eventType.localeCompare(right.eventType)
    || left.purpose.localeCompare(right.purpose),
  );
}

function validateVersionTransitions(
  expected: readonly OptimisticVersion[],
  transitions: readonly SecurityVersionTransition[],
): void {
  const normalized = [...transitions].sort((left, right) =>
    left.resourceType.localeCompare(right.resourceType) || left.resourceId.localeCompare(right.resourceId),
  );
  if (normalized.length !== expected.length) throw new SecurityCommandError("integrity-failure");
  for (let index = 0; index < expected.length; index += 1) {
    const wanted = expected[index]!;
    const actual = normalized[index]!;
    if (
      actual.resourceType !== wanted.resourceType
      || actual.resourceId !== wanted.resourceId
      || actual.expectedVersion !== wanted.expectedVersion
      || actual.toVersion !== wanted.expectedVersion + 1
    ) {
      throw new SecurityCommandError("integrity-failure");
    }
  }
}

function eventIdentity(commandId: string, kind: "audit" | "outbox", purpose: string): string {
  return `${commandId}:${kind}:${sha256(purpose)}`;
}

function actorColumns(actor: SecurityActor): Readonly<{
  actorTenantUserId: string | null;
  actorProviderUserId: string | null;
  actorService: string | null;
}> {
  if (actor.kind === "tenant-user") {
    return { actorTenantUserId: actor.userId, actorProviderUserId: null, actorService: null };
  }
  if (actor.kind === "provider-admin" || actor.kind === "support-recovery") {
    return { actorTenantUserId: null, actorProviderUserId: actor.userId, actorService: null };
  }
  return { actorTenantUserId: null, actorProviderUserId: null, actorService: actor.service };
}

function auditPayload(
  event: Omit<PersistedSecurityAuditEvent, "canonicalPayloadDigest" | "previousHash" | "eventHash">
    & Readonly<{ previousHashForDigest: string }>,
): JsonValue {
  return {
    actor: event.actor,
    commandId: event.commandId,
    context: event.context,
    correlationId: event.correlationId,
    eventKey: event.eventKey,
    eventType: event.eventType,
    id: event.id,
    metadata: event.metadata,
    occurredAt: event.occurredAt.toISOString(),
    outcome: event.outcome,
    previousHash: event.previousHashForDigest,
    reason: event.reason ?? null,
    requestId: event.requestId ?? null,
    schemaVersion: event.schemaVersion,
    sequence: event.sequence.toString(),
    targets: event.targets,
  };
}

export function securityAuditEventHash(previousHash: string, canonicalPayloadDigest: string): string {
  if (!HASH_PATTERN.test(previousHash) || !HASH_PATTERN.test(canonicalPayloadDigest)) {
    throw new SecurityCommandError("integrity-failure");
  }
  return sha256(canonicalJson({ canonicalPayloadDigest, previousHash }));
}

export function securityAuditEventPayloadDigest(event: PersistedSecurityAuditEvent): string {
  return sha256(canonicalJson(auditPayload({
    id: event.id,
    context: event.context,
    sequence: event.sequence,
    eventKey: event.eventKey,
    schemaVersion: event.schemaVersion,
    eventType: event.eventType,
    outcome: event.outcome,
    actor: event.actor,
    commandId: event.commandId,
    targets: event.targets,
    correlationId: event.correlationId,
    requestId: event.requestId,
    reason: event.reason,
    metadata: event.metadata,
    occurredAt: event.occurredAt,
    previousHashForDigest: event.previousHash,
  })));
}

function actorEvidence(actor: SecurityActor): JsonValue {
  if (actor.kind === "system") return { kind: actor.kind, service: actor.service };
  const evidence: Record<string, JsonValue> = {
    kind: actor.kind,
    userId: actor.userId,
    displayName: actor.displayName,
  };
  if (actor.kind === "tenant-user") evidence.tenantId = actor.tenantId;
  if (actor.kind === "support-recovery") evidence.recoveryCaseId = actor.recoveryCaseId;
  return evidence;
}

function persistedEvents(input: Readonly<{
  actor: SecurityActor;
  commandId: string;
  context: SecurityContext;
  correlationId: string;
  drafts: readonly SecurityAuditEventDraft[];
  head: SecurityAuditHead;
  now: Date;
  requestId?: string;
  createId: () => string;
}>): readonly PersistedSecurityAuditEvent[] {
  let previousHash = input.head.headHash || ZERO_HASH;
  if (!HASH_PATTERN.test(previousHash)) throw new SecurityCommandError("integrity-failure");
  return input.drafts.map((draft, index) => {
    const base = {
      id: input.createId(),
      context: input.context,
      sequence: input.head.nextSequence + BigInt(index),
      eventKey: eventIdentity(input.commandId, "audit", draft.purpose),
      schemaVersion: draft.schemaVersion ?? 1,
      eventType: draft.eventType,
      outcome: draft.outcome ?? "succeeded" as const,
      actor: input.actor,
      commandId: input.commandId,
      targets: draft.targets ?? {},
      correlationId: input.correlationId,
      requestId: input.requestId,
      reason: draft.reason,
      metadata: {
        actor: actorEvidence(input.actor),
        details: draft.metadata,
      },
      occurredAt: input.now,
      previousHashForDigest: previousHash,
    };
    const canonicalPayloadDigest = sha256(canonicalJson(auditPayload(base)));
    const eventHash = securityAuditEventHash(previousHash, canonicalPayloadDigest);
    previousHash = eventHash;
    return { ...base, canonicalPayloadDigest, previousHash: base.previousHashForDigest, eventHash };
  });
}

function persistedOutbox(input: Readonly<{
  commandId: string;
  context: SecurityContext;
  drafts: readonly SecurityOutboxDraft[];
  now: Date;
  createId: () => string;
}>): readonly PersistedSecurityOutbox[] {
  const purposes = new Set<string>();
  return [...input.drafts]
    .sort((left, right) => left.purpose.localeCompare(right.purpose) || left.eventType.localeCompare(right.eventType))
    .map((draft) => {
      assertBoundedToken(draft.purpose, 96);
      assertBoundedToken(draft.eventType, 128);
      if (purposes.has(draft.purpose)) throw new SecurityCommandError("integrity-failure");
      purposes.add(draft.purpose);
      assertJson(draft.payload);
      if (draft.availableAt && Number.isNaN(draft.availableAt.getTime())) throw new SecurityCommandError("invalid-command");
      return {
        id: input.createId(),
        context: input.context,
        commandId: input.commandId,
        eventKey: eventIdentity(input.commandId, "outbox", draft.purpose),
        eventType: draft.eventType,
        payload: draft.payload,
        occurredAt: input.now,
        availableAt: draft.availableAt ?? input.now,
      };
    });
}

export function createSecurityCommandService<TDomainTransaction extends object>(dependencies: Readonly<{
  store: SecurityCommandStore<TDomainTransaction>;
  createId?: () => string;
  now?: () => Date;
  reportSecuritySignal: (signal: SecuritySignal) => void | Promise<void>;
}>) {
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return async function executeSecurityCommand<TResult extends JsonValue>(input: Readonly<{
    principal: SecurityPrincipal;
    idempotencyKey: string;
    commandName: string;
    payload: JsonValue;
    expectedVersions?: readonly OptimisticVersion[];
    correlationId: string;
    requestId?: string;
    deriveContext?: (input: Readonly<{
      actor: SecurityActor;
      transaction: SecurityCommandStoreTransaction & TDomainTransaction;
    }>) => Promise<SecurityContext>;
    authorizeAndMutate: (input: Readonly<{
      actor: SecurityActor;
      context: SecurityContext;
      expectedVersions: readonly OptimisticVersion[];
      transaction: SecurityCommandStoreTransaction & TDomainTransaction;
    }>) => Promise<SecurityCommandMutation<TResult>>;
  }>): Promise<SecurityCommandResult<TResult>> {
    if (
      input.idempotencyKey.length < 8
      || input.idempotencyKey.length > 128
      || !IDEMPOTENCY_PATTERN.test(input.idempotencyKey)
    ) throw new SecurityCommandError("invalid-command");
    assertIdentifier(input.correlationId, 64);
    if (input.requestId !== undefined) assertIdentifier(input.requestId, 64);
    const expectedVersions = normalizeVersions(input.expectedVersions ?? []);
    const fingerprint = securityCommandFingerprint({
      commandName: input.commandName,
      payload: input.payload,
      expectedVersions,
    });
    let conflictSignal: SecuritySignal | undefined;

    try {
      return await dependencies.store.transaction(async (transaction) => {
        const actor = await transaction.resolveActor(input.principal);
        if (!actor) throw new SecurityCommandError("unauthenticated");
        const context = input.deriveContext
          ? await input.deriveContext({ actor, transaction })
          : await transaction.defaultContext(input.principal, actor);
        assertContext(context, actor, input.principal);

        const existing = await transaction.findCommand(context, input.idempotencyKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint || existing.commandName !== input.commandName) {
            conflictSignal = {
              type: "security-command.idempotency-conflict",
              actorUserId: "userId" in actor ? actor.userId : undefined,
              context,
              commandName: input.commandName,
              idempotencyKeyDigest: sha256(input.idempotencyKey),
            };
            throw new SecurityCommandError("idempotency-conflict");
          }
          if (existing.status !== "completed" || existing.result === null) {
            throw new SecurityCommandError("command-in-progress");
          }
          assertJson(existing.result);
          return { commandId: existing.id, existing: true, result: existing.result as TResult };
        }

        const commandId = createId();
        const occurredAt = now();
        if (Number.isNaN(occurredAt.getTime())) throw new SecurityCommandError("invalid-command");
        const command: PersistedSecurityCommand = {
          id: commandId,
          context,
          idempotencyKey: input.idempotencyKey,
          commandName: input.commandName,
          fingerprint,
          createdAt: occurredAt,
        };
        await transaction.insertCommand(command);
        await transaction.checkpoint?.("idempotency");

        const head = await transaction.lockAuditHead(context, occurredAt);
        const mutation = await input.authorizeAndMutate({ actor, context, expectedVersions, transaction });
        assertJson(mutation.result);
        validateVersionTransitions(expectedVersions, mutation.versionTransitions ?? []);
        await transaction.checkpoint?.("state");

        const drafts = orderAuditEvents(mutation.auditEvents);
        if (context.kind === "provider" && drafts.some((event) => Object.keys(event.targets ?? {}).length > 0)) {
          throw new SecurityCommandError("context-denied");
        }
        const events = persistedEvents({
          actor,
          commandId,
          context,
          correlationId: input.correlationId,
          drafts,
          head,
          now: occurredAt,
          requestId: input.requestId,
          createId,
        });
        await transaction.insertAuditEvents(events);
        await transaction.checkpoint?.("audit");

        const finalHash = events.at(-1)?.eventHash ?? head.headHash;
        const updatedHead: SecurityAuditHead = {
          nextSequence: head.nextSequence + BigInt(events.length),
          headHash: finalHash,
          version: head.version + 1,
        };
        requireOptimisticUpdate(
          await transaction.updateAuditHead(context, head, updatedHead, occurredAt),
          "security-audit-head",
        );
        await transaction.checkpoint?.("head");

        const outbox = persistedOutbox({
          commandId,
          context,
          drafts: mutation.outbox ?? [],
          now: occurredAt,
          createId,
        });
        await transaction.insertOutbox(outbox);
        await transaction.checkpoint?.("outbox");
        await transaction.completeCommand(context, commandId, mutation.result, occurredAt);

        return { commandId, existing: false, result: mutation.result };
      });
    } catch (error) {
      if (conflictSignal && error instanceof SecurityCommandError && error.code === "idempotency-conflict") {
        await dependencies.reportSecuritySignal(conflictSignal);
      }
      throw error;
    }
  };
}

export { contextColumns, actorColumns };
