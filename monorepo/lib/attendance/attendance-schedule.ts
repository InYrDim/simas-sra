/**
 * Pure, framework-agnostic layer for the Gerbang (gate) school schedule.
 *
 * The schedule models the school's planned day: per weekday, whether the day is
 * effective and what the arrival (masuk) and departure (pulang) times are, plus
 * holiday date ranges that suppress the schedule entirely.
 *
 * This module owns the decision logic shared by the schedule worker
 * (auto-open/close of the daily Gerbang session) and the settings UI. It has no
 * dependency on the database, Next.js, or the request scope, so it stays
 * trivially unit-testable.
 */

export const SCHOOL_SCHEDULE_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type SchoolScheduleDayOfWeek = (typeof SCHOOL_SCHEDULE_DAYS)[number];

/** A configured weekday row as consumed by the decision function. */
export type SchoolScheduleDayInput = {
    dayOfWeek: SchoolScheduleDayOfWeek;
    /** "HH:MM" planned arrival (masuk) time. */
    startTime: string;
    /** "HH:MM" planned departure (pulang) time. */
    endTime: string;
    /** When false, the weekday is non-effective (no session that weekday). */
    effective: boolean;
};

/** A holiday range as consumed by the decision function. */
export type SchoolHolidayInput = {
    /** Inclusive civil start date, "YYYY-MM-DD". */
    startDate: string;
    /** Inclusive civil end date, "YYYY-MM-DD". */
    endDate: string;
};

/** Maps a JS Date getDay() index (0=Sunday) to the schedule vocabulary. */
const JS_DAY_TO_SCHEDULE_DAY: readonly SchoolScheduleDayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];

/** "YYYY-MM-DD" civil date for `date` observed in `timeZone` (local to the tenant). */
export function civilDateInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/**
 * Weekday of a civil date ("YYYY-MM-DD"). Interpreted as a UTC calendar date so
 * the answer never shifts across timezones.
 */
export function dayOfWeekForCivilDate(civilDate: string): SchoolScheduleDayOfWeek | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(civilDate)) return null;
    const [year, month, day] = civilDate.split("-").map(Number);
    const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return JS_DAY_TO_SCHEDULE_DAY[jsDay] ?? null;
}

/** True when `civilDate` falls inside any holiday range (inclusive bounds). */
export function isHoliday(civilDate: string, holidays: readonly SchoolHolidayInput[]): boolean {
    return holidays.some((holiday) => civilDate >= holiday.startDate && civilDate <= holiday.endDate);
}

/**
 * The worker's daily decision for one tenant:
 * - `none` — no session should exist today (holiday, non-effective weekday, or
 *   the schedule is not configured for that weekday).
 * - `session` — the planned Gerbang window for today; `phase` says whether the
 *   current local time is before the window ("open" is not yet due), during it
 *   (auto-open is due), or after it (auto-close is due).
 */
export type GerbangScheduleDecision =
    | { kind: "none"; reason: "unconfigured" | "non-effective" | "holiday" }
    | {
        kind: "session";
        dayOfWeek: SchoolScheduleDayOfWeek;
        startTime: string;
        endTime: string;
        phase: "before" | "during" | "after";
    };

/** Matches "HH:MM" with hours 00–23 and minutes 00–59. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isScheduleTime(value: unknown): value is string {
    return typeof value === "string" && TIME_PATTERN.test(value);
}

/**
 * Decides the Gerbang schedule outcome for a tenant on `civilDate` at local
 * time `nowHHMM`. Pure: the caller resolves the configured rows and passes them
 * in; nothing is read or written here.
 */
export function resolveGerbangScheduleDecision(input: {
    civilDate: string;
    nowHHMM: string;
    scheduleDays: readonly SchoolScheduleDayInput[];
    holidays: readonly SchoolHolidayInput[];
}): GerbangScheduleDecision {
    const dayOfWeek = dayOfWeekForCivilDate(input.civilDate);
    if (!dayOfWeek) return { kind: "none", reason: "unconfigured" };
    if (isHoliday(input.civilDate, input.holidays)) return { kind: "none", reason: "holiday" };

    const day = input.scheduleDays.find((row) => row.dayOfWeek === dayOfWeek);
    if (!day || !day.effective) return { kind: "none", reason: "non-effective" };
    if (!isScheduleTime(day.startTime) || !isScheduleTime(day.endTime) || day.endTime <= day.startTime) {
        return { kind: "none", reason: "non-effective" };
    }

    const now = input.nowHHMM;
    const phase = now < day.startTime ? "before" : now <= day.endTime ? "during" : "after";
    return { kind: "session", dayOfWeek, startTime: day.startTime, endTime: day.endTime, phase };
}

/**
 * Default schedule rows for a tenant that has not configured any weekday yet:
 * Monday–Friday 07:00–13:00, Saturday/Sunday non-effective.
 */
export function defaultSchoolScheduleDays(): SchoolScheduleDayInput[] {
    return SCHOOL_SCHEDULE_DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        startTime: "07:00",
        endTime: "13:00",
        effective: dayOfWeek !== "saturday" && dayOfWeek !== "sunday",
    }));
}
