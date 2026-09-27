import assert from "node:assert/strict";
import test from "node:test";

import { createTeachingSlotService, type TeachingSlotAssignmentFacts, type TeachingSlotServiceStore, type TeachingSlotRecord } from "@/lib/academic/teaching-slot-service";

function fixture(options?: { sessionCounts?: Map<string, number>; activeSemester?: "odd" | "even" | null }) {
  const slots: TeachingSlotRecord[] = [];
  const periods: { id: string; tenantId: string; label: string; startTime: string; endTime: string; sortOrder: number; version: number }[] = [];
  const rawAssignments: TeachingSlotAssignmentFacts[] = [
    { id: "asg-1", teacherProfileId: "teacher-1", classGroupId: "class-1", academicYearId: "year-1", status: "active" },
    { id: "asg-2", teacherProfileId: "teacher-1", classGroupId: "class-2", academicYearId: "year-1", status: "active" },
    { id: "asg-3", teacherProfileId: "teacher-3", classGroupId: "class-1", academicYearId: "year-1", status: "active" },
    { id: "asg-planned", teacherProfileId: "teacher-9", classGroupId: "class-9", academicYearId: "year-1", status: "planned" },
  ];
  const assignments = new Map<string, TeachingSlotAssignmentFacts>(rawAssignments.map((row) => [row.id, row]));
  const store: TeachingSlotServiceStore = {
    async assignmentsById(tenantId, ids) {
      const result = new Map<string, NonNullable<ReturnType<typeof assignments.get>>>();
      for (const id of ids) {
        const row = assignments.get(id);
        if (row) result.set(id, row);
      }
      void tenantId;
      return result;
    },
    async slotsInAcademicYear(tenantId, academicYearId) {
      const byAssignment = new Map([...assignments.values()].map((row) => [row.id, row]));
      return slots
        .filter((slot) => slot.tenantId === tenantId && byAssignment.get(slot.teachingAssignmentId)?.academicYearId === academicYearId)
        .map((slot) => ({ ...slot, teacherProfileId: byAssignment.get(slot.teachingAssignmentId)!.teacherProfileId, classGroupId: byAssignment.get(slot.teachingAssignmentId)!.classGroupId }));
    },
    async sessionCountsBySlotId(_tenantId, slotIds) {
      const counts = new Map<string, number>();
      for (const id of slotIds) {
        const count = options?.sessionCounts?.get(id);
        if (count) counts.set(id, count);
      }
      return counts;
    },
    async activeSemester(_tenantId, _academicYearId) {
      return options?.activeSemester ?? null;
    },
    async insertSlot(_tenantId, value) {
      slots.push(value);
    },
    async updateSlot(tenantId, value, expectedVersion) {
      const index = slots.findIndex((slot) => slot.tenantId === tenantId && slot.id === value.id && slot.version === expectedVersion);
      if (index < 0) return false;
      slots[index] = value;
      return true;
    },
    async deleteSlot(tenantId, id) {
      const index = slots.findIndex((slot) => slot.tenantId === tenantId && slot.id === id);
      if (index < 0) return false;
      slots.splice(index, 1);
      return true;
    },
    async listPeriods(tenantId) {
      return periods.filter((row) => row.tenantId === tenantId);
    },
    async insertPeriod(tenantId, value) {
      if (value.tenantId !== tenantId) throw new Error("Cross-Tenant teaching period write denied");
      periods.push(value);
    },
    async deletePeriod(tenantId, id) {
      const index = periods.findIndex((row) => row.tenantId === tenantId && row.id === id);
      if (index < 0) return false;
      periods.splice(index, 1);
      return true;
    },
  };
  return { service: createTeachingSlotService({ store }), slots, periods, ...options };
}

const base = { tenantId: "tenant-1", actorUserId: "admin-1" };

test("create rejects teacher double-booking at the write layer with conflict details", async () => {
  const f = fixture();
  await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  const result = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-2", dayOfWeek: "monday", startTime: "07:30", endTime: "08:30", semester: "odd" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "conflict");
  assert.equal(result.conflicts?.[0].kind, "teacher");
});

