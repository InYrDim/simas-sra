import { securityAuditEventHash, securityAuditEventPayloadDigest } from "@/lib/authorization/security-command";
import type {
  JsonValue,
  SecurityActor,
  SecurityContext,
} from "@/lib/authorization/security-command";
import type { PersistedSecurityAuditEvent } from "@/lib/authorization/security-command-store";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FORMULA_PATTERN = /^[=+\-@]/;
const SENSITIVE_KEY_PATTERN = /(?:password|secret|token|credential|authorization|cookie|privatekey|private_key|api[_-]?key)/i;
const PERSONAL_KEY_PATTERN = /^(?:email|phone|telephone|address|ipaddress|ip_address|useragent|user_agent)$/i;
const RESTRICTED_EVENT_PATTERN = /(?:compatibility_finding|migration_(?:skipped|finding))/i;

export type SecurityAuditScope = "tenant" | "self" | "provider";

export type SecurityAuditProjection = Readonly<{
  id: string;
  sequence: string;
  eventType: string;
  outcome: "succeeded" | "annotated";
  actor: Readonly<{ kind: SecurityActor["kind"]; id: string | null; label: string }>;
  targetUserId: string | null;
  correlationId: string;
  reason: string | null;
  metadata: JsonValue;
  occurredAt: string;
}>;

export type SecurityAuditIntegrityFinding = Readonly<{
  code:
    | "unanchored"
    | "unanchored-event"
    | "sequence-gap"
    | "deleted-event"
    | "duplicate-sequence"
    | "duplicate-event"
    | "wrong-partition"
    | "reordered-event"
    | "forked-chain"
    | "previous-hash-mismatch"
    | "payload-digest-mismatch"
    | "event-hash-mismatch"
    | "head-mismatch";
  sequence?: string;
  eventId?: string;
}>;

export type SecurityAuditIntegrityResult = Readonly<{
  valid: boolean;
  findings: readonly SecurityAuditIntegrityFinding[];
  checkedEvents: number;
}>;

export type SecurityAuditRetentionDecision = Readonly<{
  action: "retain" | "minimize" | "eligible-for-disposal";
  reason: "within-retention" | "legal-hold" | "tenant-deleted" | "retention-expired";
}>;



function neutralizeFormula(value: string): string {
  return FORMULA_PATTERN.test(value) ? `'${value}` : value;
}

function safeValue(value: unknown, key = "", seen = new Set<object>()): JsonValue {
  if (typeof value === "string") return neutralizeFormula(value);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object" || value instanceof Date) return null;
  if (seen.has(value)) return null;
  if (SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => safeValue(item, key, seen));
    seen.delete(value);
    return result;
  }
  const result: Record<string, JsonValue> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(childKey) || PERSONAL_KEY_PATTERN.test(childKey)) continue;
    if (childValue !== undefined) result[childKey] = safeValue(childValue, childKey, seen);
  }
  seen.delete(value);
  return result;
}

function actorProjection(actor: SecurityActor): SecurityAuditProjection["actor"] {
  if (actor.kind === "system") return { kind: actor.kind, id: null, label: actor.service };
  return { kind: actor.kind, id: actor.userId, label: neutralizeFormula(actor.displayName) };
}

function isVisible(
  event: PersistedSecurityAuditEvent,
  scope: SecurityAuditScope,
  tenantId: string | undefined,
  userId?: string,
  providerContextId?: string,
): boolean {
  if (scope === "provider") {
    return event.context.kind === "provider" && event.context.providerContextId === providerContextId;
  }
  if (event.context.kind !== "tenant" || event.context.tenantId !== tenantId) return false;
  if (scope === "tenant") return true;
  return event.targets.userId === userId || event.actor.kind === "tenant-user" && event.actor.userId === userId;
}

export function projectSecurityAuditEvents(
  events: readonly PersistedSecurityAuditEvent[],
  input: Readonly<{ scope: SecurityAuditScope; tenantId?: string; userId?: string; providerContextId?: string }>,
): readonly SecurityAuditProjection[] {
  if (input.scope === "self" && !input.userId) return [];
  const projected = events
    .filter((event) => !RESTRICTED_EVENT_PATTERN.test(event.eventType))
    .filter((event) => isVisible(event, input.scope, input.tenantId, input.userId, input.providerContextId))
    .sort((left, right) => Number(left.sequence - right.sequence))
    .map((event) => ({
      id: event.id,
      sequence: event.sequence.toString(),
      eventType: event.eventType,
      outcome: event.outcome,
      actor: actorProjection(event.actor),
      targetUserId: event.targets.userId ?? null,
      correlationId: event.correlationId,
      reason: event.reason ? neutralizeFormula(event.reason) : null,
      metadata: safeValue(event.metadata),
      occurredAt: event.occurredAt.toISOString(),
    }));
  return projected;
}

