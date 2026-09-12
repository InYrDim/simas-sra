import assert from "node:assert/strict";
import test from "node:test";

import { createControlledSecurityCommandStore } from "@/lib/authorization/security-command-controlled-store";
import {
  createSecurityCommandService,
  securityAuditEvidence,
  securityAuditEventHash,
  securityAuditEventPayloadDigest,
  type SecurityAuditEventDraft,
} from "@/lib/authorization/security-command";
import {
  buildSecurityAuditCsv,
  decideSecurityAuditRetention,
  projectSecurityAuditEvents,
  verifySecurityAuditChain,
} from "@/lib/authorization/security-audit";

const actor = {
  kind: "tenant-user" as const,
  userId: "user-1",
  tenantId: "tenant-1",
  displayName: "Admin Sekolah",
  email: "admin@example.test",
};

function fixture() {
  const controlled = createControlledSecurityCommandStore({ actors: { [actor.userId]: actor } });
  const execute = createSecurityCommandService({
    store: controlled.store,
    createId: (() => { let index = 0; return () => `00000000-0000-4000-8000-${String(++index).padStart(12, "0")}`; })(),
    now: () => new Date("2026-08-01T00:00:00.000Z"),
    reportSecuritySignal: () => undefined,
  });
  return { controlled, execute };
}

const drafts: readonly SecurityAuditEventDraft[] = [{
  purpose: "account-change",
  order: "summary",
  eventType: "tenant_account.deactivated",
  targets: { userId: "target-1" },
  reason: "Akun dinonaktifkan",
  evidence: securityAuditEvidence(),
  metadata: { exportFormula: "=HYPERLINK(\"https://evil.test\")", password: "must-not-leak" },
}];

test("projects only the permitted partition and removes secrets and unnecessary personal data", async () => {
  const { controlled, execute } = fixture();
  await execute({
    principal: { kind: "authenticated-user", userId: actor.userId },
    idempotencyKey: "audit-projection-1",
    commandName: "tenant.account.change",
    payload: { targetUserId: "target-1" },
    correlationId: "correlation-1",
    authorizeAndMutate: async () => ({ result: { ok: true }, auditEvents: drafts }),
  });
  const event = controlled.snapshot().auditEvents;
  assert.doesNotMatch(JSON.stringify(event[0]?.metadata), /admin@example\.test/);
  const self = projectSecurityAuditEvents(event, { scope: "self", tenantId: "tenant-1", userId: "user-1" });
  assert.equal(self.length, 1);
  const tenant = projectSecurityAuditEvents(event, { scope: "tenant", tenantId: "tenant-1" });
  assert.equal(tenant.length, 1);
  assert.equal(self[0]?.actor.id, null);
  assert.equal(tenant[0]?.actor.id, actor.userId);
  assert.doesNotMatch(JSON.stringify(self), /password|example\.test/);
  assert.equal((self[0]?.metadata as { exportFormula?: string }).exportFormula, "'\=HYPERLINK(\"https://evil.test\")");
  assert.equal((self[0]?.metadata as { password?: string }).password, undefined);
  assert.deepEqual(projectSecurityAuditEvents(event, { scope: "tenant", tenantId: "other-tenant" }), []);
  assert.deepEqual(projectSecurityAuditEvents([...event, { ...event[0]!, id: "restricted-event", sequence: BigInt(2), eventType: "tenant_role.legacy_migration_finding" }], { scope: "tenant", tenantId: "tenant-1" }), tenant);
  assert.deepEqual(projectSecurityAuditEvents([{ ...event[0]!, eventType: "school_admin.authority_disabled", targets: { userId: actor.userId } }], { scope: "self", tenantId: "tenant-1", userId: actor.userId }), []);

  const providerContext = { kind: "provider" as const, contextId: "provider-1", providerContextId: "provider-1" };
  const providerRestricted = {
    ...event[0]!,
    id: "provider-restricted",
    context: providerContext,
    eventType: "security.integrity.failure",
    targets: {},
  };
  const providerVisible = {
    ...providerRestricted,
    id: "provider-visible",
    eventType: "provider.lifecycle.updated",
  };
  assert.deepEqual(projectSecurityAuditEvents([providerRestricted], {
    scope: "provider",
    providerContextId: providerContext.providerContextId,
  }), []);
  assert.equal(projectSecurityAuditEvents([providerVisible], {
    scope: "provider",
    providerContextId: providerContext.providerContextId,
  }).length, 1);

  const minimized = projectSecurityAuditEvents(event, { scope: "tenant", tenantId: "tenant-1", postTenantDeletion: true });
  assert.equal(minimized[0]?.targetUserId, null);
  assert.equal(minimized[0]?.actor.id, null);
  assert.equal(minimized[0]?.reason, null);
  assert.doesNotMatch(JSON.stringify(minimized), /user-1|target-1|Admin Sekolah|example\\.test/);
});

test("v2 canonical payload excludes actor email while v1 verification preserves it", async () => {
  const { controlled, execute } = fixture();
  await execute({
    principal: { kind: "authenticated-user", userId: actor.userId },
    idempotencyKey: "audit-schema-email-1",
    commandName: "tenant.account.change",
    payload: { targetUserId: "target-1" },
    correlationId: "correlation-schema-email",
    authorizeAndMutate: async () => ({ result: { ok: true }, auditEvents: drafts }),
  });
  const event = controlled.snapshot().auditEvents[0]!;
  assert.equal(event.schemaVersion, 2);
  const changedActor = { ...event, actor: { ...actor, email: "changed@example.test" } };
  assert.equal(securityAuditEventPayloadDigest(changedActor), event.canonicalPayloadDigest);
  const legacy = { ...event, schemaVersion: 1 };
  assert.notEqual(
    securityAuditEventPayloadDigest({ ...legacy, actor: changedActor.actor }),
    securityAuditEventPayloadDigest(legacy),
  );
});