test("create rejects class-group double-booking and accepts touching windows", async () => {
  const f = fixture();
  const first = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.equal(first.ok, true);
  const touching = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-3", dayOfWeek: "monday", startTime: "08:00", endTime: "09:00", semester: "odd" });
  assert.equal(touching.ok, true);
  const overlapping = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-3", dayOfWeek: "monday", startTime: "07:30", endTime: "08:30", semester: "odd" });
  assert.equal(overlapping.ok, false);
  if (!overlapping.ok) {
    assert.equal(overlapping.code, "conflict");
    assert.equal(overlapping.conflicts?.[0].kind, "class-group");
  }
});

test("cross-semester and cross-day schedules do not conflict", async () => {
  const f = fixture();
  await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "even" })).ok, true);
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "tuesday", startTime: "07:00", endTime: "08:00", semester: "odd" })).ok, true);
});

test("edit excludes the edited slot itself", async () => {
  const f = fixture();
  const created = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.ok(created.ok);
  if (!created.ok) return;
  const updated = await f.service.updateSlot({ ...base, slotId: created.value.id, expectedVersion: 1, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:15", endTime: "08:15", semester: "odd" });
  assert.equal(updated.ok, true);
});

test("inactive assignment and semester mismatch are rejected", async () => {
  const f = fixture();
  const planned = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-planned", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.equal(planned.ok, false);
  if (!planned.ok) assert.equal(planned.code, "assignment-not-active");

  const strict = fixture({ activeSemester: "even" });
  const mismatch = await strict.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "semester-mismatch");
  const match = await strict.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "even" });
  assert.equal(match.ok, true);
});

test("stale expectedVersion yields version-conflict", async () => {
  const f = fixture();
  const created = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.ok(created.ok);
  if (!created.ok) return;
  const first = await f.service.updateSlot({ ...base, slotId: created.value.id, expectedVersion: 1, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:15", endTime: "08:15", semester: "odd" });
  assert.equal(first.ok, true);
  const stale = await f.service.updateSlot({ ...base, slotId: created.value.id, expectedVersion: 1, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:30", endTime: "08:30", semester: "odd" });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "version-conflict");
});

test("deleting a slot with sessions is blocked; a free slot deletes", async () => {
  const f = fixture();
  const created = await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" });
  assert.ok(created.ok);
  if (!created.ok) return;

  const busy = fixture({ sessionCounts: new Map([[created.value.id, 2]]) });
  const blocked = await busy.service.deleteSlot({ ...base, slotId: created.value.id });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "slot-in-use");

  const free = await f.service.deleteSlot({ ...base, slotId: created.value.id });
  assert.equal(free.ok, true);
  const gone = await f.service.deleteSlot({ ...base, slotId: created.value.id });
  assert.equal(gone.ok, false);
  if (!gone.ok) assert.equal(gone.code, "not-found");
});

test("invalid slot inputs fail closed", async () => {
  const f = fixture();
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "funday", startTime: "07:00", endTime: "08:00", semester: "odd" })).ok, false);
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "8:00", endTime: "09:00", semester: "odd" })).ok, false);
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "asg-1", dayOfWeek: "monday", startTime: "09:00", endTime: "08:00", semester: "odd" })).ok, false);
  assert.equal((await f.service.createSlot({ ...base, teachingAssignmentId: "", dayOfWeek: "monday", startTime: "07:00", endTime: "08:00", semester: "odd" })).ok, false);
});

test("period presets validate label, order, and window", async () => {
  const f = fixture();
  const ok = await f.service.createPeriod({ tenantId: "tenant-1", label: "Jam ke-1", startTime: "07:00", endTime: "07:40", sortOrder: 1 });
  assert.equal(ok.ok, true);
  assert.equal((await f.service.createPeriod({ tenantId: "tenant-1", label: "", startTime: "07:00", endTime: "07:40", sortOrder: 2 })).ok, false);
  assert.equal((await f.service.createPeriod({ tenantId: "tenant-1", label: "X", startTime: "07:40", endTime: "07:00", sortOrder: 2 })).ok, false);
  assert.equal((await f.service.createPeriod({ tenantId: "tenant-1", label: "X", startTime: "07:00", endTime: "07:40", sortOrder: 0 })).ok, false);
  const deleted = await f.service.deletePeriod({ tenantId: "tenant-1", periodId: ok.ok ? ok.value.id : "nope" });
  assert.equal(deleted.ok, true);
});
