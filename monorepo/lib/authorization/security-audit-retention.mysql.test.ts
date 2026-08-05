import "dotenv/config";

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  securityAuditEventHash,
  securityAuditEventPayloadDigest,
} from "@/lib/authorization/security-command";
import type { PersistedSecurityAuditEvent } from "@/lib/authorization/security-command-store";
import {
  issueSecurityAuditRetentionCertificate,
  openSecurityAuditLegalHold,
  releaseSecurityAuditLegalHold,
  saveSecurityAuditRetentionPolicy,
} from "@/lib/authorization/security-audit-retention-db

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

mysqlTest("persists policy, legal hold, and certificates without rewriting the audit chain", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const context = { kind: "provider" as const, contextId: randomUUID(), providerContextId: "" };
  context.providerContextId = context.contextId;
  const userId = randomUUID();
  const principal = { kind: "authenticated-user" as const, userId };
  const commandId = randomUUID();
  const eventId = randomUUID();
  const certificateIds = [randomUUID(), randomUUID(), randomUUID()];
  const previousHash = "0".repeat(64);
  const occurredAt = new Date("2026-01-01T00:00:00.000Z");
  const eventBase = {
    id: eventId,
    context,
    sequence: BigInt(1),
    eventKey: `${commandId}:audit:${digest("retention-test")}`,
    schemaVersion: 1,
    eventType: "security_audit.retention_test",
    outcome: "succeeded" as const,
    actor: { kind: "provider-admin" as const, userId, displayName: "Retention Test", email: "redacted@invalid" },
    commandId,
    targets: {},
    correlationId: randomUUID(),
    requestId: randomUUID(),
    reason: "retention integration test",
    metadata: {},
    previousHash,
    eventHash: "",
    occurredAt,
  } satisfies Omit<PersistedSecurityAuditEvent, "canonicalPayloadDigest">;
  const canonicalPayloadDigest = securityAuditEventPayloadDigest({ ...eventBase, canonicalPayloadDigest: "" });
  const eventHash = securityAuditEventHash(previousHash, canonicalPayloadDigest);
  const event = { ...eventBase, canonicalPayloadDigest, eventHash };

  try {
    await connection.execute(
      "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Retention Test', ?, true, NOW(3), NOW(3))",
      [userId, `${userId}@test.invalid`],
    );
    await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))", [userId]);
    await connection.execute(
      "INSERT INTO `security_command` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`provider_context_id`,`idempotency_key`,`command_name`,`fingerprint`,`status`,`result`,`created_at`,`completed_at`) VALUES (?, 'provider', ?, NULL, ?, ?, 'retention.test', ?, 'completed', '{}', ?, ?)",
      [commandId, context.contextId, context.providerContextId, randomUUID(), digest("command"), occurredAt, occurredAt],
    );
    await connection.execute(
      "INSERT INTO `security_audit_head` (`security_context_kind`,`context_id`,`tenant_id`,`provider_context_id`,`next_sequence`,`head_hash`,`version`,`updated_at`) VALUES ('provider', ?, NULL, ?, 2, ?, 1, ?)",
      [context.contextId, context.providerContextId, eventHash, occurredAt],
    );
    await connection.execute(
      "INSERT INTO `security_audit_event` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`provider_context_id`,`sequence`,`event_key`,`schema_version`,`event_type`,`outcome`,`actor_kind`,`actor_tenant_user_id`,`actor_provider_user_id`,`actor_service`,`command_id`,`correlation_id`,`request_id`,`reason`,`metadata`,`canonical_payload_digest`,`previous_hash`,`event_hash`,`occurred_at`) VALUES (?, 'provider', ?, NULL, ?, 1, ?, 1, ?, 'succeeded', 'provider-admin', NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [event.id, context.contextId, context.providerContextId, event.eventKey, event.eventType, userId, commandId, event.correlationId, event.requestId, event.reason, JSON.stringify(event.metadata), event.canonicalPayloadDigest, event.previousHash, event.eventHash, event.occurredAt],
    );

    await saveSecurityAuditRetentionPolicy({ principal, context, retentionDays: 7, version: 1, updatedAt: occurredAt });
    const holdId = await openSecurityAuditLegalHold({ principal, context, caseId: "case-retention-31", reason: "Incident evidence", id: randomUUID(), createdAt: occurredAt });
    const held = await issueSecurityAuditRetentionCertificate({ principal, context, now: new Date("2026-01-20T00:00:00.000Z"), id: certificateIds[0] });
    assert.equal(held.legalHold, true);
    assert.equal(held.retainedCount, 1);
    assert.equal(held.minimizedCount, 0);
    assert.equal(held.eventWatermark, eventHash);

    assert.equal(await releaseSecurityAuditLegalHold({ principal, context, caseId: "case-retention-31", releasedAt: new Date("2026-01-21T00:00:00.000Z") }), true);
    const expired = await issueSecurityAuditRetentionCertificate({ principal, context, now: new Date("2026-01-20T00:00:00.000Z"), id: certificateIds[1] });
    assert.equal(expired.legalHold, false);
    assert.equal(expired.disposalEligibleCount, 1);

    const unchanged = await issueSecurityAuditRetentionCertificate({ principal, context, now: new Date("2026-01-20T00:00:00.000Z"), id: certificateIds[2] });
    assert.equal(unchanged.minimizedCount, 0);
    assert.equal(unchanged.eventWatermark, eventHash);
    await assert.rejects(
      issueSecurityAuditRetentionCertificate({
        principal: { kind: "authenticated-user", userId: randomUUID() },
        context,
        now: new Date("2026-01-20T00:00:00.000Z"),
        id: randomUUID(),
      }),
      /context-denied/,
    );
    assert.notEqual(holdId, "");

    const [events] = await connection.execute<mysql.RowDataPacket[]>("SELECT `event_hash`,`canonical_payload_digest`,`sequence` FROM `security_audit_event` WHERE `id`=?", [eventId]);
    const [heads] = await connection.execute<mysql.RowDataPacket[]>("SELECT `head_hash`,`next_sequence` FROM `security_audit_head` WHERE `security_context_kind`='provider' AND `context_id`=?", [context.contextId]);
    assert.deepEqual(events[0], { event_hash: eventHash, canonical_payload_digest: canonicalPayloadDigest, sequence: 1 });
    assert.deepEqual(heads[0], { head_hash: eventHash, next_sequence: 2 });
  } finally {
    try {
      await connection.execute("DELETE FROM `security_audit_retention_certificate` WHERE `security_context_kind`='provider' AND `context_id`=?", [context.contextId]);
      await connection.execute("DELETE FROM `security_audit_legal_hold` WHERE `security_context_kind`='provider' AND `context_id`=?", [context.contextId]);
      await connection.execute("DELETE FROM `security_audit_retention_policy` WHERE `security_context_kind`='provider' AND `context_id`=?", [context.contextId]);
      await connection.execute("DELETE FROM `security_audit_event` WHERE `id`=?", [eventId]);
      await connection.execute("DELETE FROM `security_audit_head` WHERE `security_context_kind`='provider' AND `context_id`=?", [context.contextId]);
      await connection.execute("DELETE FROM `security_command` WHERE `id`=?", [commandId]);
      await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [userId]);
      await connection.execute("DELETE FROM `user` WHERE `id`=?", [userId]);
    } finally {
      await connection.end();
    }
  }
});
