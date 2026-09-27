/**
 * Pure domain rules for Teaching Slots (Slot Jadwal) — no database access.
 * Storage wiring lands with slice 04 (CRUD Jadwal Mengajar).
 *
 * Canonical terms (CONTEXT.md): Jadwal Mengajar = the set of weekly slots of
 * one class group for one academic year (+ semester); Slot Jadwal = one
 * recurring meeting bound to one active Teaching Assignment.
 *
 * Binding decisions (wayfinder ticket 03):
 * - explicit "HH:MM" times, like school_schedule_day;
 * - a slot applies on date d only while its assignment is `active` and
 *   covers d (startsOn <= d < endsOn or NULL);
 * - teacher double-booking AND class-group double-booking are both hard
 *   rejections, scoped by academic year + semester via the caller;
 * - overlap is a range intersection, not an exact match; editing excludes
 *   the slot being edited.
 */

export type TeachingSlotDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** DB enum academicSemester_kind: odd = ganjil, even = genap. */
export type TeachingSlotSemester = "odd" | "even";

export type TeachingAssignmentStatus = "planned" | "active" | "ended" | "cancelled";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Strict "HH:MM" validation (no "7:00", no "24:00"). */
export function isValidSlotTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** A slot window is valid only when both bounds are valid and strictly ordered. */
export function isValidSlotTimeWindow(startTime: string, endTime: string): boolean {
  if (!isValidSlotTime(startTime) || !isValidSlotTime(endTime)) return false;
  return endTime > startTime;
}

function toMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export type SlotAppliesOnDateInput = Readonly<{
  date: string; // civil date "YYYY-MM-DD"
  assignmentStatus: TeachingAssignmentStatus;
  startsOn: string; // civil date "YYYY-MM-DD"
  endsOn: string | null; // exclusive upper bound; null = open-ended
}>;

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A slot applies on date d only while its teaching assignment is `active`
 * and covers d: startsOn <= d < endsOn (endsOn null = still open).
 * Malformed civil dates fail closed (slot does not apply).
 */
export function slotAppliesOnDate(input: SlotAppliesOnDateInput): boolean {
  const { date, assignmentStatus, startsOn, endsOn } = input;
  if (assignmentStatus !== "active") return false;
  if (!CIVIL_DATE_PATTERN.test(date) || !CIVIL_DATE_PATTERN.test(startsOn)) return false;
  if (endsOn !== null && !CIVIL_DATE_PATTERN.test(endsOn)) return false;
  if (date < startsOn) return false;
  if (endsOn !== null && date >= endsOn) return false;
  return true;
}

/** One existing slot (already joined with its assignment) fed to the validator. */
export type TeachingSlotConflictCandidate = Readonly<{
  id: string;
  teachingAssignmentId: string;
  teacherProfileId: string;
  classGroupId: string;
  semester: TeachingSlotSemester;
  dayOfWeek: TeachingSlotDayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}>;

export type TeachingSlotConflictInput = Readonly<{
  tenantId: string;
  semester: TeachingSlotSemester;
  dayOfWeek: TeachingSlotDayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  teacherProfileId: string;
  classGroupId: string;
  /** Slot being edited — excluded from the check so it cannot conflict with itself. */
  excludeSlotId?: string;
}>;

export type TeachingSlotConflict = Readonly<{
  /** teacher = Guru dobel (same teacher, different class group); class-group = Rombel dobel. */
  kind: "teacher" | "class-group";
  slotId: string;
  teachingAssignmentId: string;
  teacherProfileId: string;
  classGroupId: string;
  dayOfWeek: TeachingSlotDayOfWeek;
  startTime: string;
  endTime: string;
}>;

/**
 * Detect teacher and class-group double-bookings against existing slots.
 * Pure: the caller supplies the candidate set (same tenant, academic year
 * inferred by the caller through each assignment). Overlap = half-open range
 * intersection [start, end); exactly touching windows are NOT conflicts.
 */
export function findTeachingSlotConflicts(
  input: TeachingSlotConflictInput,
  candidates: readonly TeachingSlotConflictCandidate[],
): readonly TeachingSlotConflict[] {
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (start === null || end === null || !isValidSlotTimeWindow(input.startTime, input.endTime)) {
    throw new Error("invalid-slot-window");
  }
  const conflicts: TeachingSlotConflict[] = [];
  for (const candidate of candidates) {
    if (input.excludeSlotId !== undefined && candidate.id === input.excludeSlotId) continue;
    if (candidate.semester !== input.semester) continue;
    if (candidate.dayOfWeek !== input.dayOfWeek) continue;
    const candidateStart = toMinutes(candidate.startTime);
    const candidateEnd = toMinutes(candidate.endTime);
    if (candidateStart === null || candidateEnd === null) continue;
    const overlaps = start < candidateEnd && candidateStart < end;
    if (!overlaps) continue;
    if (candidate.teacherProfileId === input.teacherProfileId) {
      conflicts.push({
        kind: "teacher",
        slotId: candidate.id,
        teachingAssignmentId: candidate.teachingAssignmentId,
        teacherProfileId: candidate.teacherProfileId,
        classGroupId: candidate.classGroupId,
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      });
    }
    if (candidate.classGroupId === input.classGroupId) {
      conflicts.push({
        kind: "class-group",
        slotId: candidate.id,
        teachingAssignmentId: candidate.teachingAssignmentId,
        teacherProfileId: candidate.teacherProfileId,
        classGroupId: candidate.classGroupId,
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      });
    }
  }
  return conflicts;
}
