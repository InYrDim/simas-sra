import { hostname } from "node:os";

import { closeDatabasePool } from "@/db";
import {
    civilDateInTimeZone,
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
import { readTenantTimezone } from "@/lib/attendance/attendance-config";

/**
 * Schedule worker for the Gerbang layer (Fase penjadwalan).
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
            if (tenantIds.length === 0) break;
            for (const tenantId of tenantIds) {
                try {
                    const result = await processTenant(tenantId, now);
                    console.log(`[${runner}] ${tenantId}: ${result.action}${result.detail ? ` (${result.detail})` : ""}`);
                    processed += 1;
                } catch (error) {
                    exitCode = 2;
                    console.error(`[${runner}] ${tenantId}: failed`, error);
                }
            }
            if (tenantIds.length < pageSize) break;
            offset += pageSize;
        }
        console.log(`[${runner}] processed ${processed} tenant(s) at ${now.toISOString()}`);
    } finally {
        await closeDatabasePool();
    }
    return exitCode;
}

process.exitCode = await main();
