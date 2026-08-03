import assert from "node:assert/strict";
import test from "node:test";

import { createTeachingAssignmentService, isTeachingAssignmentEffective, type TeachingAssignment, type TeachingAssignmentEndpoint, type TeachingAssignmentStore } from "@/lib/academic/teaching-assignment";

function fixture() {
  const rows: TeachingAssignment[] = [];
  const audits: unknown[] = [];
  const endpoints: TeachingAssignmentEndpoint = {
    teacher: { id: "teacher-1", tenantId: "tenant-1", active: true, archived: false },
    subject: { id: "subject-1", tenantId: "tenant-1", archived: false, educationLevels: ["SMA"] },
    classGroup: { id: "class-1", tenantId: "tenant-1", academicYearId: "year-1", educationLevel: "SMA", lifecycle: "active", archived: false },
    academicYear: { id: "year-1", tenantId: "tenant-1", startDate: "2026-01-01", endDate: "2026-12-31", lifecycle: "active", archived: false },
  };
  const store: TeachingAssignmentStore = {
    async actor(_tenantId, userId) { return userId === "admin-1"; },
    async list(tenantId) { return rows.filter((row) => row.tenantId === tenantId); },
    async endpoints() { return endpoints; },
    async transaction(tenantId, work) {
      return work({
        list: async () => rows.filter((row) => row.tenantId === tenantId),
        endpoints: async () => endpoints,
        async insert(value) { rows.push(value); },
        async update(value, expectedVersion) { const index = rows.findIndex((row) => row.id === value.id && row.tenantId === tenantId && row.version === expectedVersion); if (index < 0) return false; rows[index] = value; return true; },
        async audit(value) { audits.push(value); },
        async lockScope() {},
      });
    },
  };
  return { service: createTeachingAssignmentService({ store, id: (() => { let n = 0; return () => `id-${++n}`; })(), now: () => new Date("2026-02-01T00:00:00Z") }), rows, audits, endpoints };
}

const input = { tenantId: "tenant-1", teacherProfileId: "teacher-1", subjectId: "subject-1", classGroupId: "class-1", academicYearId: "year-1", startsOn: "2026-02-01", endsOn: null, reason: "Penugasan semester", createdByUserId: "admin-1" };

test("creates a planned complete tuple and records an audit event", async () => {
  const f = fixture();
  const result = await f.service.create(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.status, "planned");
  assert.equal(result.record.version, 1);
  assert.equal(f.audits.length, 1);
});

test("activation is explicit and only active assignments are effective", async () => {
  const f = fixture(); const created = await f.service.create(input); assert.equal(created.ok, true); if (!created.ok) return;
  const activated = await f.service.activate("tenant-1", created.record.id, "admin-1", 1, "2026-02-01", "Mulai mengajar");
  assert.equal(activated.ok, true); if (!activated.ok) return;
  assert.equal(isTeachingAssignmentEffective(activated.record, "2026-02-01"), true);
  assert.equal(isTeachingAssignmentEffective(activated.record, "2027-01-01", "2026-12-31"), false);
});

test("rejects overlap, wrong tenant endpoints, invalid dates, and lifecycle shortcuts", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.create({ ...input, startsOn: "2026-02-02", endsOn: "2026-02-02" }), { ok: false, code: "invalid-endpoint" });
  assert.deepEqual(await f.service.create({ ...input, startsOn: "2026-02-31" }), { ok: false, code: "invalid-input" });
  const first = await f.service.create(input); assert.equal(first.ok, true); if (!first.ok) return;
  assert.deepEqual(await f.service.create({ ...input, startsOn: "2026-06-01", reason: "Overlap" }), { ok: false, code: "overlap" });
  const activated = await f.service.activate("tenant-1", first.record.id, "admin-1", 1, "2026-02-01", "Aktif");
  assert.equal(activated.ok, true);
  assert.deepEqual(await f.service.activate("tenant-1", first.record.id, "admin-1", 1, "2026-02-01", "Stale"), { ok: false, code: "conflict" });
});

test("ending closes the half-open interval and is terminal", async () => {
  const f = fixture(); const created = await f.service.create(input); assert.equal(created.ok, true); if (!created.ok) return;
  const activated = await f.service.activate("tenant-1", created.record.id, "admin-1", 1, "2026-02-01", "Aktif"); assert.equal(activated.ok, true); if (!activated.ok) return;
  const ended = await f.service.end("tenant-1", created.record.id, "admin-1", 2, "2026-06-01", "Selesai"); assert.equal(ended.ok, true, JSON.stringify(ended)); if (!ended.ok) return;
  assert.equal(ended.record.endsOn, "2026-06-01"); assert.equal(isTeachingAssignmentEffective(ended.record, "2026-05-31"), false); assert.equal(isTeachingAssignmentEffective(ended.record, "2026-06-01"), false);
  assert.deepEqual(await f.service.activate("tenant-1", created.record.id, "admin-1", 3, "2026-06-01", "Buka lagi"), { ok: false, code: "invalid-lifecycle" });
});

test("planned assignments can be edited with a version and replacement is atomic", async () => {
  const f = fixture(); const created = await f.service.create(input); assert.equal(created.ok, true); if (!created.ok) return;
  const edited = await f.service.updatePlanned("tenant-1", created.record.id, "admin-1", 1, { ...input, startsOn: "2026-03-01" }, "Koreksi tanggal");
  assert.equal(edited.ok, true); if (!edited.ok) return; assert.equal(edited.record.startsOn, "2026-03-01"); assert.equal(edited.record.version, 2);
  const activated = await f.service.activate("tenant-1", created.record.id, "admin-1", 2, "2026-03-01", "Aktif"); assert.equal(activated.ok, true); if (!activated.ok) return;
  const replacement = await f.service.replace("tenant-1", created.record.id, "admin-1", 3, { teacherProfileId: input.teacherProfileId, subjectId: input.subjectId, classGroupId: input.classGroupId, academicYearId: input.academicYearId, startsOn: "2026-06-01" }, "Penggantian");
  assert.equal(replacement.ok, true, JSON.stringify(replacement)); if (!replacement.ok) return;
  assert.equal(replacement.previous.endsOn, "2026-06-01"); assert.equal(replacement.record.status, "active"); assert.equal(replacement.record.version, 1);
  assert.equal(f.audits.some((event) => (event as { operation?: string }).operation === "replaced"), true);
});
