import assert from "node:assert/strict";
import test from "node:test";

import { createControlledSecurityCommandStore } from "@/lib/authorization/security-command-controlled-store";
import {
  createSecurityCommandService,
  requireOptimisticUpdate,
  SecurityCommandError,
  securityCommandFingerprint,
  type SecurityAuditEventDraft,
} from "@/lib/authorization/security-command";
import type { SecurityCommandTransactionStep } from "@/lib/authorization/security-command-store";

const actor = {
  kind: "tenant-user" as const,
  userId: "user-1",
  tenantId: "tenant-1",
  displayName: "Admin Sekolah",
  email: "admin@example.test",
};
const principal = { kind: "authenticated-user" as const, userId: actor.userId };
const now = new Date("2026-07-31T10:00:00.000Z");

function ids() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

function auditEvents(): readonly SecurityAuditEventDraft[] {
  return [
    {
      purpose: "child-role-b",
      order: "child",
      eventType: "tenant_assignment.roles_replaced",
      targets: { assignmentId: "assignment-b" },
      metadata: { roleIds: ["role-b"] },
    },
    {
      purpose: "consequence-zero-role",
      order: "consequence",
      eventType: "tenant_account.zero_role_entered",
      targets: { userId: "target-user" },
      metadata: {},
    },
    {
      purpose: "parent-account",
      order: "parent",
      eventType: "tenant_account.deactivated",
      targets: { userId: "target-user" },
      reason: "Account no longer used",
      metadata: { fromVersion: 1, toVersion: 2 },
    },
    {
      purpose: "child-role-a",
      order: "child",
      eventType: "tenant_assignment.roles_replaced",
      targets: { assignmentId: "assignment-a" },
      metadata: { roleIds: ["role-a"] },
    },
    {
      purpose: "summary-suspension",
      order: "summary",
      eventType: "tenant_assignment.suspension_summary",
      targets: { userId: "target-user" },
      metadata: { affectedCount: 2 },
    },
  ];
}

function fixture(failAfter?: SecurityCommandTransactionStep) {
  const controlled = createControlledSecurityCommandStore({
    actors: { [actor.userId]: actor },
    initialState: [{ id: "role-1", version: 1, value: { name: "Old" } }],
    failAfter,
  });
  const signals: unknown[] = [];
  const execute = createSecurityCommandService({
    store: controlled.store,
    createId: ids(),
    now: () => now,
    reportSecuritySignal: (signal) => { signals.push(signal); },
  });
  return { controlled, execute, signals };
}

function commandInput(name = "New") {
  return {
    principal,
    idempotencyKey: "stable-key-0001",
    commandName: "tenant-role.rename",
    payload: { roleId: "role-1", name, tenantId: "browser-spoofed-tenant" },
    expectedVersions: [{ resourceType: "tenant-role", resourceId: "role-1", expectedVersion: 1 }],
    correlationId: "correlation-1",
    requestId: "request-1",
  } as const;
}



async function executeRename(fixtureValue: ReturnType<typeof fixture>, name = "New") {
  return fixtureValue.execute({
    ...commandInput(name),
    authorizeAndMutate: async ({ transaction }) => {
      const current = await transaction.readState("role-1");
      assert.ok(current);
      requireOptimisticUpdate(await transaction.writeState({
        id: current.id,
        expectedVersion: 1,
        value: { name },
      }), "tenant-role:role-1");
      return {
        result: { roleId: current.id, version: 2, name },
        versionTransitions: [{
          resourceType: "tenant-role",
          resourceId: current.id,
          expectedVersion: 1,
          toVersion: 2,
        }],
        auditEvents: auditEvents(),
        outbox: [{ purpose: "role-renamed", eventType: "security.role.changed", payload: { roleId: current.id } }],
      };
    },
  });
}

test("canonical fingerprints ignore object key and expected-version order", () => {
  const left = securityCommandFingerprint({
    commandName: "tenant-role.update",
    payload: { z: 1, nested: { b: true, a: false } },
    expectedVersions: [
      { resourceType: "tenant-role", resourceId: "b", expectedVersion: 2 },
      { resourceType: "tenant-role", resourceId: "a", expectedVersion: 1 },
    ],
  });
  const right = securityCommandFingerprint({
    commandName: "tenant-role.update",
    payload: { nested: { a: false, b: true }, z: 1 },
    expectedVersions: [
      { resourceType: "tenant-role", resourceId: "a", expectedVersion: 1 },
      { resourceType: "tenant-role", resourceId: "b", expectedVersion: 2 },
    ],
  });
  assert.equal(left, right);
  assert.notEqual(left, securityCommandFingerprint({ commandName: "tenant-role.archive", payload: { nested: { a: false, b: true }, z: 1 }, expectedVersions: [] }));
});

