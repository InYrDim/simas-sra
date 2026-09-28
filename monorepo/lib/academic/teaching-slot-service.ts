import { randomUUID } from "node:crypto";

import {
  findTeachingSlotConflicts,
  isValidSlotTimeWindow,
  type TeachingSlotConflict,
  type TeachingSlotDayOfWeek,
  type TeachingSlotSemester,
} from "@/lib/academic/teaching-slot";

/**
 * Write service for Teaching Slots (Slot Jadwal) and lesson-period presets.
 * Persistence is injected, so the wayfinder-03 rules (teacher/class-group
 * double-booking rejection, assignment binding) stay testable without a DB.
 */

export type TeachingSlotRecord = {
  id: string;
  tenantId: string;
  teachingAssignmentId: string;
  dayOfWeek: TeachingSlotDayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  semester: TeachingSlotSemester;
  version: number;
};

export type TeachingPeriodRecord = {
  id: string;
  tenantId: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  version: number;
};

/** Assignment facts the service needs to resolve conflicts and validate the semester. */
export type TeachingSlotAssignmentFacts = Readonly<{
  id: string;
  teacherProfileId: string;
  classGroupId: string;
  academicYearId: string;
  status: "planned" | "active" | "ended" | "cancelled";
}>;

export type TeachingSlotServiceStore = {
  /** Load assignment facts for the given ids (tenant-scoped; missing ids are omitted). */
  assignmentsById(tenantId: string, ids: readonly string[]): Promise<Map<string, TeachingSlotAssignmentFacts>>;
  /** Load sibling slots (tenant + academic year scope) joined with their assignment. */
  slotsInAcademicYear(
    tenantId: string,
    academicYearId: string,
  ): Promise<readonly (TeachingSlotRecord & { teacherProfileId: string; classGroupId: string })[]>;
  /** Booking counters for the delete guard: slotId -> number of bound sessions. */
  sessionCountsBySlotId(tenantId: string, slotIds: readonly string[]): Promise<Map<string, number>>;
  /** The active academic_semester kind for the year, or null when none is active. */
  activeSemester(tenantId: string, academicYearId: string): Promise<TeachingSlotSemester | null>;
  insertSlot(tenantId: string, value: TeachingSlotRecord): Promise<void>;
  /** Returns false when the row disappeared or the version did not match. */
  updateSlot(tenantId: string, value: TeachingSlotRecord, expectedVersion: number): Promise<boolean>;
  /** Returns false when the row disappeared. */
  deleteSlot(tenantId: string, id: string): Promise<boolean>;
  listPeriods(tenantId: string): Promise<readonly TeachingPeriodRecord[]>;
  insertPeriod(tenantId: string, value: TeachingPeriodRecord): Promise<void>;
  deletePeriod(tenantId: string, id: string): Promise<boolean>;
};

export type TeachingSlotFailure =
  | "invalid-input"
  | "not-found"
  | "assignment-not-active"
  | "semester-mismatch"
  | "conflict"
  | "slot-in-use"
  | "version-conflict";

export type TeachingSlotWriteResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: TeachingSlotFailure; conflicts?: readonly TeachingSlotConflict[] };

const DAYS: readonly TeachingSlotDayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SEMESTERS: readonly TeachingSlotSemester[] = ["odd", "even"];
const failure = <T>(code: TeachingSlotFailure, conflicts?: readonly TeachingSlotConflict[]) =>
  ({ ok: false as const, code, ...(conflicts ? { conflicts } : {}) }) satisfies TeachingSlotWriteResult<T>;

function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseCreateInput(raw: {
  tenantId: string;
  actorUserId: string;
  teachingAssignmentId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: string;
}) {
  if (!raw.teachingAssignmentId) return null;
  const dayOfWeek = DAYS.find((day) => day === raw.dayOfWeek);
  const semester = SEMESTERS.find((candidate) => candidate === raw.semester);
  if (!dayOfWeek || !semester) return null;
  if (!isValidSlotTimeWindow(raw.startTime, raw.endTime)) return null;
  return { ...raw, dayOfWeek, semester };
}

/**
 * Resolves the semester mismatch rule (wayfinder 03): when the tenant has an
 * active academic_semester row for the assignment's academic year, the slot
 * flag must match it. Without an active semester row the flag is accepted
 * as-is (small schools may not maintain semester rows yet).
 */
export function semesterMatchesActiveAcademicSemester(
  slotSemester: TeachingSlotSemester,
  activeAcademicSemester: TeachingSlotSemester | null,
): boolean {
  return activeAcademicSemester === null || slotSemester === activeAcademicSemester;
}

