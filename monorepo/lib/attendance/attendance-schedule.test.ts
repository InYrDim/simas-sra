import assert from "node:assert/strict";
import { test } from "node:test";

import {
    SCHOOL_SCHEDULE_DAYS,
    civilDateInTimeZone,
    dayOfWeekForCivilDate,
    defaultSchoolScheduleDays,
    isHoliday,
    isScheduleTime,
    resolveGerbangScheduleDecision,
    type GerbangScheduleDecision,
} from "@/lib/attendance/attendance-schedule";

const scheduleDays = [
    { dayOfWeek: "monday", startTime: "07:00", endTime: "13:00", effective: true },
    { dayOfWeek: "tuesday", startTime: "07:00", endTime: "13:00", effective: true },
    { dayOfWeek: "wednesday", startTime: "07:00", endTime: "12:30", effective: true },
    { dayOfWeek: "thursday", startTime: "07:00", endTime: "13:00", effective: true },
    { dayOfWeek: "friday", startTime: "07:00", endTime: "11:00", effective: true },
    { dayOfWeek: "saturday", startTime: "07:00", endTime: "12:00", effective: false },
    { dayOfWeek: "sunday", startTime: "07:00", endTime: "12:00", effective: false },
] as const;

const base = {
    scheduleDays,
    holidays: [] as Array<{ startDate: string; endDate: string }>,
};

test("school schedule exposes the full weekday vocabulary", () => {
    assert.deepEqual([...SCHOOL_SCHEDULE_DAYS], ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
});

test("dayOfWeekForCivilDate maps civil dates to schedule weekdays", () => {
    // 2026-09-21 is a Monday, 2026-09-27 is a Sunday.
    assert.equal(dayOfWeekForCivilDate("2026-09-21"), "monday");
    assert.equal(dayOfWeekForCivilDate("2026-09-26"), "saturday");
    assert.equal(dayOfWeekForCivilDate("2026-09-27"), "sunday");
    assert.equal(dayOfWeekForCivilDate("not-a-date"), null);
});

test("civilDateInTimeZone renders the tenant-local civil date", () => {
    // 2026-09-24T20:00Z is 2026-09-25 03:00 in Jakarta (UTC+7) but 2026-09-24 in UTC.
    const instant = new Date("2026-09-24T20:00:00Z");
    assert.equal(civilDateInTimeZone(instant, "Asia/Jakarta"), "2026-09-25");
    assert.equal(civilDateInTimeZone(instant, "UTC"), "2026-09-24");
});

test("isHoliday treats holiday ranges as inclusive", () => {
    const holidays = [{ startDate: "2026-12-24", endDate: "2026-12-26" }];
    assert.equal(isHoliday("2026-12-23", holidays), false);
    assert.equal(isHoliday("2026-12-24", holidays), true);
    assert.equal(isHoliday("2026-12-25", holidays), true);
    assert.equal(isHoliday("2026-12-26", holidays), true);
    assert.equal(isHoliday("2026-12-27", holidays), false);
});

test("isScheduleTime accepts only strict HH:MM values", () => {
    assert.equal(isScheduleTime("07:00"), true);
    assert.equal(isScheduleTime("23:59"), true);
    assert.equal(isScheduleTime("24:00"), false);
    assert.equal(isScheduleTime("7:00"), false);
    assert.equal(isScheduleTime("07:60"), false);
    assert.equal(isScheduleTime(""), false);
    assert.equal(isScheduleTime(null), false);
});

test("schedule decision opens during the window on an effective day", () => {
    const decision = resolveGerbangScheduleDecision({ ...base, civilDate: "2026-09-21", nowHHMM: "08:00" });
    assert.deepEqual(decision, { kind: "session", dayOfWeek: "monday", startTime: "07:00", endTime: "13:00", phase: "during" });
});

test("schedule decision phases: before, during, after the window", () => {
    const phaseOf = (nowHHMM: string): GerbangScheduleDecision extends { phase: infer P } ? P : string | undefined => {
        const decision = resolveGerbangScheduleDecision({ ...base, civilDate: "2026-09-21", nowHHMM });
        return decision.kind === "session" ? decision.phase : undefined;
    };
    assert.equal(phaseOf("06:59"), "before");
    assert.equal(phaseOf("07:00"), "during");
    assert.equal(phaseOf("13:00"), "during");
    assert.equal(phaseOf("13:01"), "after");
});

test("schedule decision is none on non-effective weekdays", () => {
    const decision = resolveGerbangScheduleDecision({ ...base, civilDate: "2026-09-26", nowHHMM: "08:00" });
    assert.deepEqual(decision, { kind: "none", reason: "non-effective" });
});

test("schedule decision is none on holidays even for effective weekdays", () => {
    const decision = resolveGerbangScheduleDecision({
        ...base,
        civilDate: "2026-09-21",
        nowHHMM: "08:00",
        holidays: [{ startDate: "2026-09-20", endDate: "2026-09-22" }],
    });
    assert.deepEqual(decision, { kind: "none", reason: "holiday" });
});

test("schedule decision is none when the weekday is unconfigured", () => {
    const decision = resolveGerbangScheduleDecision({
        civilDate: "2026-09-21",
        nowHHMM: "08:00",
        scheduleDays: scheduleDays.filter((day) => day.dayOfWeek !== "monday"),
        holidays: [],
    });
    // A missing row for the weekday is treated as non-effective: the schedule
    // exists, but that weekday has no configured session window.
    assert.deepEqual(decision, { kind: "none", reason: "non-effective" });
});

test("schedule decision is none when the configured window is invalid", () => {
    const decision = resolveGerbangScheduleDecision({
        civilDate: "2026-09-21",
        nowHHMM: "08:00",
        scheduleDays: [{ dayOfWeek: "monday", startTime: "13:00", endTime: "07:00", effective: true }],
        holidays: [],
    });
    assert.deepEqual(decision, { kind: "none", reason: "non-effective" });
});

test("default schedule covers monday to friday and skips the weekend", () => {
    const defaults = defaultSchoolScheduleDays();
    assert.equal(defaults.length, 7);
    const effective = defaults.filter((day) => day.effective).map((day) => day.dayOfWeek);
    assert.deepEqual(effective, ["monday", "tuesday", "wednesday", "thursday", "friday"]);
    for (const day of defaults) {
        assert.ok(day.endTime > day.startTime);
    }
});