test("derives Tenant context from the locked actor and commits ordered atomic effects", async () => {
  const value = fixture();
  const result = await executeRename(value);
  assert.equal(result.existing, false);

  const snapshot = value.controlled.snapshot();
  assert.deepEqual(snapshot.state, [{ id: "role-1", version: 2, value: { name: "New" } }]);
  assert.equal(snapshot.commands.length, 1);
  assert.equal(snapshot.outbox.length, 1);
  assert.equal(snapshot.outbox[0]?.context.contextId, actor.tenantId);
  assert.deepEqual(snapshot.auditEvents.map((event) => event.eventType), [
    "tenant_account.deactivated",
    "tenant_assignment.suspension_summary",
    "tenant_assignment.roles_replaced",
    "tenant_assignment.roles_replaced",
    "tenant_account.zero_role_entered",
  ]);
  assert.deepEqual(snapshot.auditEvents.map((event) => event.targets.assignmentId ?? null), [null, null, "assignment-a", "assignment-b", null]);
  assert.deepEqual(snapshot.auditEvents.map((event) => event.sequence), [1, 2, 3, 4, 5].map(BigInt));
  assert.deepEqual(snapshot.auditEvents[0]?.metadata, {
    actor: {
      kind: "tenant-user",
      userId: actor.userId,
      tenantId: actor.tenantId,
      displayName: actor.displayName,
      email: actor.email,
    },
    details: { fromVersion: 1, toVersion: 2 },
  });
  assert.equal(snapshot.auditEvents[0]?.previousHash, "0".repeat(64));
  for (let index = 1; index < snapshot.auditEvents.length; index += 1) {
    assert.equal(snapshot.auditEvents[index]?.previousHash, snapshot.auditEvents[index - 1]?.eventHash);
  }
  assert.deepEqual(snapshot.auditHeads["tenant:tenant-1"], {
    nextSequence: BigInt(6),
    headHash: snapshot.auditEvents.at(-1)?.eventHash,
    version: 2,
  });
});

test("returns the committed result on replay without rerunning the mutation", async () => {
  const value = fixture();
  const first = await executeRename(value);
  let mutationCalls = 0;
  const replay = await value.execute({
    ...commandInput(),
    authorizeAndMutate: async () => {
      mutationCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.deepEqual(replay, { ...first, existing: true });
  assert.equal(mutationCalls, 0);
  assert.equal(value.controlled.snapshot().auditEvents.length, 5);
});

test("rejects changed payload under one idempotency key and emits a hashed security signal", async () => {
  const value = fixture();
  await executeRename(value);
  await assert.rejects(executeRename(value, "Different"), (error: unknown) =>
    error instanceof SecurityCommandError && error.code === "idempotency-conflict");
  assert.equal(value.signals.length, 1);
  assert.match(JSON.stringify(value.signals[0]), /security-command\.idempotency-conflict/);
  assert.doesNotMatch(JSON.stringify(value.signals[0]), /stable-key-0001/);
  assert.deepEqual(value.controlled.snapshot().state, [{ id: "role-1", version: 2, value: { name: "New" } }]);
});

test("rolls back when optimistic state is stale", async () => {
  const value = fixture();
  await assert.rejects(value.execute({
    ...commandInput(),
    expectedVersions: [{ resourceType: "tenant-role", resourceId: "role-1", expectedVersion: 2 }],
    authorizeAndMutate: async ({ transaction }) => {
      requireOptimisticUpdate(await transaction.writeState({ id: "role-1", expectedVersion: 2, value: { name: "No" } }));
      throw new Error("unreachable");
    },
  }), (error: unknown) => error instanceof SecurityCommandError && error.code === "stale-version");
  const snapshot = value.controlled.snapshot();
  assert.deepEqual(snapshot.state, [{ id: "role-1", version: 1, value: { name: "Old" } }]);
  assert.equal(snapshot.commands.length, 0);
  assert.equal(snapshot.auditEvents.length, 0);
  assert.equal(snapshot.outbox.length, 0);
});

for (const step of ["idempotency", "state", "audit", "head", "outbox"] as const) {
  test(`controlled store rolls back every effect after injected ${step} failure`, async () => {
    const value = fixture(step);
    await assert.rejects(executeRename(value), new RegExp(`Injected failure after ${step}`));
    assert.deepEqual(value.controlled.snapshot(), {
      state: [{ id: "role-1", version: 1, value: { name: "Old" } }],
      commands: [],
      auditEvents: [],
      auditHeads: {},
      outbox: [],
    });
  });
}
