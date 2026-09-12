import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { securityAuditEvent, securityAuditHead, securityReconciliationFinding } from "@/db/schema";
import type { PersistedSecurityAuditEvent } from "@/lib/authorization/security-command-store";
import type { SecurityActor, SecurityAuditEvidence, SecurityContext, JsonValue } from "@/lib/authorization/security-command";
import type { SecurityAuditIntegrityFinding, SecurityAuditIntegrityResult } from "@/lib/authorization/security-audit";
import { verifySecurityAuditChain } from "@/lib/authorization/security-audit";

const providerContextId = process.env.PROVIDER_SECURITY_CONTEXT_ID?.trim() || "simas-provider";

type ActorEvidence = Readonly<{
  kind?: SecurityActor["kind"];
  userId?: string;
  service?: string;
  displayName?: string;
  email?: string;
  tenantId?: string;
  recoveryCaseId?: string;
}>;

function actorFromMetadata(
  actorKind: SecurityActor["kind"],
  actorTenantUserId: string | null,
  actorProviderUserId: string | null,
  actorService: string | null,
  metadata: unknown,
): SecurityActor {
  const root = metadata && typeof metadata === "object" ? metadata as { actor?: ActorEvidence } : {};
  const evidence = root.actor ?? {};
  if (actorKind === "system") return { kind: "system", service: actorService ?? evidence.service ?? "unknown-service" };
  const userId = actorTenantUserId ?? actorProviderUserId ?? evidence.userId ?? "unknown-actor";
  const displayName = evidence.displayName ?? "Aktor keamanan";
  const email = evidence.email ?? "redacted@invalid";
  if (actorKind === "support-recovery") {
    return { kind: actorKind, userId, displayName, email, recoveryCaseId: evidence.recoveryCaseId ?? "unknown-case" };
  }
  if (actorKind === "provider-admin") return { kind: actorKind, userId, displayName, email };
  return { kind: "tenant-user", userId, tenantId: evidence.tenantId ?? "unknown-tenant", displayName, email };
}

function contextFromRow(row: typeof securityAuditEvent.$inferSelect): SecurityContext {
  return row.securityContextKind === "tenant"
    ? { kind: "tenant", contextId: row.contextId, tenantId: row.tenantId ?? row.contextId }
    : { kind: "provider", contextId: row.contextId, providerContextId: row.providerContextId ?? row.contextId };
}

type StoredAuditEnvelope = Readonly<{
  actor?: ActorEvidence;
  evidence?: SecurityAuditEvidence;
  details?: JsonValue;
}>;

const EMPTY_VERSION = { before: null, after: null } as const;

function legacyEvidence(metadata: unknown): SecurityAuditEvidence {
  const root = metadata && typeof metadata === "object" ? metadata as StoredAuditEnvelope : {};
  const details = root.details && typeof root.details === "object" && !Array.isArray(root.details)
    ? root.details as Record<string, JsonValue>
    : {};
  const beforeVersion = typeof details.versionBefore === "number" ? details.versionBefore
    : typeof details.authorityVersionBefore === "number" ? details.authorityVersionBefore
    : null;
  const afterVersion = typeof details.versionAfter === "number" ? details.versionAfter
    : typeof details.authorityVersionAfter === "number" ? details.authorityVersionAfter
    : null;
  return {
    before: details.before ?? null,
    after: details.after ?? null,
    diff: details.diff ?? null,
    version: beforeVersion === null && afterVersion === null ? EMPTY_VERSION : { before: beforeVersion, after: afterVersion },
    caseId: typeof details.caseId === "string" ? details.caseId : null,
    batchId: typeof details.batchId === "string" ? details.batchId
      : typeof details.migrationRunId === "string" ? details.migrationRunId
      : null,
  };
}

