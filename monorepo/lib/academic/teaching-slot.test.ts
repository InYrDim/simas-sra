import assert from "node:assert/strict";
import test from "node:test";

import {
  findTeachingSlotConflicts,
  isValidSlotTime,
  isValidSlotTimeWindow,
  slotAppliesOnDate,
  type TeachingSlotConflictCandidate,
} from "@/lib/academic/teaching-slot";

test("validates strict HH:MM slot windows", () => {
  assert.equal(isValidSlotTime("07:00"), true);
  assert.equal(isValidSlotTime("23:59"), true);
  assert.equal(isValidSlotTime("7:00"), false);
  assert.equal(isValidSlotTime("24:00"), false);
  assert.equal(isValidSlotTime("07:60"), false);
  assert.equal(isValidSlotTime(""), false);
  assert.equal(isValidSlotTimeWindow("07:00", "08:00"), true);
  assert.equal(isValidSlotTimeWindow("08:00", "08:00"), false);
  assert.equal(isValidSlotTimeWindow("08:00", "07:00"), false);
  assert.equal(isValidSlotTimeWindow("07:00", "nope"), false);
});

test("slot applies only while the assignment is active and covers the date", () => {
  const base = { date: "2026-09-15", startsOn: "2026-09-01", endsOn: null };
  assert.equal(slotAppliesOnDate({ ...base, assignmentStatus: "active" }), true);
  assert.equal(slotAppliesOnDate({ ...base, assignmentStatus: "planned" }), false);
  assert.equal(slotAppliesOnDate({ ...base, assignmentStatus: "ended" }), false);
  assert.equal(slotAppliesOnDate({ ...base, assignmentStatus: "cancelled" }), false);
  // startsOn is inclusive...
  assert.equal(
    slotAppliesOnDate({ date: "2026-09-01", assignmentStatus: "active", startsOn: "2026-09-01", endsOn: null }),
    true,
  );
  // ...endsOn is exclusive...
  assert.equal(
    slotAppliesOnDate({ date: "2026-12-20", assignmentStatus: "active", startsOn: "2026-09-01", endsOn: "2026-12-20" }),
    false,
  );
  assert.equal(
    slotAppliesOnDate({ date: "2026-12-19", assignmentStatus: "active", startsOn: "2026-09-01", endsOn: "2026-12-20" }),
    true,
  );
  // ...before startsOn does not apply, and malformed dates fail closed.
  assert.equal(
    slotAppliesOnDate({ date: "2026-08-31", assignmentStatus: "active", startsOn: "2026-09-01", endsOn: null }),
    false,
  );
  assert.equal(
    slotAppliesOnDate({ date: "2026-09-15", assignmentStatus: "active", startsOn: "2026-09-01", endsOn: "20 juni" }),
    false,
  );
});

const input = {
  tenantId: "tenant-1",
  semester: "odd",
  dayOfWeek: "monday",
  startTime: "07:00",
  endTime: "08:30",
  teacherProfileId: "teacher-1",
  classGroupId: "class-1",
} as const;

function candidate(overrides: Partial<TeachingSlotConflictCandidate>): TeachingSlotConflictCandidate {
  return {
    id: "slot-x",
    teachingAssignmentId: "assignment-x",
    teacherProfileId: "teacher-2",
    classGroupId: "class-2",
    semester: "odd",
    dayOfWeek: "monday",
    startTime: "07:30",
    endTime: "09:00",
    ...overrides,
  };
}

test("rejects teacher double-booking on overlapping windows", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ teacherProfileId: "teacher-1", classGroupId: "class-2" }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, "teacher");
  assert.equal(conflicts[0].slotId, "slot-x");
});

test("rejects class-group double-booking on partially overlapping windows", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ teacherProfileId: "teacher-2", classGroupId: "class-1", startTime: "08:00", endTime: "08:15" }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, "class-group");
});

test("exactly touching windows are not conflicts", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ teacherProfileId: "teacher-1", startTime: "08:30", endTime: "09:30" }),
    candidate({ id: "slot-y", teacherProfileId: "teacher-1", startTime: "06:00", endTime: "07:00" }),
  ]);
  assert.deepEqual(conflicts, []);
});

test("same teacher and class-group on another semester or day is not a conflict", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ teacherProfileId: "teacher-1", classGroupId: "class-1", semester: "even" }),
    candidate({ teacherProfileId: "teacher-1", classGroupId: "class-1", dayOfWeek: "tuesday" }),
  ]);
  assert.deepEqual(conflicts, []);
});

test("editing a slot excludes it from its own conflict check", () => {
  const conflicts = findTeachingSlotConflicts(
    { ...input, excludeSlotId: "slot-x" },
    [candidate({ teacherProfileId: "teacher-1", classGroupId: "class-1" })],
  );
  assert.deepEqual(conflicts, []);
});

test("an identical duplicate window yields both teacher and class-group conflicts", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ teacherProfileId: "teacher-1", classGroupId: "class-1" }),
  ]);
  assert.equal(conflicts.length, 2);
  assert.deepEqual(
    conflicts.map((conflict) => conflict.kind).sort(),
    ["class-group", "teacher"],
  );
});

test("invalid input window fails closed with an error", () => {
  assert.throws(() => findTeachingSlotConflicts({ ...input, startTime: "09:00", endTime: "08:00" }, []));
  assert.throws(() => findTeachingSlotConflicts({ ...input, startTime: "7:00", endTime: "09:00" }, []));
});

test("candidates with malformed stored times are skipped, not crashes", () => {
  const conflicts = findTeachingSlotConflicts(input, [
    candidate({ startTime: "bad", endTime: "worse", teacherProfileId: "teacher-1" }),
  ]);
  assert.deepEqual(conflicts, []);
});
