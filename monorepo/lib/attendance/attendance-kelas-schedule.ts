import { isHoliday, type SchoolHolidayInput } from "@/lib/attendance/attendance-schedule";

/**
 * Pure, framework-agnostic decision layer for Kelas (classroom) sessions per
 * Teaching Slot (wayfinder tickets 03 + 04).
 *
 * A Kelas session is identified by (tenant, slotId, sessionDate). For each
 * effective slot of the day the worker:
 *  - opens the session at the slot's startTime (plannedStart = slot start),
 *  - keeps the window open until plannedEnd = slot end + tolerance minutes,
 *  - closes it when "now" passes plannedEnd (auto-alpa fills unrecorded
 *    students at that moment, see the data layer).
 *
 * No DB, no Next.js: the caller supplies civil date, local time, slots
 * (already joined with their assignment), holidays, and the tolerance.
 */

export type KelasSlotDecisionInput = {
  slotId: string;
  dayOfWeek: string;
  /** "HH:MM" lesson start. */
  startTime: string;
  /** "HH:MM" lesson end. */
  endTime: string;
  /** "odd" | "even" — the slot's semester flag. */
  semester: string;
  /** Assignment binding facts for validity (wayfinder 03). */
  assignmentStatus: "planned" | "active" | "ended" | "cancelled";
  startsOn: string; // civil "YYYY-MM-DD"
  endsOn: string | null; // exclusive
};

export type KelasSlotDecision =
  | { kind: "none"; reason: "assignment-inactive" | "assignment-not-covering-date" }
  | {
      kind: "session";
      slotId: string;
      /** Lesson start "HH:MM" (= plannedStart of the session). */
      startTime: string;
      /** Lesson end + tolerance "HH:MM" (= plannedEnd of the session). */
      plannedEnd: string;
      phase: "before" | "during" | "after";
    };

/** "HH:MM" + minutes -> "HH:MM" (wraps modulo 24h; 23:50 + 15 = 00:05). */
export function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The worker's decision for ONE slot on `civilDate` at local time `nowHHMM`.
 * Holidays are checked by `resolveKelasSlotDecisions` (date-level); this
 * function stays date-agnostic so tests can pin phases precisely.
 */
export function resolveKelasSlotDecision(input: {
  slot: KelasSlotDecisionInput;
  civilDate: string;
  nowHHMM: string;
  toleranceMinutes: number;
}): KelasSlotDecision {
  const { slot } = input;
  if (slot.assignmentStatus !== "active") return { kind: "none", reason: "assignment-inactive" };
  if (input.civilDate < slot.startsOn) return { kind: "none", reason: "assignment-not-covering-date" };
  if (slot.endsOn !== null && input.civilDate >= slot.endsOn) return { kind: "none", reason: "assignment-not-covering-date" };

  const plannedEnd = addMinutesToHHMM(slot.endTime, input.toleranceMinutes);
  const phase = input.nowHHMM < slot.startTime ? "before" : input.nowHHMM <= plannedEnd ? "during" : "after";
  return { kind: "session", slotId: slot.slotId, startTime: slot.startTime, plannedEnd, phase };
}

/**
 * Picks the Kelas session an occurrence at `nowHHMM` belongs to.
 *
 * With sessions per slot a tenant has MANY open sessions per day, so "the"
 * open session is ambiguous. The record belongs to the session whose planned
 * window contains the local time (inclusive bounds); when several overlap the
 * earliest starting window wins (deterministic). Returns null when no window
 * contains the time (e.g. between lessons) — the record stays unlinked.
 */
export function pickKelasSessionByWindow<
  T extends { id: string; plannedStart: string; plannedEnd: string },
>(sessions: readonly T[], nowHHMM: string): T | null {
  const containing = sessions.filter((s) => nowHHMM >= s.plannedStart && nowHHMM <= s.plannedEnd);
  if (containing.length === 0) return null;
  return containing.reduce((best, s) => (s.plannedStart < best.plannedStart ? s : best));
}

/**
 * Expands every applicable slot decision for a tenant-date: holidays suppress
 * everything; each slot is decided independently; day/semester filters belong
 * to the caller's slot query (only today's slots are passed in).
 */
export function resolveKelasSlotDecisions(input: {
  civilDate: string;
  nowHHMM: string;
  slots: readonly KelasSlotDecisionInput[];
  holidays: readonly SchoolHolidayInput[];
  toleranceMinutes: number;
}): KelasSlotDecision[] {
  if (isHoliday(input.civilDate, input.holidays)) return [];
  return input.slots
    .map((slot) => resolveKelasSlotDecision({ slot, civilDate: input.civilDate, nowHHMM: input.nowHHMM, toleranceMinutes: input.toleranceMinutes }))
    .filter((decision): decision is Extract<KelasSlotDecision, { kind: "session" }> => decision.kind === "session");
}
