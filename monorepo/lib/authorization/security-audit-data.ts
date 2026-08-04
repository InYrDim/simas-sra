import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { securityAuditEvent, securityAuditHead } from "@/db/schema";
import type { PersistedSecurityAuditEvent } from "@/lib/authorization/security-command-store";
import type { SecurityActor, SecurityContext, JsonValue } from "@/lib/authorization/security-command";

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

function toPersistedEvent(row: typeof securityAuditEvent.$inferSelect): PersistedSecurityAuditEvent {
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
    metadata: row.metadata as JsonValue,
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
