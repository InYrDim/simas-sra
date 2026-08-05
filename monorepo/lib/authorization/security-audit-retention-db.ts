import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  providerAdmin,
  securityAuditEvent,
  securityAuditHead,
  securityAuditLegalHold,
  securityAuditRetentionCertificate,
  securityAuditRetentionPolicy,
  tenant,
} from "@/db/schema";
import {
  SecurityCommandError,
  contextColumns,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { MySqlSecurityCommandTransaction } from "@/lib/authorization/security-command-store";
import { decideSecurityAuditRetention, type SecurityAuditRetentionDecision } from "@/lib/authorization/security-audit";

const MAX_CASE_ID = 128;

function assertContext(context: SecurityContext): void {
  if (!context.contextId || context.contextId.length > 36) throw new RangeError("invalid security context");
}

function assertRetentionDays(retentionDays: number): void {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 0) throw new RangeError("retentionDays must be a non-negative integer");
}

function sameContext(left: SecurityContext, right: SecurityContext): boolean {
  return left.kind === right.kind
    && left.contextId === right.contextId
    && (left.kind === "tenant"
      ? right.kind === "tenant" && left.tenantId === right.tenantId
      : right.kind === "provider" && left.providerContextId === right.providerContextId);
}

async function assertRetentionOperator(
  database: MySqlSecurityCommandTransaction["database"],
  principal: SecurityPrincipal,
  context: SecurityContext,
): Promise<void> {
  if (principal.kind === "system") {
    if (!sameContext(principal.context, context)) throw new SecurityCommandError("context-denied");
    return;
  }
  if (principal.kind !== "authenticated-user") throw new SecurityCommandError("context-denied");
  const [operator] = await database
    .select({ userId: providerAdmin.userId })
    .from(providerAdmin)
    .where(eq(providerAdmin.userId, principal.userId))
    .limit(1);
  if (!operator) throw new SecurityCommandError("context-denied");
}

export async function saveSecurityAuditRetentionPolicy(input: Readonly<{
  principal: SecurityPrincipal;
  context: SecurityContext;
  retentionDays: number;
  version: number;
  updatedAt?: Date;
}>): Promise<void> {
  assertContext(input.context);
  assertRetentionDays(input.retentionDays);
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new RangeError("version must be positive");
  const at = input.updatedAt ?? new Date();
  await db.transaction(async (database) => {
    await assertRetentionOperator(database, input.principal, input.context);
    await database.insert(securityAuditRetentionPolicy).values({
      ...contextColumns(input.context),
      securityContextKind: input.context.kind,
      contextId: input.context.contextId,
      retentionDays: input.retentionDays,
      version: input.version,
      updatedAt: at,
    }).onDuplicateKeyUpdate({ set: {
      retentionDays: input.retentionDays,
      version: input.version,
      updatedAt: at,
    }});
  });
}

export async function openSecurityAuditLegalHold(input: Readonly<{
  principal: SecurityPrincipal;
  context: SecurityContext;
  caseId: string;
  reason: string;
  id?: string;
  createdAt?: Date;
}>): Promise<string> {
  assertContext(input.context);
  if (!input.caseId || input.caseId.length > MAX_CASE_ID || !input.reason.trim() || input.reason.length > 1000) throw new RangeError("invalid legal hold");
  const id = input.id ?? randomUUID();
  const at = input.createdAt ?? new Date();
  await db.transaction(async (database) => {
    await assertRetentionOperator(database, input.principal, input.context);
    await database.insert(securityAuditLegalHold).values({
      id,
      ...contextColumns(input.context),
      securityContextKind: input.context.kind,
      contextId: input.context.contextId,
      caseId: input.caseId,
      reason: input.reason.trim(),
      state: "active",
      createdAt: at,
      releasedAt: null,
    }).onDuplicateKeyUpdate({ set: { state: "active", reason: input.reason.trim(), releasedAt: null } });
  });
  return id;
}

export async function releaseSecurityAuditLegalHold(input: Readonly<{ principal: SecurityPrincipal; context: SecurityContext; caseId: string; releasedAt?: Date }>): Promise<boolean> {
  assertContext(input.context);
  const at = input.releasedAt ?? new Date();
  return db.transaction(async (database) => {
    await assertRetentionOperator(database, input.principal, input.context);
    const updated = await database.update(securityAuditLegalHold).set({ state: "released", releasedAt: at }).where(and(
      eq(securityAuditLegalHold.securityContextKind, input.context.kind),
      eq(securityAuditLegalHold.contextId, input.context.contextId),
      eq(securityAuditLegalHold.caseId, input.caseId),
      eq(securityAuditLegalHold.state, "active"),
    ));
    return updated[0].affectedRows === 1;
  });
}

