import { hostname } from "node:os";

import { closeDatabasePool } from "@/db";
import {
    civilDateInTimeZone,
    isHoliday,
    localHHMMInZone,
    resolveGerbangScheduleDecision,
} from "@/lib/attendance/attendance-schedule";
import {
    closeGerbangSessionForDay,
    listSchoolHolidays,
    listSchoolScheduleDays,
    listTenantIdsWithSchedule,
    openGerbangSessionForDay,
    tenantHasGerbangSchedule,
} from "@/lib/attendance/attendance-schedule-data";
import {
    closeKelasSlotSession,
    listEffectiveKelasSlotsForDate,
    listKelasHolidays,
    listTenantIdsWithKelasSlots,
    loadTenantSettingsForKelas,
    openKelasSlotSession,
    readKelasToleranceFromSettings,
    tenantAllowsKelasSessions,
} from "@/lib/attendance/attendance-kelas-data";
import { resolveKelasSlotDecision } from "@/lib/attendance/attendance-kelas-schedule";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";

/**
 * Schedule worker for the Gerbang + Kelas layers (Fase penjadwalan).
 *
 * Run periodically (e.g. every 5 minutes via cron). For every tenant that has
 * a configured schedule and an enabled Gerbang layer it:
 *  - resolves today's civil date and local HH:MM in the tenant timezone,
 *  - applies the pure schedule decision (holiday / non-effective / window),
 *  - opens the daily session (source = "schedule") when the window starts,
 *  - closes the open session when the window ends.
 *
 * Manual sessions are untouched: a session created by an operator for today
 * (any window) satisfies the day, so the worker will neither duplicate nor
 * close it early — only schedule-sourced windows drive the auto-close.
 *
 * Kelas layer (wayfinder 04, per-slot sessions): for every tenant with the
 * `penjadwalan` feature AND an active `absensiKelas` layer, each effective
 * teaching slot of the day opens its own session at the slot's start time and
 * closes it after end + tolerance, auto-filling unrecorded students with
 * `alpa` (system actor) at close time.
 */

async function processTenant(tenantId: string, now: Date): Promise<{ action: string; detail?: string }> {
    const [settingsRow] = await import("@/db/schema").then(({ tenant }) =>
        import("@/db").then(async ({ db }) => {
            const { eq } = await import("drizzle-orm");
            const rows = await db.select({ settings: tenant.settings }).from(tenant).where(eq(tenant.id, tenantId)).limit(1);
            return rows;
        }),
    );
    const timezone = readTenantTimezone(settingsRow?.settings);

    if (!(await tenantHasGerbangSchedule(tenantId))) {
        return { action: "skipped", detail: "gerbang layer disabled" };
    }

    const [scheduleDays, holidays] = await Promise.all([
        listSchoolScheduleDays(tenantId),
        listSchoolHolidays(tenantId),
    ]);
    if (scheduleDays.length === 0) return { action: "skipped", detail: "no schedule configured" };

    const civilDate = civilDateInTimeZone(now, timezone);
    const nowHHMM = localHHMMInZone(now, timezone);
    const decision = resolveGerbangScheduleDecision({ civilDate, nowHHMM, scheduleDays, holidays });

    if (decision.kind === "none") {
        return { action: "none", detail: decision.reason };
    }

    if (decision.phase === "during") {
        const result = await openGerbangSessionForDay({
            tenantId,
            sessionDate: civilDate,
            plannedStart: decision.startTime,
            plannedEnd: decision.endTime,
            openedAt: now,
        });
        return result.created ? { action: "opened", detail: result.sessionId } : { action: "already-open" };
    }

    if (decision.phase === "after") {
        const result = await closeGerbangSessionForDay(tenantId, civilDate, now);
        return { action: result };
    }

    return { action: "waiting", detail: `starts ${decision.startTime}` };
}

/**
 * Kelas pass for one tenant: iterates every effective teaching slot of the
 * day and opens/closes its session according to the pure slot decision.
 * Gated on the `penjadwalan` feature (ticket 02 recheck) + active Kelas layer.
 */