export function createTeachingSlotService(dependencies: { store: TeachingSlotServiceStore }) {
  const { store } = dependencies;

  async function validateBinding(raw: {
    tenantId: string;
    teachingAssignmentId: string;
    semester: TeachingSlotSemester;
    slotId?: string;
    expectedVersion?: number;
    dayOfWeek: TeachingSlotDayOfWeek;
    startTime: string;
    endTime: string;
    actorUserId: string;
  }) {
    const assignments = await store.assignmentsById(raw.tenantId, [raw.teachingAssignmentId]);
    const assignment = assignments.get(raw.teachingAssignmentId);
    if (!assignment) return failure("not-found");
    if (assignment.status !== "active") return failure("assignment-not-active");

    const academicYearId = assignment.academicYearId;
    // Wayfinder 03: the semester flag must match the tenant's active
    // academic_semester for the assignment's academic year (when one exists).
    const activeSemester = await store.activeSemester(raw.tenantId, academicYearId);
    if (!semesterMatchesActiveAcademicSemester(raw.semester, activeSemester)) return failure("semester-mismatch");
    const siblings = await store.slotsInAcademicYear(raw.tenantId, academicYearId);
    const candidates = siblings.filter((slot) => slot.id !== raw.slotId);
    const conflicts = findTeachingSlotConflicts(
      {
        tenantId: raw.tenantId,
        semester: raw.semester,
        dayOfWeek: raw.dayOfWeek,
        startTime: raw.startTime,
        endTime: raw.endTime,
        // The new binding derives teacher/class-group from the assignment...
        teacherProfileId: assignment.teacherProfileId,
        classGroupId: assignment.classGroupId,
        ...(raw.slotId !== undefined ? { excludeSlotId: raw.slotId } : {}),
      },
      // ...while candidates keep the teacher/class-group of their own assignment.
      candidates,
    );
    if (conflicts.length > 0) return failure("conflict", conflicts);
    return { ok: true as const, academicYearId, siblings };
  }

  return {
    async createSlot(raw: {
      tenantId: string;
      actorUserId: string;
      teachingAssignmentId: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      semester: string;
    }): Promise<TeachingSlotWriteResult<TeachingSlotRecord>> {
      const input = parseCreateInput(raw);
      if (!input) return failure("invalid-input");

      const binding = await validateBinding({ ...input, slotId: undefined });
      if (!binding.ok) return binding;

      const value: TeachingSlotRecord = {
        id: randomUUID(),
        tenantId: input.tenantId,
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        semester: input.semester,
        version: 1,
      };
      await store.insertSlot(input.tenantId, value);
      return { ok: true, value };
    },

    async updateSlot(raw: {
      tenantId: string;
      actorUserId: string;
      slotId: string;
      expectedVersion: number;
      teachingAssignmentId: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      semester: string;
    }): Promise<TeachingSlotWriteResult<TeachingSlotRecord>> {
      if (!raw.slotId || !Number.isInteger(raw.expectedVersion) || raw.expectedVersion < 1) return failure("invalid-input");
      const input = parseCreateInput(raw);
      if (!input) return failure("invalid-input");

      const binding = await validateBinding({ ...input, slotId: raw.slotId, expectedVersion: raw.expectedVersion });
      if (!binding.ok) return binding;

      const existing = binding.siblings.find((slot) => slot.id === raw.slotId);
      if (!existing) return failure("not-found");

      const value: TeachingSlotRecord = {
        id: raw.slotId,
        tenantId: raw.tenantId,
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        semester: input.semester,
        version: raw.expectedVersion + 1,
      };
      const updated = await store.updateSlot(raw.tenantId, value, raw.expectedVersion);
      if (!updated) return failure("version-conflict");
      return { ok: true, value };
    },

    /**
     * Wayfinder tickets 04 + 05: a slot that already has attendance sessions is
     * blocked from deletion — the store counts real per-slot session rows
     * (attendance_session.slot_id), so admin edits the slot times or deletes
     * the sessions through the separate history flow first.
     */
    async deleteSlot(raw: { tenantId: string; actorUserId: string; slotId: string }): Promise<TeachingSlotWriteResult> {
      if (!raw.slotId) return failure("invalid-input");
      const counts = await store.sessionCountsBySlotId(raw.tenantId, [raw.slotId]);
      if ((counts.get(raw.slotId) ?? 0) > 0) return failure("slot-in-use");
      const deleted = await store.deleteSlot(raw.tenantId, raw.slotId);
      if (!deleted) return failure("not-found");
      return { ok: true, value: undefined };
    },

    async listPeriods(tenantId: string) {
      return store.listPeriods(tenantId);
    },

    async createPeriod(raw: { tenantId: string; label: string; startTime: string; endTime: string; sortOrder: number }): Promise<TeachingSlotWriteResult<TeachingPeriodRecord>> {
      const label = cleanLabel(raw.label);
      if (!label || label.length > 100) return failure("invalid-input");
      if (!Number.isInteger(raw.sortOrder) || raw.sortOrder < 1) return failure("invalid-input");
      if (!isValidSlotTimeWindow(raw.startTime, raw.endTime)) return failure("invalid-input");
      const value: TeachingPeriodRecord = {
        id: randomUUID(),
        tenantId: raw.tenantId,
        label,
        startTime: raw.startTime,
        endTime: raw.endTime,
        sortOrder: raw.sortOrder,
        version: 1,
      };
      await store.insertPeriod(raw.tenantId, value);
      return { ok: true, value };
    },

    async deletePeriod(raw: { tenantId: string; periodId: string }): Promise<TeachingSlotWriteResult> {
      if (!raw.periodId) return failure("invalid-input");
      const deleted = await store.deletePeriod(raw.tenantId, raw.periodId);
      if (!deleted) return failure("not-found");
      return { ok: true, value: undefined };
    },
  };
}

export type TeachingSlotService = ReturnType<typeof createTeachingSlotService>;
