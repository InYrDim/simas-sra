import assert from "node:assert/strict";
import test from "node:test";

import { createClassGroupService, type ClassGroup, type ClassGroupStore, type ClassGroupReferenceData } from "@/lib/class-group";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const input = { academicYearId: "year-1", educationLevel: "SMA" as const, grade: 10, groupName: "A", code: "X-A", capacity: 32, primaryLocationId: "room-1" };

function fixture() {
  const groups: ClassGroup[] = [];
  const history: unknown[] = [];
  const blockers: { id: string; tenantId: string; classGroupId: string; label: string; active: boolean }[] = [];
  const references: { academicYears: Array<ClassGroupReferenceData["academicYears"][number]>; locations: Array<ClassGroupReferenceData["locations"][number]> } = {
    academicYears: [{ id: "year-1", tenantId: "tenant-1", label: "2026/2027", lifecycle: "draft", archived: false }, { id: "year-2", tenantId: "tenant-2", label: "Lain", lifecycle: "draft", archived: false }],
    locations: [{ id: "room-1", tenantId: "tenant-1", name: "Ruang 10A", archived: false }, { id: "room-old", tenantId: "tenant-1", name: "Lama", archived: true }, { id: "room-other", tenantId: "tenant-2", name: "Tenant lain", archived: false }],
  };
  const store: ClassGroupStore = {
    async list(tenantId) { return groups.filter((group) => group.tenantId === tenantId).map((group) => structuredClone(group)); },
    async references(tenantId) { return { academicYears: references.academicYears.filter((item) => item.tenantId === tenantId), locations: references.locations.filter((item) => item.tenantId === tenantId) }; },
    async transaction(tenantId, work) {
      const snapshot = structuredClone(groups); const historySnapshot = structuredClone(history);
      try { return await work({
        async list() { return groups.filter((group) => group.tenantId === tenantId).map((group) => structuredClone(group)); },
        async references() { return { academicYears: references.academicYears.filter((item) => item.tenantId === tenantId), locations: references.locations.filter((item) => item.tenantId === tenantId) }; },
        async blockers(classGroupId) { return blockers.filter((item) => item.tenantId === tenantId && item.classGroupId === classGroupId && item.active); },
        async save(group, expectedVersion) { const index = groups.findIndex((item) => item.tenantId === tenantId && item.id === group.id); if (index < 0) { groups.push(structuredClone(group)); return expectedVersion === 0; } if (groups[index].version !== expectedVersion) return false; groups[index] = structuredClone(group); return true; },
        async appendHistory(event) { history.push(structuredClone(event)); },
      }); } catch (error) { groups.splice(0, groups.length, ...snapshot); history.splice(0, history.length, ...historySnapshot); throw error; }
    },
  };
  return { store, groups, history, blockers, references };
}

function service(store: ClassGroupStore) { let sequence = 0; return createClassGroupService({ store, id: () => `id-${++sequence}`, now: () => new Date("2026-07-01T00:00:00Z") }); }

test("creates a Tenant-owned Draft Rombongan Belajar in one Tahun Ajaran with an optional active location", async () => {
  const data = fixture(); const result = await service(data.store).create(principal, input);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual({ lifecycle: result.record.lifecycle, archived: result.record.archived, location: result.record.primaryLocationId, version: result.record.version }, { lifecycle: "draft", archived: false, location: "room-1", version: 1 });
  assert.equal(data.history.length, 1);
  assert.deepEqual(await service(data.store).list({ ...principal, tenantId: "tenant-2" }), []);
  assert.deepEqual(await service(data.store).create(principal, { ...input, academicYearId: "year-2" }), { ok: false, code: "invalid-academic-year" });
  assert.deepEqual(await service(data.store).create(principal, { ...input, primaryLocationId: "room-other" }), { ok: false, code: "invalid-location" });
  assert.deepEqual(await service(data.store).create(principal, { ...input, primaryLocationId: "room-old" }), { ok: false, code: "invalid-location" });
});

test("reserves normalized name per Tahun Ajaran and optional code per Tenant", async () => {
  const data = fixture(); const catalog = service(data.store); assert.equal((await catalog.create(principal, input)).ok, true);
  assert.deepEqual(await catalog.create(principal, { ...input, groupName: " a ", code: "OTHER" }), { ok: false, code: "duplicate-name" });
  assert.deepEqual(await catalog.create(principal, { ...input, groupName: "B", code: " x-a " }), { ok: false, code: "duplicate-code" });
});

test("uses explicit forward-only lifecycle and freezes year, level, and grade after activation", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); if (!created.ok) return;
  const active = await catalog.transition(principal, created.record.id, "activate", { expectedVersion: 1, reason: "Kelas dimulai" }); assert.equal(active.ok, true);
  assert.deepEqual(await catalog.edit(principal, created.record.id, { ...input, academicYearId: "other", groupName: "B" }, 2), { ok: false, code: "immutable-academic-context" });
  data.references.academicYears[0] = { ...data.references.academicYears[0], lifecycle: "closed" };
  const edited = await catalog.edit(principal, created.record.id, { ...input, groupName: "B", code: "X-B", capacity: 30 }, 2); assert.equal(edited.ok, true);
  assert.deepEqual(await catalog.transition(principal, created.record.id, "cancel", { expectedVersion: 3, reason: "Tidak jadi" }), { ok: false, code: "invalid-transition" });
  assert.equal((await catalog.transition(principal, created.record.id, "close", { expectedVersion: 3, reason: "Tahun selesai" })).ok, true);
});

test("rejects stale writes and only archives terminal Rombel without blockers", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); if (!created.ok) return;
  assert.deepEqual(await catalog.edit(principal, created.record.id, { ...input, groupName: "B" }, 99), { ok: false, code: "conflict" });
  assert.deepEqual(await catalog.archive(principal, created.record.id, { expectedVersion: 1, reason: "Arsip" }), { ok: false, code: "not-terminal" });
  await catalog.transition(principal, created.record.id, "cancel", { expectedVersion: 1, reason: "Dibatalkan" });
  data.blockers.push({ id: "member-1", tenantId: principal.tenantId, classGroupId: created.record.id, label: "Keanggotaan Siswa aktif", active: true });
  const blocked = await catalog.archive(principal, created.record.id, { expectedVersion: 2, reason: "Arsip" }); assert.equal(blocked.ok, false); if (blocked.ok) return; assert.equal(blocked.code, "relationship-blocked"); assert.deepEqual("blockers" in blocked ? blocked.blockers.map((item) => item.label) : [], ["Keanggotaan Siswa aktif"]);
  data.blockers[0].active = false; assert.equal((await catalog.archive(principal, created.record.id, { expectedVersion: 2, reason: "Arsip" })).ok, true);
  data.references.locations[0] = { ...data.references.locations[0], archived: true };
  assert.deepEqual(await catalog.reactivate(principal, created.record.id, { expectedVersion: 3, reason: "Dipakai lagi" }), { ok: false, code: "invalid-location" });
  data.references.locations[0] = { ...data.references.locations[0], archived: false };
  assert.equal((await catalog.reactivate(principal, created.record.id, { expectedVersion: 3, reason: "Dipakai lagi" })).ok, true);
  assert.deepEqual({ lifecycle: data.groups[0].lifecycle, archived: data.groups[0].archived }, { lifecycle: "cancelled", archived: false });
});