test("verifies the anchored chain and detects payload, reorder, and deletion tampering", async () => {
  const { controlled, execute } = fixture();
  await execute({
    principal: { kind: "authenticated-user", userId: actor.userId },
    idempotencyKey: "audit-integrity-1",
    commandName: "tenant.account.change",
    payload: { targetUserId: "target-1" },
    correlationId: "correlation-1",
    authorizeAndMutate: async () => ({ result: { ok: true }, auditEvents: [
      ...drafts,
      { purpose: "follow-up", order: "consequence", eventType: "tenant_account.zero_role_entered", targets: { userId: "target-1" }, evidence: securityAuditEvidence(), metadata: {} },
    ] }),
  });
  const snapshot = controlled.snapshot();
  const context = { kind: "tenant" as const, contextId: "tenant-1", tenantId: "tenant-1" };
  const head = snapshot.auditHeads["tenant:tenant-1"]!;
  assert.equal(verifySecurityAuditChain(snapshot.auditEvents, { context, headHash: head.headHash, nextSequence: head.nextSequence }).valid, true);
  const tampered = snapshot.auditEvents.map((event) => event.id === snapshot.auditEvents[0]?.id ? { ...event, metadata: { changed: true } } : event);
  const result = verifySecurityAuditChain(tampered, { context, headHash: head.headHash, nextSequence: head.nextSequence });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "payload-digest-mismatch"));
  const deleted = snapshot.auditEvents.slice(1);
  assert.ok(verifySecurityAuditChain(deleted, { context, headHash: head.headHash, nextSequence: head.nextSequence }).findings.some((finding) => finding.code === "sequence-gap"));
  assert.equal(securityAuditEventHash(snapshot.auditEvents[0]!.previousHash, snapshot.auditEvents[0]!.canonicalPayloadDigest), snapshot.auditEvents[0]!.eventHash);
});

test("detects reordered, duplicated, forked, and unanchored events", async () => {
  const { controlled, execute } = fixture();
  await execute({
    principal: { kind: "authenticated-user", userId: actor.userId },
    idempotencyKey: "audit-tamper-1",
    commandName: "tenant.account.change",
    payload: { targetUserId: "target-1" },
    correlationId: "correlation-tamper",
    authorizeAndMutate: async () => ({ result: { ok: true }, auditEvents: [
      ...drafts,
      { purpose: "follow-up", order: "consequence", eventType: "tenant_account.zero_role_entered", targets: { userId: "target-1" }, evidence: securityAuditEvidence(), metadata: {} },
    ] }),
  });
  const snapshot = controlled.snapshot();
  const context = { kind: "tenant" as const, contextId: "tenant-1", tenantId: "tenant-1" };
  const head = snapshot.auditHeads["tenant:tenant-1"]!;
  const reordered = [snapshot.auditEvents[1]!, snapshot.auditEvents[0]!];
  assert.ok(verifySecurityAuditChain(reordered, { context, headHash: head.headHash, nextSequence: head.nextSequence }).findings.some((finding) => finding.code === "reordered-event"));
  const duplicated = [...snapshot.auditEvents, snapshot.auditEvents[1]!];
  assert.ok(verifySecurityAuditChain(duplicated, { context, headHash: head.headHash, nextSequence: head.nextSequence }).findings.some((finding) => finding.code === "duplicate-event"));
  const forked = snapshot.auditEvents.map((event, index) => index === 1 ? { ...event, previousHash: "f".repeat(64) } : event);
  assert.ok(verifySecurityAuditChain(forked, { context, headHash: head.headHash, nextSequence: head.nextSequence }).findings.some((finding) => finding.code === "forked-chain"));
  const unanchored = snapshot.auditEvents.map((event, index) => index === 0 ? { ...event, previousHash: "a".repeat(64) } : event);
  assert.ok(verifySecurityAuditChain(unanchored, { context, headHash: head.headHash, nextSequence: head.nextSequence }).findings.some((finding) => finding.code === "unanchored-event"));
});

test("CSV export neutralizes spreadsheet formulas and retention respects legal hold and deletion minimization", () => {
  const csv = buildSecurityAuditCsv([{
    id: "event-1", sequence: "1", eventType: "=IMPORTXML", outcome: "succeeded",
    actor: { kind: "tenant-user", id: "user-1", label: "@actor" }, targetUserId: null,
    correlationId: "corr-1", reason: "+unsafe", metadata: {}, occurredAt: "2026-08-01T00:00:00.000Z",
  }]);
  assert.match(csv, /'=@?IMPORTXML/);
  assert.match(csv, /'\+unsafe/);
  const now = new Date("2026-08-10T00:00:00.000Z");
  assert.deepEqual(decideSecurityAuditRetention({ occurredAt: now, now, retentionDays: 1, legalHold: true, tenantDeleted: false }), { action: "retain", reason: "legal-hold" });
  assert.deepEqual(decideSecurityAuditRetention({ occurredAt: new Date("2020-01-01"), now, retentionDays: 1, legalHold: false, tenantDeleted: true }), { action: "minimize", reason: "tenant-deleted" });
  assert.deepEqual(decideSecurityAuditRetention({ occurredAt: new Date("2020-01-01"), now, retentionDays: 1, legalHold: false, tenantDeleted: false }), { action: "eligible-for-disposal", reason: "retention-expired" });
});
