import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { attendanceSession, schoolHoliday, schoolScheduleDay, tenant } from "@/db/schema";
import {
    SCHOOL_SCHEDULE_DAYS,
    type SchoolHolidayInput,
    type SchoolScheduleDayInput,
    type SchoolScheduleDayOfWeek,
} from "@/lib/attendance/attendance-schedule";

/**
 * Server-only data layer for the Gerbang school schedule.
 *
 * Pure decision logic lives in `attendance-schedule.ts`; this module owns the
 * persistence and the schedule-backed session transitions used by the worker
 * (`openGerbangSessionForDay` / `closeGerbangSessionForDay`). Manual session
 * management stays in `attendance-record-write.ts`.
 */

const DAY_TO_ENUM: Record<SchoolScheduleDayOfWeek, (typeof SCHOOL_SCHEDULE_DAYS)[number]> = {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
};

/** Upserts one weekday row for a tenant (used by settings save and Excel import). */
export async function saveSchoolScheduleDay(
    tenantId: string,
    day: SchoolScheduleDayInput,
    now = new Date(),
): Promise<void> {
    await db
        .insert(schoolScheduleDay)
        .values({
            id: crypto.randomUUID(),
            tenantId,
            dayOfWeek: DAY_TO_ENUM[day.dayOfWeek],
            startTime: day.startTime,
            endTime: day.endTime,
            effective: day.effective,
            version: 1,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [schoolScheduleDay.tenantId, schoolScheduleDay.dayOfWeek],
            set: { startTime: day.startTime, endTime: day.endTime, effective: day.effective, updatedAt: now },
        });
}

/** Reads all configured weekday rows for a tenant. */
export async function listSchoolScheduleDays(tenantId: string): Promise<SchoolScheduleDayInput[]> {
    const rows = await db
        .select({
            dayOfWeek: schoolScheduleDay.dayOfWeek,
            startTime: schoolScheduleDay.startTime,
            endTime: schoolScheduleDay.endTime,
            effective: schoolScheduleDay.effective,
        })
        .from(schoolScheduleDay)
        .where(eq(schoolScheduleDay.tenantId, tenantId));

    const order = new Map(SCHOOL_SCHEDULE_DAYS.map((day, index) => [day, index]));
    return rows
        .map((row) => ({
            dayOfWeek: row.dayOfWeek as SchoolScheduleDayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            effective: row.effective,
        }))
        .sort((left, right) => (order.get(left.dayOfWeek) ?? 0) - (order.get(right.dayOfWeek) ?? 0));
}

/** Replaces every holiday row for a tenant with the given list (settings save). */
export async function saveSchoolHolidays(
    tenantId: string,
    holidays: Array<SchoolHolidayInput & { name: string }>,
    now = new Date(),
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx.delete(schoolHoliday).where(eq(schoolHoliday.tenantId, tenantId));
        if (holidays.length === 0) return;
        await tx.insert(schoolHoliday).values(
            holidays.map((holiday) => ({
                id: crypto.randomUUID(),
                tenantId,
                name: holiday.name,
                startDate: holiday.startDate,
                endDate: holiday.endDate,
                version: 1,
                createdAt: now,
                updatedAt: now,
            })),
        );
    });
}

/** Reads all holiday ranges for a tenant. */
export async function listSchoolHolidays(tenantId: string): Promise<Array<SchoolHolidayInput & { name: string }>> {
    const rows = await db
        .select({
            name: schoolHoliday.name,
            startDate: schoolHoliday.startDate,
            endDate: schoolHoliday.endDate,
        })
        .from(schoolHoliday)
        .where(eq(schoolHoliday.tenantId, tenantId));
    return rows.map((row) => ({ name: row.name, startDate: row.startDate, endDate: row.endDate }));
}

/**
 * True when the tenant has an enabled Gerbang layer AND the schedule feature is
 * active. The schedule capability is universal (it follows `absensiGerbang`),
 * so this is the only gate the worker needs.
 */
export async function tenantHasGerbangSchedule(tenantId: string): Promise<boolean> {
    const [row] = await db
        .select({ settings: tenant.settings })
        .from(tenant)
        .where(eq(tenant.id, tenantId))
        .limit(1);
    if (!row) return false;
    const features = (row.settings as Record<string, unknown> | null)?.features;
    if (features && typeof features === "object" && Object.prototype.hasOwnProperty.call(features, "absensiGerbang")) {
        return (features as Record<string, unknown>).absensiGerbang === true;
    }
    // Legacy default: tenants that never saved an absensi flag keep Gerbang access.
    return true;
}

/** Lists tenant ids known to the worker scan (paginated by the caller via limit/offset). */
export async function listTenantIdsWithSchedule(limit = 100, offset = 0): Promise<string[]> {
    const rows = await db
        .select({ tenantId: schoolScheduleDay.tenantId })
        .from(schoolScheduleDay)
        .groupBy(schoolScheduleDay.tenantId)
        .orderBy(schoolScheduleDay.tenantId)
        .limit(limit)
        .offset(offset);
    return rows.map((row) => row.tenantId);
}

/**
 * Opens the Gerbang session for a tenant/day with the schedule-provided window
 * (source = "schedule", no human actor). Idempotent: when any session already
 * exists for the day, nothing is written and `created` is false.
 */
export async function openGerbangSessionForDay(input: {
    tenantId: string;
    sessionDate: string;
    plannedStart: string;
    plannedEnd: string;
    openedAt: Date;
}): Promise<{ created: boolean; sessionId?: string }> {
    const existing = await db
        .select({ id: attendanceSession.id })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, input.tenantId),
                eq(attendanceSession.layer, "gerbang"),
                eq(attendanceSession.sessionDate, input.sessionDate),
            ),
        )
        .limit(1);
    if (existing.length > 0) return { created: false };

    const id = crypto.randomUUID();
    try {
        await db.insert(attendanceSession).values({
            id,
            tenantId: input.tenantId,
            layer: "gerbang",
            sessionDate: input.sessionDate,
            plannedStart: input.plannedStart,
            plannedEnd: input.plannedEnd,
            openedAt: input.openedAt,
            status: "open",
            source: "schedule",
            openedByUserId: null,
            version: 1,
            createdAt: input.openedAt,
            updatedAt: input.openedAt,
        });
        return { created: true, sessionId: id };
    } catch {
        // Race with a concurrent opener (unique constraint) — treat as already open.
        return { created: false };
    }
}

/**
 * Closes the open Gerbang session for a tenant/day (worker path). Returns
 * "closed" when a session transitioned now, "already-closed" when no open
 * session exists, "not-found" when the day has no session at all.
 */
export async function closeGerbangSessionForDay(
    tenantId: string,
    sessionDate: string,
    closedAt: Date,
): Promise<"closed" | "already-closed" | "not-found"> {
    const result = await db
        .update(attendanceSession)
        .set({ status: "closed", closedAt, updatedAt: closedAt })
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, "gerbang"),
                eq(attendanceSession.sessionDate, sessionDate),
                eq(attendanceSession.status, "open"),
            ),
        );
    if ((result.rowCount ?? 0) > 0) return "closed";
    const [any] = await db
        .select({ id: attendanceSession.id })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, "gerbang"),
                eq(attendanceSession.sessionDate, sessionDate),
            ),
        )
        .limit(1);
    return any ? "already-closed" : "not-found";
}