export function neutralizeSpreadsheetCell(value: string): string {
  return neutralizeFormula(value);
}

export function buildSecurityAuditCsv(events: readonly SecurityAuditProjection[]): string {
  const rows = [
    ["Urutan", "Waktu", "Peristiwa", "Hasil", "Aktor", "Target", "Alasan", "Correlation ID"],
    ...events.map((event) => [
      event.sequence,
      event.occurredAt,
      event.eventType,
      event.outcome,
      event.actor.label,
      event.targetUserId ?? "",
      event.reason ?? "",
      event.correlationId,
    ]),
  ];
  return rows.map((row) => row.map((cell) => `"${neutralizeSpreadsheetCell(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
}

export function verifySecurityAuditChain(
  events: readonly PersistedSecurityAuditEvent[],
  input: Readonly<{ context: SecurityContext; headHash: string; nextSequence: bigint }>,
): SecurityAuditIntegrityResult {
  const findings: SecurityAuditIntegrityFinding[] = [];
  const anchored = HASH_PATTERN.test(input.headHash);
  if (!anchored) findings.push({ code: "unanchored" });
  const ordered = [...events].sort((left, right) => Number(left.sequence - right.sequence));
  const sequences = new Set<string>();
  const ids = new Set<string>();
  let previousHash = "0".repeat(64);
  let expectedSequence = BigInt(1);
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]?.id !== ordered[index]?.id) {
      findings.push({ code: "reordered-event", sequence: events[index]?.sequence.toString(), eventId: events[index]?.id });
      break;
    }
  }
  if (ordered.length > 0 && ordered[0]?.previousHash !== previousHash) findings.push({ code: "unanchored-event", sequence: ordered[0]?.sequence.toString(), eventId: ordered[0]?.id });
  for (const event of ordered) {
    const sequence = event.sequence.toString();
    if (event.context.kind !== input.context.kind || event.context.contextId !== input.context.contextId) {
      findings.push({ code: "wrong-partition", sequence, eventId: event.id });
    }
    if (sequences.has(sequence)) findings.push({ code: "duplicate-sequence", sequence, eventId: event.id });
    if (ids.has(event.id)) findings.push({ code: "duplicate-event", sequence, eventId: event.id });
    sequences.add(sequence);
    ids.add(event.id);
    if (event.sequence !== expectedSequence) {
      findings.push({ code: "sequence-gap", sequence, eventId: event.id });
      if (event.sequence > expectedSequence) findings.push({ code: "deleted-event", sequence, eventId: event.id });
    }
    if (event.previousHash !== previousHash) {
      findings.push({ code: "previous-hash-mismatch", sequence, eventId: event.id });
      if (HASH_PATTERN.test(event.previousHash) && event.previousHash !== "0".repeat(64)) findings.push({ code: "forked-chain", sequence, eventId: event.id });
    }
    try {
      if (securityAuditEventPayloadDigest(event) !== event.canonicalPayloadDigest) {
        findings.push({ code: "payload-digest-mismatch", sequence, eventId: event.id });
      }
      if (securityAuditEventHash(event.previousHash, event.canonicalPayloadDigest) !== event.eventHash) {
        findings.push({ code: "event-hash-mismatch", sequence, eventId: event.id });
      }
    } catch {
      findings.push({ code: "event-hash-mismatch", sequence, eventId: event.id });
    }
    previousHash = event.eventHash;
    expectedSequence += BigInt(1);
  }
  if (input.nextSequence !== expectedSequence || input.headHash !== previousHash) {
    findings.push({ code: "head-mismatch" });
  }
  if (!anchored && ordered.length > 0) findings.push({ code: "unanchored-event", sequence: ordered[0]?.sequence.toString(), eventId: ordered[0]?.id });
  return { valid: findings.length === 0, findings, checkedEvents: ordered.length };
}

export function decideSecurityAuditRetention(input: Readonly<{
  occurredAt: Date;
  now: Date;
  retentionDays: number;
  legalHold: boolean;
  tenantDeleted: boolean;
}>): SecurityAuditRetentionDecision {
  if (input.legalHold) return { action: "retain", reason: "legal-hold" };
  if (input.tenantDeleted) return { action: "minimize", reason: "tenant-deleted" };
  const age = input.now.getTime() - input.occurredAt.getTime();
  if (!Number.isSafeInteger(input.retentionDays) || input.retentionDays < 0) {
    throw new RangeError("retentionDays must be a non-negative integer");
  }
  return age < input.retentionDays * 24 * 60 * 60 * 1000
    ? { action: "retain", reason: "within-retention" }
    : { action: "eligible-for-disposal", reason: "retention-expired" };
}
