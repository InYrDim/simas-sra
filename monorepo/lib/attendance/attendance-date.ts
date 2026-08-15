/**
 * Pure, timezone-aware date helpers for Absensi (attendance).
 *
 * Attendance sessions are keyed by the tenant's *civil* date (the date as the
 * school observes it), not UTC. The DB pool runs in UTC, so a session opened at
 * 06:00 WIB would otherwise be stored under the previous UTC day and become
 * invisible to session resolution after midnight WIB. These helpers compute the
 * civil date / local time / day-range in the tenant's IANA timezone.
 */

/** "YYYY-MM-DD" civil date for `date` as observed in `timeZone`. */
export function civilDateInZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** "HH:MM" (24h) for `date` as observed in `timeZone`. */
export function localHHMMInZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${pick("hour")}:${pick("minute")}`;
}

/** Offset (minutes, positive = ahead of UTC) of `timeZone` at a UTC instant. */
function zoneOffsetMinutes(utcDate: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(utcDate);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second),
    );
    return Math.round((asUtc - utcDate.getTime()) / 60000);
}

/**
 * Converts a wall-clock time (a `Date` whose UTC fields are the intended
 * Y/M/D/H/M/S in `timeZone`) into the corresponding UTC instant.
 */
export function zonedWallClockToUtc(wall: Date, timeZone: string): Date {
    const naive = Date.UTC(
        wall.getUTCFullYear(),
        wall.getUTCMonth(),
        wall.getUTCDate(),
        wall.getUTCHours(),
        wall.getUTCMinutes(),
        wall.getUTCSeconds(),
    );
    return new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60000);
}
