import assert from "node:assert/strict";
import test from "node:test";

import { createAcademicYearService, type AcademicYear, type AcademicYearStore } from "@/lib/academic-year";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const validInput = { label: "2026/2027", startDate: "2026-07-13", endDate: "2027-06-25", oddStartDate: "2026-07-13", oddEndDate: "2026-12-18", evenStartDate: "2026-12-19", evenEndDate: "2027-06-25" };

function memoryStore() {
  const years: AcademicYear[] = [];
  const history: unknown[] = [];
  const store: AcademicYearStore = {
    async list(tenantId) { return years.filter((year) => year.tenantId === tenantId).map((year) => structuredClone(year)); },
    async transaction(tenantId, work) {
      const snapshot = structuredClone(years);
      const auditSnapshot = structuredClone(history);
      try {
        return await work({
          async list() { return years.filter((year) => year.tenantId === tenantId).map((year) => structuredClone(year)); },
          async save(year) { const index = years.findIndex((item) => item.id === year.id && item.tenantId === tenantId); if (index < 0) years.push(structuredClone(year)); else years[index] = structuredClone(year); },
          async appendHistory(event) { history.push(structuredClone(event)); },
        });
      } catch (error) { years.splice(0, years.length, ...snapshot); history.splice(0, history.length, ...auditSnapshot); throw error; }
    },
  };
  return { store, years, history };
}

test("creates exactly two contiguous Semesters inside a Tenant-unique Tahun Ajaran", async () => {
  const fixture = memoryStore();
  const service = createAcademicYearService({ store: fixture.store, id: (() => { let value = 0; return () => `id-${++value}`; })(), now: () => new Date("2026-07-01T00:00:00Z") });
  const created = await service.create(principal, validInput);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.deepEqual(created.year.semesters.map(({ kind, status, startDate, endDate }) => ({ kind, status, startDate, endDate })), [
    { kind: "odd", status: "pending", startDate: "2026-07-13", endDate: "2026-12-18" },
    { kind: "even", status: "pending", startDate: "2026-12-19", endDate: "2027-06-25" },
  ]);
  assert.equal(created.year.lifecycle, "draft");
  assert.equal(fixture.history.length, 1);
  assert.deepEqual(await service.list({ ...principal, tenantId: "tenant-2" }), []);
  assert.deepEqual(await service.create(principal, validInput), { ok: false, code: "duplicate-label" });
});

test("rejects gaps, overlaps, reversed dates, and year ranges overlapping reserved history", async () => {
  const fixture = memoryStore();
  const service = createAcademicYearService({ store: fixture.store });
  for (const input of [
    { ...validInput, evenStartDate: "2026-12-20" },
    { ...validInput, evenStartDate: "2026-12-18" },
    { ...validInput, oddEndDate: "2026-07-01" },
    { ...validInput, oddStartDate: "2026-07-01" },
  ]) assert.equal((await service.create(principal, input)).ok, false);
  assert.equal((await service.create(principal, validInput)).ok, true);
  assert.deepEqual(await service.create(principal, { ...validInput, label: "Periode lain", startDate: "2027-06-01", endDate: "2028-05-31", oddStartDate: "2027-06-01", oddEndDate: "2027-11-30", evenStartDate: "2027-12-01", evenEndDate: "2028-05-31" }), { ok: false, code: "overlapping-year" });
});

test("moves forward explicitly and records actor, time, and effective date for every transition", async () => {
  const fixture = memoryStore();
  let current = new Date("2026-07-01T00:00:00Z");
  const service = createAcademicYearService({ store: fixture.store, now: () => current });
  const created = await service.create(principal, validInput); if (!created.ok) return;
  current = new Date("2026-07-10T00:00:00Z");
  assert.equal((await service.transition(principal, created.year.id, "activate", "2026-07-13")).ok, true);
  assert.equal((await service.transition(principal, created.year.id, "start-even", "2026-12-19")).ok, true);
  assert.equal((await service.transition(principal, created.year.id, "close", "2027-06-25")).ok, true);
  assert.deepEqual(fixture.years[0].semesters.map((semester) => semester.status), ["completed", "completed"]);
  assert.equal(fixture.years[0].lifecycle, "closed");
  assert.deepEqual(await service.transition(principal, created.year.id, "activate", "2027-07-01"), { ok: false, code: "invalid-transition" });
  assert.deepEqual(fixture.history.slice(1).map((entry) => { const event = entry as { actorUserId: string; effectiveDate: string; occurredAt: Date }; return [event.actorUserId, event.effectiveDate, event.occurredAt.toISOString()]; }), [
    ["admin-1", "2026-07-13", "2026-07-10T00:00:00.000Z"], ["admin-1", "2026-12-19", "2026-07-10T00:00:00.000Z"], ["admin-1", "2027-06-25", "2026-07-10T00:00:00.000Z"],
  ]);
});

test("only terminal years archive and reactivation restores the terminal lifecycle", async () => {
  const fixture = memoryStore();
  const service = createAcademicYearService({ store: fixture.store });
  const created = await service.create(principal, validInput); if (!created.ok) return;
  assert.deepEqual(await service.archive(principal, created.year.id, "2027-01-01"), { ok: false, code: "not-terminal" });
  assert.equal((await service.transition(principal, created.year.id, "cancel", "2026-07-02")).ok, true);
  assert.equal((await service.archive(principal, created.year.id, "2026-07-03")).ok, true);
  assert.deepEqual({ lifecycle: fixture.years[0].lifecycle, archived: fixture.years[0].archived }, { lifecycle: "cancelled", archived: true });
  assert.equal((await service.reactivate(principal, created.year.id, "2026-07-04")).ok, true);
  assert.deepEqual({ lifecycle: fixture.years[0].lifecycle, archived: fixture.years[0].archived }, { lifecycle: "cancelled", archived: false });
});
