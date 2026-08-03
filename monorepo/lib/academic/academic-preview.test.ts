import assert from "node:assert/strict";
import test from "node:test";

import {
  createAcademicPreviewService,
  type AcademicPreviewRecord,
} from "@/lib/academic/academic-preview";

function memoryStore() {
  const rows = new Map<string, AcademicPreviewRecord>();
  return {
    rows,
    insert: async (row: AcademicPreviewRecord) => { rows.set(row.id, row); },
    findByTokenDigest: async (tokenDigest: string) => [...rows.values()].find((row) => row.tokenDigest === tokenDigest) ?? null,
    update: async (id: string, expectedVersion: number, patch: Partial<AcademicPreviewRecord>) => {
      const row = rows.get(id);
      if (!row) throw new Error("missing");
      if (row.version !== expectedVersion) return false;
      rows.set(id, { ...row, ...patch });
      return true;
    },
  };
}

test("preview binds tenant, actor, operation, and canonical intent", async () => {
  const store = memoryStore();
  const service = createAcademicPreviewService({ store, secret: "test-secret", id: () => "preview-1", now: () => 1_000 });
  const created = await service.create({ tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { b: 2, a: 1 } });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await service.commit({
    token: created.token,
    intent: { tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { a: 1, b: 2 } },
    idempotencyKey: "commit-1",
    reauthorize: async () => true,
    mutate: async () => ({ changed: 1 }),
  });
  assert.deepEqual(result, { ok: true, outcome: { changed: 1 } });
});

test("expiry, context loss, and changed intent share the concealed failure", async () => {
  const store = memoryStore();
  let clock = 1_000;
  const service = createAcademicPreviewService({ store, secret: "test-secret", now: () => clock });
  const created = await service.create({ tenantId: "tenant-a", actorUserId: "user-a", operationId: "subjects.update", payload: { id: "subject-a", version: 1 } }, 10);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  clock = 1_011;
  assert.deepEqual(await service.commit({ token: created.token, intent: { tenantId: "tenant-a", actorUserId: "user-a", operationId: "subjects.update", payload: { id: "subject-a", version: 1 } }, idempotencyKey: "commit-1", reauthorize: async () => true, mutate: async () => null }), { ok: false, code: "academic-preview-no-longer-valid" });

  const fresh = await service.create({ tenantId: "tenant-a", actorUserId: "user-a", operationId: "subjects.update", payload: { id: "subject-a", version: 1 } });
  assert.equal(fresh.ok, true);
  if (!fresh.ok) return;
  assert.deepEqual(await service.commit({ token: fresh.token, intent: { tenantId: "tenant-b", actorUserId: "user-a", operationId: "subjects.update", payload: { id: "subject-a", version: 1 } }, idempotencyKey: "commit-2", reauthorize: async () => true, mutate: async () => null }), { ok: false, code: "academic-preview-no-longer-valid" });
});

test("reauthorization failure causes no mutation and retry is not reusable", async () => {
  const store = memoryStore();
  const service = createAcademicPreviewService({ store, secret: "test-secret" });
  const created = await service.create({ tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { ids: ["student-a"] } });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  let mutated = false;
  const input = { token: created.token, intent: { tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { ids: ["student-a"] } }, idempotencyKey: "commit-1", reauthorize: async () => false, mutate: async () => { mutated = true; return null; } };
  assert.deepEqual(await service.commit(input), { ok: false, code: "academic-preview-no-longer-valid" });
  assert.equal(mutated, false);
  assert.deepEqual(await service.commit({ ...input, reauthorize: async () => true }), { ok: false, code: "academic-preview-no-longer-valid" });
});

test("two simultaneous commits of one token produce one effect", async () => {
  const store = memoryStore();
  const service = createAcademicPreviewService({ store, secret: "test-secret" });
  const created = await service.create({ tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { ids: ["student-a"] } });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  let effects = 0;
  const input = { token: created.token, intent: { tenantId: "tenant-a", actorUserId: "user-a", operationId: "class-groups.memberships.assign", payload: { ids: ["student-a"] } }, idempotencyKey: "commit-1", reauthorize: async () => true, mutate: async () => { effects++; return { effects }; } };
  const results = await Promise.all([service.commit(input), service.commit(input)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(effects, 1);
});

test("successful commit is retryable only with the same idempotency key", async () => {
  const store = memoryStore();
  const service = createAcademicPreviewService({ store, secret: "test-secret" });
  const intent = { tenantId: "tenant-a", actorUserId: "user-a", operationId: "subjects.update", payload: { id: "subject-a", version: 1 } };
  const created = await service.create(intent);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  let effects = 0;
  const commit = (idempotencyKey: string) => service.commit({ token: created.token, intent, idempotencyKey, reauthorize: async () => true, mutate: async () => ({ effects: ++effects }) });
  assert.deepEqual(await commit("commit-1"), { ok: true, outcome: { effects: 1 } });
  assert.deepEqual(await commit("commit-1"), { ok: true, outcome: { effects: 1 } });
  assert.deepEqual(await commit("commit-2"), { ok: false, code: "academic-preview-no-longer-valid" });
  assert.equal(effects, 1);
});