export type SecurityAuditRetentionCertificate = Readonly<{
  id: string;
  context: SecurityContext;
  policyVersion: number;
  retentionDays: number;
  legalHold: boolean;
  tenantDeleted: boolean;
  retainedCount: number;
  minimizedCount: number;
  disposalEligibleCount: number;
  eventWatermark: string;
  issuedAt: Date;
}>;

/**
 * Issues evidence of a retention decision. It deliberately never updates or
 * deletes audit events: minimization is applied by projections after tenant
 * deletion, while retained event hashes remain immutable.
 */
export async function issueSecurityAuditRetentionCertificate(input: Readonly<{
  principal: SecurityPrincipal;
  context: SecurityContext;
  now?: Date;
  id?: string;
}>): Promise<SecurityAuditRetentionCertificate> {
  assertContext(input.context);
  const now = input.now ?? new Date();
  return db.transaction(async (database) => {
    await assertRetentionOperator(database, input.principal, input.context);
    const [policy] = await database.select({ retentionDays: securityAuditRetentionPolicy.retentionDays, version: securityAuditRetentionPolicy.version }).from(securityAuditRetentionPolicy).where(and(
      eq(securityAuditRetentionPolicy.securityContextKind, input.context.kind),
      eq(securityAuditRetentionPolicy.contextId, input.context.contextId),
    )).limit(1).for("update");
    if (!policy) throw new Error("security audit retention policy is not configured");
    const [hold] = await database.select({ id: securityAuditLegalHold.id }).from(securityAuditLegalHold).where(and(
      eq(securityAuditLegalHold.securityContextKind, input.context.kind),
      eq(securityAuditLegalHold.contextId, input.context.contextId),
      eq(securityAuditLegalHold.state, "active"),
    )).limit(1);
    const [tenantRow] = input.context.kind === "tenant"
      ? await database.select({ operationalStatus: tenant.operationalStatus }).from(tenant).where(eq(tenant.id, input.context.tenantId)).limit(1)
      : [];
    if (input.context.kind === "tenant" && !tenantRow) throw new SecurityCommandError("context-denied");
    const tenantDeleted = input.context.kind === "tenant" && tenantRow?.operationalStatus === "closed";
    const events = await database.select({ occurredAt: securityAuditEvent.occurredAt }).from(securityAuditEvent).where(and(
      eq(securityAuditEvent.securityContextKind, input.context.kind),
      eq(securityAuditEvent.contextId, input.context.contextId),
    )).orderBy(asc(securityAuditEvent.sequence));
    const decisions: readonly SecurityAuditRetentionDecision[] = events.map((event) => decideSecurityAuditRetention({ occurredAt: event.occurredAt, now, retentionDays: policy.retentionDays, legalHold: hold !== undefined, tenantDeleted }));
    const retainedCount = decisions.filter((decision) => decision.action === "retain").length;
    const minimizedCount = decisions.filter((decision) => decision.action === "minimize").length;
    const disposalEligibleCount = decisions.filter((decision) => decision.action === "eligible-for-disposal").length;
    const [head] = await database.select({ headHash: securityAuditHead.headHash }).from(securityAuditHead).where(and(
      eq(securityAuditHead.securityContextKind, input.context.kind),
      eq(securityAuditHead.contextId, input.context.contextId),
    )).limit(1);
    const certificate: SecurityAuditRetentionCertificate = {
      id: input.id ?? randomUUID(),
      context: input.context,
      policyVersion: policy.version,
      retentionDays: policy.retentionDays,
      legalHold: hold !== undefined,
      tenantDeleted,
      retainedCount,
      minimizedCount,
      disposalEligibleCount,
      eventWatermark: head?.headHash ?? "0".repeat(64),
      issuedAt: now,
    };
    await database.insert(securityAuditRetentionCertificate).values({
      id: certificate.id,
      ...contextColumns(input.context),
      securityContextKind: input.context.kind,
      contextId: input.context.contextId,
      policyVersion: certificate.policyVersion,
      retentionDays: certificate.retentionDays,
      legalHold: certificate.legalHold,
      tenantDeleted: certificate.tenantDeleted,
      retainedCount: certificate.retainedCount,
      minimizedCount: certificate.minimizedCount,
      disposalEligibleCount: certificate.disposalEligibleCount,
      eventWatermark: certificate.eventWatermark,
      issuedAt: certificate.issuedAt,
    });
    return certificate;
  });
}