function toPersistedEvent(row: typeof securityAuditEvent.$inferSelect): PersistedSecurityAuditEvent {
  const stored = row.metadata && typeof row.metadata === "object" ? row.metadata as StoredAuditEnvelope : {};
  return {
    id: row.id,
    context: contextFromRow(row),
    sequence: row.sequence,
    eventKey: row.eventKey,
    schemaVersion: row.schemaVersion,
    eventType: row.eventType,
    outcome: row.outcome,
    actor: actorFromMetadata(row.actorKind, row.actorTenantUserId, row.actorProviderUserId, row.actorService, row.metadata),
    commandId: row.commandId,
    targets: {
      ...(row.targetUserId ? { userId: row.targetUserId } : {}),
      ...(row.targetRoleId ? { roleId: row.targetRoleId } : {}),
      ...(row.targetAssignmentId ? { assignmentId: row.targetAssignmentId } : {}),
      ...(row.targetSchoolAdminAuthorityId ? { schoolAdminAuthorityId: row.targetSchoolAdminAuthorityId } : {}),
      ...(row.targetSchoolAdminProofId ? { schoolAdminProofId: row.targetSchoolAdminProofId } : {}),
    },
    correlationId: row.correlationId,
    ...(row.requestId ? { requestId: row.requestId } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    evidence: row.schemaVersion === 1 ? legacyEvidence(row.metadata) : stored.evidence ?? legacyEvidence(row.metadata),
    metadata: row.schemaVersion === 1 ? row.metadata as JsonValue : stored.details ?? {},
    canonicalPayloadDigest: row.canonicalPayloadDigest,
    previousHash: row.previousHash,
    eventHash: row.eventHash,
    occurredAt: row.occurredAt,
  };
}

export async function listTenantSecurityAuditEvents(tenantId: string): Promise<readonly PersistedSecurityAuditEvent[]> {
  const rows = await db.select().from(securityAuditEvent).where(and(
    eq(securityAuditEvent.securityContextKind, "tenant"),
    eq(securityAuditEvent.contextId, tenantId),
  )).orderBy(asc(securityAuditEvent.sequence));
  return rows.map(toPersistedEvent);
}

export async function listProviderSecurityAuditEvents(): Promise<readonly PersistedSecurityAuditEvent[]> {
  const rows = await db.select().from(securityAuditEvent).where(and(
    eq(securityAuditEvent.securityContextKind, "provider"),
    eq(securityAuditEvent.contextId, providerContextId),
  )).orderBy(asc(securityAuditEvent.sequence));
  return rows.map(toPersistedEvent);
}

export function getTenantSecurityContext(tenantId: string): Extract<SecurityContext, { kind: "tenant" }> {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

export async function getSecurityAuditHead(context: SecurityContext) {
  const [head] = await db.select({
    nextSequence: securityAuditHead.nextSequence,
    headHash: securityAuditHead.headHash,
  }).from(securityAuditHead).where(and(
    eq(securityAuditHead.securityContextKind, context.kind),
    eq(securityAuditHead.contextId, context.contextId),
  )).limit(1);
  return head ?? null;
}

export function getProviderSecurityContext(): Extract<SecurityContext, { kind: "provider" }> {
  return { kind: "provider", contextId: providerContextId, providerContextId };
}

const INTEGRITY_MIGRATION_KEY = "security-audit-integrity-v1";

/** Records an invalid chain as a blocking, partition-qualified operational finding. */
export async function recordSecurityAuditIntegrityFindings(input: Readonly<{
  context: SecurityContext;
  findings: readonly SecurityAuditIntegrityFinding[];
  detectedAt?: Date;
}>): Promise<void> {
  if (input.findings.length === 0) return;
  const detectedAt = input.detectedAt ?? new Date();
  await db.insert(securityReconciliationFinding).values(input.findings.map((finding, index) => {
    const suffix = `${finding.sequence ?? "head"}:${finding.eventId ?? index}`;
    return {
      id: randomUUID(),
      migrationKey: INTEGRITY_MIGRATION_KEY,
      scopeKey: input.context.contextId,
      findingKey: `${finding.code}:${suffix}`.slice(0, 160),
      tenantId: input.context.kind === "tenant" ? input.context.tenantId : null,
      userId: null,
      reasonCode: `audit-integrity:${finding.code}`,
      severity: "blocking" as const,
      state: "open" as const,
      safeDetails: { contextKind: input.context.kind, contextId: input.context.contextId, sequence: finding.sequence ?? null, eventId: finding.eventId ?? null } satisfies JsonValue,
      detectedAt,
      resolvedAt: null,
    };
  })).onDuplicateKeyUpdate({ set: {
    state: "open",
    severity: "blocking",
    safeDetails: { contextKind: input.context.kind, contextId: input.context.contextId } satisfies JsonValue,
    detectedAt,
    resolvedAt: null,
  }});
}

export async function verifyAndRecordSecurityAuditChain(input: Readonly<{
  events: readonly PersistedSecurityAuditEvent[];
  context: SecurityContext;
  headHash: string;
  nextSequence: bigint;
  detectedAt?: Date;
}>): Promise<SecurityAuditIntegrityResult> {
  const result = verifySecurityAuditChain(input.events, input);
  if (!result.valid) await recordSecurityAuditIntegrityFindings({ context: input.context, findings: result.findings, detectedAt: input.detectedAt });
  return result;
}