async function processTenantKelas(tenantId: string, now: Date): Promise<{ action: string; detail?: string }> {
    const settingsRow = await loadTenantSettingsForKelas(tenantId);
    const settings = settingsRow?.settings;
    if (!(await tenantAllowsKelasSessions(tenantId))) {
        return { action: "skipped", detail: "kelas layer / penjadwalan disabled" };
    }

    const timezone = readTenantTimezone(settings);
    const civilDate = civilDateInTimeZone(now, timezone);
    const nowHHMM = localHHMMInZone(now, timezone);

    const [slots, holidays] = await Promise.all([
        listEffectiveKelasSlotsForDate(tenantId, civilDate),
        listKelasHolidays(tenantId),
    ]);
    // Holidays suppress every slot for the date (same rule as Gerbang).
    if (isHoliday(civilDate, holidays)) return { action: "none", detail: "holiday" };
    if (slots.length === 0) return { action: "none", detail: "no effective kelas slots" };

    const tolerance = readKelasToleranceFromSettings(settings);
    let opened = 0;
    let closed = 0;
    let alpaFilled = 0;
    for (const slot of slots) {
        const decision = resolveKelasSlotDecision({
            slot,
            civilDate,
            nowHHMM,
            toleranceMinutes: tolerance,
        });
        if (decision.kind !== "session") continue;
        if (decision.phase === "during") {
            const result = await openKelasSlotSession({
                tenantId,
                slot,
                sessionDate: civilDate,
                toleranceMinutes: tolerance,
                openedAt: now,
            });
            if (result.created) opened += 1;
        } else if (decision.phase === "after") {
            const result = await closeKelasSlotSession({
                tenantId,
                slotId: slot.slotId,
                sessionDate: civilDate,
                closedAt: now,
            });
            if (result.ok) {
                closed += 1;
                alpaFilled += result.alpaCount;
            }
        }
    }
    const parts = [`opened ${opened}`, `closed ${closed}`];
    if (alpaFilled > 0) parts.push(`alpa ${alpaFilled}`);
    return { action: "kelas", detail: parts.join(", ") };
}

async function main(): Promise<number> {
    const now = new Date();
    const runner = `${hostname()}:${process.pid}`;
    let exitCode = 0;

    try {
        const pageSize = 100;
        let offset = 0;
        let processed = 0;
        for (;;) {
            const tenantIds = await listTenantIdsWithSchedule(pageSize, offset);
            const kelasTenantIds = await listTenantIdsWithKelasSlots(pageSize, offset);
            if (tenantIds.length === 0 && kelasTenantIds.length === 0) break;
            for (const tenantId of tenantIds) {
                try {
                    const result = await processTenant(tenantId, now);
                    console.log(`[${runner}] ${tenantId}: ${result.action}${result.detail ? ` (${result.detail})` : ""}`);
                    processed += 1;
                } catch (error) {
                    exitCode = 2;
                    console.error(`[${runner}] ${tenantId}: failed`, error);
                }
                try {
                    const kelasResult = await processTenantKelas(tenantId, now);
                    console.log(`[${runner}] ${tenantId}: kelas ${kelasResult.action}${kelasResult.detail ? ` (${kelasResult.detail})` : ""}`);
                } catch (error) {
                    exitCode = 2;
                    console.error(`[${runner}] ${tenantId}: kelas failed`, error);
                }
            }
            for (const tenantId of kelasTenantIds) {
                if (tenantIds.includes(tenantId)) continue; // already handled above
                try {
                    const kelasResult = await processTenantKelas(tenantId, now);
                    console.log(`[${runner}] ${tenantId}: kelas ${kelasResult.action}${kelasResult.detail ? ` (${kelasResult.detail})` : ""}`);
                } catch (error) {
                    exitCode = 2;
                    console.error(`[${runner}] ${tenantId}: kelas failed`, error);
                }
            }
            if (tenantIds.length < pageSize && kelasTenantIds.length < pageSize) break;
            offset += pageSize;
        }
        console.log(`[${runner}] processed ${processed} tenant(s) at ${now.toISOString()}`);
    } finally {
        await closeDatabasePool();
    }
    return exitCode;
}

void main().then((code) => {
    process.exitCode = code;
});
