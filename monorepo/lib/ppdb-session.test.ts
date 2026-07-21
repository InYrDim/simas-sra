import assert from "node:assert/strict";
import test from "node:test";

import { createPpdbSessionService, type PpdbSession, type PpdbSessionStore } from "@/lib/ppdb-session";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const validInput = { academicYearId: "year-1", endDate: "2026-08-31" };
const field = { id: "f1", label: "Nama Lengkap", type: "text" as const, required: true };

function memoryStore() {
  const sessions: PpdbSession[] = [];
  const store: PpdbSessionStore = {
    async list(tenantId) { return sessions.filter((session) => session.tenantId === tenantId).map((session) => structuredClone(session)); },
    async transaction(tenantId, work) {
      const snapshot = structuredClone(sessions);
      try {
        return await work({
          async list() { return sessions.filter((session) => session.tenantId === tenantId).map((session) => structuredClone(session)); },
          async save(session) { const index = sessions.findIndex((item) => item.id === session.id && item.tenantId === tenantId); if (index < 0) sessions.push(structuredClone(session)); else sessions[index] = structuredClone(session); },
        });
      } catch (error) { sessions.splice(0, sessions.length, ...snapshot); throw error; }
    },
  };
  return { store, sessions };
}

test("creates a draft Sesi PPDB referencing an existing Tahun Ajaran", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store, id: (() => { let value = 0; return () => `id-${++value}`; })(), now: () => new Date("2026-01-10T00:00:00Z") });
  const created = await service.create(principal, validInput);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.session.status, "draft");
  assert.deepEqual(created.session.fields, []);
});

test("rejects publishing a Sesi with no Form fields", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.publish(principal, created.session.id), { ok: false, code: "empty-fields" });
});

test("locks Form fields once a Sesi is published", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  await service.updateFields(principal, created.session.id, [field]);
  const published = await service.publish(principal, created.session.id);
  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.session.status, "published");
  assert.deepEqual(await service.updateFields(principal, created.session.id, [field, { ...field, id: "f2" }]), { ok: false, code: "locked" });
});

test("allows only one published Sesi PPDB per Tenant at a time", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const first = await service.create(principal, validInput);
  const second = await service.create(principal, validInput);
  if (!first.ok || !second.ok) return assert.fail();
  await service.updateFields(principal, first.session.id, [field]);
  await service.updateFields(principal, second.session.id, [field]);
  assert.equal((await service.publish(principal, first.session.id)).ok, true);
  assert.deepEqual(await service.publish(principal, second.session.id), { ok: false, code: "published-conflict" });
});

test("ends only a published Sesi, and never reopens it", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.end(principal, created.session.id), { ok: false, code: "invalid-transition" });
  await service.updateFields(principal, created.session.id, [field]);
  await service.publish(principal, created.session.id);
  const ended = await service.end(principal, created.session.id);
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(ended.session.status, "ended");
  assert.deepEqual(await service.publish(principal, created.session.id), { ok: false, code: "invalid-transition" });
});

test("scopes Sesi PPDB reads and writes to the requesting Tenant", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  const foreignPrincipal: MasterDataPrincipal = { ...principal, tenantId: "tenant-2" };
  assert.deepEqual(await service.list(foreignPrincipal), []);
  assert.deepEqual(await service.publish(foreignPrincipal, created.session.id), { ok: false, code: "not-found" });
});
