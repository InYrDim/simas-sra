import assert from "node:assert/strict";
import test from "node:test";

import { createSubjectCatalogService, type Subject, type SubjectCatalogStore, type SubjectHistory } from "@/lib/subject-catalog";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const otherTenant = { ...principal, userId: "admin-2", tenantId: "tenant-2" };

function memoryStore() {
  const subjects: Subject[] = [];
  const history: SubjectHistory[] = [];
  const store: SubjectCatalogStore = {
    async list(tenantId) { return subjects.filter((subject) => subject.tenantId === tenantId).map((subject) => structuredClone(subject)); },
    async transaction(tenantId, work) {
      const subjectSnapshot = structuredClone(subjects);
      const historySnapshot = structuredClone(history);
      try {
        return await work({
          async list() { return subjects.filter((subject) => subject.tenantId === tenantId).map((subject) => structuredClone(subject)); },
          async save(subject, expectedVersion) {
            assert.equal(subject.tenantId, tenantId);
            const index = subjects.findIndex((item) => item.tenantId === tenantId && item.id === subject.id);
            if (index < 0) subjects.push(structuredClone(subject));
            else {
              if (subjects[index].version !== expectedVersion) return false;
              subjects[index] = structuredClone(subject);
            }
            return true;
          },
          async appendHistory(event) { history.push(structuredClone(event)); },
        });
      } catch (error) {
        subjects.splice(0, subjects.length, ...subjectSnapshot);
        history.splice(0, history.length, ...historySnapshot);
        throw error;
      }
    },
  };
  return { subjects, history, store };
}

const input = { code: "  mat-01 ", name: "  Matematika   Wajib ", educationLevels: ["SMA", "SMP", "SMA"], description: "  Dasar   matematika  " };

function service(store: SubjectCatalogStore) {
  let sequence = 0;
  return createSubjectCatalogService({ store, id: () => `id-${++sequence}`, now: () => new Date("2026-07-20T08:00:00Z") });
}

test("creates a normalized Mata Pelajaran without teaching assignments", async () => {
  const fixture = memoryStore();
  const result = await service(fixture.store).create(principal, input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.subject, {
    id: "id-1", tenantId: "tenant-1", code: "MAT-01", normalizedCode: "MAT-01", name: "Matematika Wajib", normalizedName: "matematika wajib",
    educationLevels: ["SMA", "SMP"], description: "Dasar matematika", archived: false, version: 1,
    createdAt: new Date("2026-07-20T08:00:00Z"), updatedAt: new Date("2026-07-20T08:00:00Z"), archivedAt: null,
  });
  assert.deepEqual(Object.keys(result.subject).sort(), ["archived", "archivedAt", "code", "createdAt", "description", "educationLevels", "id", "name", "normalizedCode", "normalizedName", "tenantId", "updatedAt", "version"]);
  assert.equal(fixture.history[0].operation, "created");
});

test("reserves normalized code and name after archive only inside the owning Tenant", async () => {
  const fixture = memoryStore();
  const catalog = service(fixture.store);
  const created = await catalog.create(principal, input);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await catalog.archive(principal, created.subject.id, 1)).ok, true);
  assert.deepEqual(await catalog.create(principal, { ...input, name: "Fisika" }), { ok: false, code: "duplicate-code" });
  assert.deepEqual(await catalog.create(principal, { ...input, code: "FIS-01" }), { ok: false, code: "duplicate-name" });
  assert.equal((await catalog.create(otherTenant, input)).ok, true);
  assert.equal((await catalog.list(principal)).length, 1);
  assert.equal((await catalog.list(otherTenant)).length, 1);
});

test("edits ordinary catalog fields with optimistic concurrency and immutable identity", async () => {
  const fixture = memoryStore();
  const catalog = service(fixture.store);
  const created = await catalog.create(principal, input);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const edited = await catalog.edit(principal, created.subject.id, { code: "mat-02", name: "Matematika Lanjutan", educationLevels: ["SMA"], description: "" }, 1);
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(edited.subject.id, created.subject.id);
  assert.equal(edited.subject.version, 2);
  assert.equal(edited.subject.description, null);
  assert.deepEqual(await catalog.edit(principal, created.subject.id, { ...input, code: "MAT-03" }, 1), { ok: false, code: "conflict" });
  assert.equal(fixture.subjects[0].code, "MAT-02");
  assert.deepEqual(fixture.history.map((event) => event.operation), ["created", "edited"]);
});

test("archived subjects are read-only and reactivation revalidates current uniqueness", async () => {
  const fixture = memoryStore();
  const catalog = service(fixture.store);
  const created = await catalog.create(principal, input);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await catalog.archive(principal, created.subject.id, 1)).ok, true);
  assert.deepEqual(await catalog.edit(principal, created.subject.id, input, 2), { ok: false, code: "archived" });
  assert.deepEqual(await catalog.reactivate(principal, created.subject.id, 1), { ok: false, code: "conflict" });
  const reactivated = await catalog.reactivate(principal, created.subject.id, 2);
  assert.equal(reactivated.ok, true);
  if (!reactivated.ok) return;
  assert.equal(reactivated.subject.archived, false);
  assert.equal(reactivated.subject.code, "MAT-01");
  assert.equal(reactivated.subject.version, 3);
  assert.deepEqual(fixture.history.map((event) => event.operation), ["created", "archived", "reactivated"]);
});

test("rejects malformed fields and cross-Tenant identifiers without mutation", async () => {
  const fixture = memoryStore();
  const catalog = service(fixture.store);
  assert.deepEqual(await catalog.create(principal, { ...input, code: "kode dengan spasi" }), { ok: false, code: "invalid-input" });
  assert.deepEqual(await catalog.create(principal, { ...input, educationLevels: [] }), { ok: false, code: "invalid-input" });
  const created = await catalog.create(principal, input);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.deepEqual(await catalog.archive(otherTenant, created.subject.id, 1), { ok: false, code: "not-found" });
  assert.equal(fixture.subjects.length, 1);
  assert.equal(fixture.history.length, 1);
});
