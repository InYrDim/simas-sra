import { and, between, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import {
    studentProfile,
    schoolPerson,
    classMembership,
    classGroup,
    attendanceRecord,
    attendanceSession,
} from "@/db/schema";
import { civilDateInZone, localHHMMInZone, zonedWallClockToUtc } from "@/lib/attendance/attendance-date";
import {
    isAttendanceRecordStatus,
    isStatusValidForLayer,
    type AttendanceRecordLayer,
    type AttendanceRecordMode,
    type AttendanceRecordStatus,
} from "@/lib/attendance/attendance-record";

/**
 * Pure write path for Absensi (attendance) records.
 *
 * This module is intentionally free of `server-only` so it can be exercised by
 * MySQL integration tests. The server-only boundary lives in
 * `attendance-record-data.ts`, which re-exports these functions for use from
 * server actions / routes.
 *
 * The persistence shape is mode-agnostic: the caller supplies the resolved
 * `studentId`, the `status`, and the `actorUserId`. Manual capture (Fase 2) and
 * QR/Kartu self-service (Fase 3) both funnel through `recordAttendance`; only
 * *how* `studentId`/`status`/`actor` are obtained differs between modes.
 */

export type RecordAttendanceInput = {
    tenantId: string;
    /** Resolved student profile id (must belong to the tenant). */
    studentId: string;
    layer: AttendanceRecordLayer;
    mode: AttendanceRecordMode;
    status: AttendanceRecordStatus;
    /** Who performed the write. Manual = operator login; QR/Kartu = gate service. */
    actorUserId: string;
    recordedAt?: Date;
    /** Tenant IANA timezone (e.g. "Asia/Jakarta"); defaults to WIB. */
    timezone?: string;
    notes?: string;
};

export type RecordAttendanceResult =
    | { ok: true; id: string }
    | { ok: false; code: "student-not-found" | "invalid-status" | "error" };

/**
 * Resolves a student reference to a `student_profile.id` within a tenant.
 *
 * `ref` may be a raw `student_profile.id` or a normalized NIS (the value used
 * in QR/Kartu tokens as `studentRef`). This is the single seam where Manual
 * (operator picks the profile id) and QR/Kartu (token carries a ref) converge,
 * so Fase 3 only needs to call this with the decoded `studentRef`.
 */
export async function resolveStudentIdentity(
    tenantId: string,
    ref: string,
): Promise<{ studentId: string } | null> {
    const normalized = ref.trim();
    if (normalized === "") return null;

    const [row] = await db
        .select({ id: studentProfile.id })
        .from(studentProfile)
        .where(
            and(
                eq(studentProfile.tenantId, tenantId),
                // Match by primary id or normalized NIS (token carries NIS).
                normalized.length === 36
                    ? eq(studentProfile.id, normalized)
                    : eq(studentProfile.normalizedNis, normalized.toLowerCase()),
            ),
        )
        .limit(1);

    return row ? { studentId: row.id } : null;
}

/**
 * Resolves the currently open session for a tenant + layer on a given day.
 *
 * Returns the open `attendance_session` row, or `null` when no session is open
 * (never opened, or already closed). The caller uses this to decide whether a
 * recording falls inside or outside the session window.
 */
export async function resolveOpenSession(
    tenantId: string,
    layer: AttendanceRecordLayer,
    day: Date = new Date(),
    timezone: string = "Asia/Jakarta",
): Promise<{ id: string; plannedStart: string; plannedEnd: string; openedAt: Date } | null> {
    const dateStr = civilDateInZone(day, timezone);
    const [row] = await db
        .select({
            id: attendanceSession.id,
            plannedStart: attendanceSession.plannedStart,
            plannedEnd: attendanceSession.plannedEnd,
            openedAt: attendanceSession.openedAt,
        })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, layer),
                eq(attendanceSession.sessionDate, dateStr),
                eq(attendanceSession.status, "open"),
            ),
        )
        .limit(1);
    return row ?? null;
}

/**
 * Resolves the session for a tenant/layer on a given day regardless of status.
 * Used by the UI to decide whether a "Buat Sesi" affordance should be shown:
 * one session per day is allowed (open OR closed), so once any session exists
 * for today the create action will reject with "already-open".
 */
export async function resolveTodaysSession(
    tenantId: string,
    layer: AttendanceRecordLayer,
    day: Date = new Date(),
    timezone: string = "Asia/Jakarta",
): Promise<{ id: string; status: "open" | "closed"; plannedStart: string; plannedEnd: string; openedAt: Date } | null> {
    const dateStr = civilDateInZone(day, timezone);
    const [row] = await db
        .select({
            id: attendanceSession.id,
            status: attendanceSession.status,
            plannedStart: attendanceSession.plannedStart,
            plannedEnd: attendanceSession.plannedEnd,
            openedAt: attendanceSession.openedAt,
        })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, layer),
                eq(attendanceSession.sessionDate, dateStr),
            ),
        )
        .limit(1);
    return row ?? null;
}

/**
 * Persists an attendance record. Fails closed on any invariant violation so the
 * database CHECK constraint is a backstop, not the only guard.
 *
 * Session resolution: when an open session exists for the tenant/layer on the
 * recorded day, the record is linked to it (`sessionId` set). `outOfSession`
 * flags only a recorded time outside the planned window (e.g. a late arrival);
 * the record is still attached so it appears in session history. When no open
 * session exists for the day, the record stays unlinked (`sessionId = null`,
 * `outOfSession = true`).
 */
export async function recordAttendance(
    input: RecordAttendanceInput,
): Promise<RecordAttendanceResult> {
    if (!isAttendanceRecordStatus(input.status) || !isStatusValidForLayer(input.layer, input.status)) {
        return { ok: false, code: "invalid-status" };
    }

    const resolved = await resolveStudentIdentity(input.tenantId, input.studentId);
    if (!resolved) return { ok: false, code: "student-not-found" };

    const now = input.recordedAt ?? new Date();
    const timezone = input.timezone ?? "Asia/Jakarta";
    const session = await resolveOpenSession(input.tenantId, input.layer, now, timezone);

    // Always attach the record to the open session for the day so it surfaces in
    // session history. `outOfSession` only flags a time outside the planned
    // window (e.g. a late arrival) — it no longer orphans the record. A record
    // with no open session at all stays unlinked (sessionId = null).
    let sessionId: string | null = null;
    let outOfSession = true;
    if (session) {
        sessionId = session.id;
        const hhmm = localHHMMInZone(now, timezone);
        outOfSession = !(hhmm >= session.plannedStart && hhmm <= session.plannedEnd);
    }

    const id = randomUUID();
    try {
        await db.insert(attendanceRecord).values({
            id,
            tenantId: input.tenantId,
            studentId: resolved.studentId,
            sessionId,
            layer: input.layer,
            mode: input.mode,
            recordedAt: now,
            status: input.status,
            recordedByUserId: input.actorUserId,
            outOfSession,
            notes: input.notes,
            version: 1,
            createdAt: now,
            updatedAt: now,
        });
        return { ok: true, id };
    } catch {
        return { ok: false, code: "error" };
    }
}

/** Returns the Gerbang records for a tenant on a given day (defaults to today). */
export async function listGerbangRecordsForDay(
    tenantId: string,
    day: Date = new Date(),
    timezone: string = "Asia/Jakarta",
): Promise<
    Array<{
        id: string;
        studentId: string;
        status: AttendanceRecordStatus;
        recordedAt: Date;
        recordedByUserId: string;
        notes: string | null;
        outOfSession: boolean;
        sessionId: string | null;
    }>
> {
    const start = zonedWallClockToUtc(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)), timezone);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    return db
        .select({
            id: attendanceRecord.id,
            studentId: attendanceRecord.studentId,
            status: attendanceRecord.status,
            recordedAt: attendanceRecord.recordedAt,
            recordedByUserId: attendanceRecord.recordedByUserId,
            notes: attendanceRecord.notes,
            outOfSession: attendanceRecord.outOfSession,
            sessionId: attendanceRecord.sessionId,
        })
        .from(attendanceRecord)
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.layer, "gerbang"),
                between(attendanceRecord.recordedAt, start, end),
            ),
        )
        .orderBy(attendanceRecord.recordedAt);
}

/**
 * Like `listGerbangRecordsForDay`, but joined to the student's identity
 * (name, NIS) so the day view can list who was recorded, not just a count.
 */
export async function listGerbangRecordsForDayWithStudents(
    tenantId: string,
    day: Date = new Date(),
    timezone: string = "Asia/Jakarta",
): Promise<
    Array<{
        id: string;
        studentId: string;
        studentName: string;
        nis: string;
        status: AttendanceRecordStatus;
        recordedAt: Date;
        notes: string | null;
        outOfSession: boolean;
        sessionId: string | null;
    }>
> {
    const start = zonedWallClockToUtc(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)), timezone);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    return db
        .select({
            id: attendanceRecord.id,
            studentId: attendanceRecord.studentId,
            studentName: schoolPerson.fullName,
            nis: studentProfile.nis,
            status: attendanceRecord.status,
            recordedAt: attendanceRecord.recordedAt,
            notes: attendanceRecord.notes,
            outOfSession: attendanceRecord.outOfSession,
            sessionId: attendanceRecord.sessionId,
        })
        .from(attendanceRecord)
        .innerJoin(studentProfile, eq(studentProfile.id, attendanceRecord.studentId))
        .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.layer, "gerbang"),
                between(attendanceRecord.recordedAt, start, end),
            ),
        )
        .orderBy(attendanceRecord.recordedAt);
}

/** Returns the Gerbang records linked to a specific session. */
export async function listGerbangRecordsBySession(
    tenantId: string,
    sessionId: string,
): Promise<
    Array<{
        id: string;
        studentId: string;
        status: AttendanceRecordStatus;
        recordedAt: Date;
        recordedByUserId: string;
        notes: string | null;
        outOfSession: boolean;
    }>
> {
    return db
        .select({
            id: attendanceRecord.id,
            studentId: attendanceRecord.studentId,
            status: attendanceRecord.status,
            recordedAt: attendanceRecord.recordedAt,
            recordedByUserId: attendanceRecord.recordedByUserId,
            notes: attendanceRecord.notes,
            outOfSession: attendanceRecord.outOfSession,
        })
        .from(attendanceRecord)
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.layer, "gerbang"),
                eq(attendanceRecord.sessionId, sessionId),
            ),
        )
        .orderBy(attendanceRecord.recordedAt);
}

export type OpenSessionInput = {
    tenantId: string;
    layer: AttendanceRecordLayer;
    openedByUserId: string;
    /** "HH:MM" planned window for the session. */
    plannedStart: string;
    plannedEnd: string;
    /** Session date (defaults to the tenant's civil date today, "YYYY-MM-DD"). */
    sessionDate?: string;
    /** Tenant IANA timezone (e.g. "Asia/Jakarta"); defaults to WIB. */
    timezone?: string;
    notes?: string;
};

export type OpenSessionResult =
    | { ok: true; id: string }
    | { ok: false; code: "already-open" | "invalid-window" | "error" };

/**
 * Opens a new attendance session for a tenant/layer on a day. "Open" means the
 * session starts immediately (`openedAt = now`). Per "satu sesi per lapisan per
 * hari", a second session for the same day (open or already closed) is rejected
 * with `already-open`. The unique constraint on (tenantId, layer, sessionDate)
 * is a backstop against races.
 */
/**
 * Returns any attendance session (open or closed) for a tenant/layer on a day.
 * Used by `openSession` to enforce "satu sesi per lapisan per hari" — a second
 * session for the same day is rejected even after the first one was closed.
 */
async function hasSessionForDay(
    tenantId: string,
    layer: AttendanceRecordLayer,
    day: string,
): Promise<boolean> {
    const [row] = await db
        .select({ id: attendanceSession.id })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, layer),
                eq(attendanceSession.sessionDate, day),
            ),
        )
        .limit(1);
    return row != null;
}

export async function openSession(input: OpenSessionInput): Promise<OpenSessionResult> {
    if (input.plannedEnd <= input.plannedStart) return { ok: false, code: "invalid-window" };
    const now = new Date();
    const dateStr = input.sessionDate ?? civilDateInZone(now, input.timezone ?? "Asia/Jakarta");
    if (await hasSessionForDay(input.tenantId, input.layer, dateStr)) {
        return { ok: false, code: "already-open" };
    }

    const id = randomUUID();
    try {
        await db.insert(attendanceSession).values({
            id,
            tenantId: input.tenantId,
            layer: input.layer,
            sessionDate: dateStr,
            plannedStart: input.plannedStart,
            plannedEnd: input.plannedEnd,
            openedAt: now,
            status: "open",
            openedByUserId: input.openedByUserId,
            notes: input.notes,
            version: 1,
            createdAt: now,
            updatedAt: now,
        });
        return { ok: true, id };
    } catch (error) {
        // Backstop: the unique constraint on (tenantId, layer, sessionDate) can
        // still race. Surface it as already-open rather than a generic error.
        if (isDuplicateEntryError(error)) return { ok: false, code: "already-open" };
        return { ok: false, code: "error" };
    }
}

/** True for MySQL ER_DUP_ENTRY (errno 1062). */
function isDuplicateEntryError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error != null &&
        "errno" in error &&
        (error as { errno?: number }).errno === 1062
    );
}

export type CloseSessionResult = { ok: true } | { ok: false; code: "not-found" | "error" };

/**
 * Summary of an attendance session for history listing. `recordCount` is the
 * number of attendance records linked to the session (always 0 for sessions
 * that were opened but never received a recording).
 */
export type AttendanceSessionSummary = {
    id: string;
    layer: AttendanceRecordLayer;
    sessionDate: string;
    plannedStart: string;
    plannedEnd: string;
    openedAt: Date;
    closedAt: Date | null;
    status: "open" | "closed";
    notes: string | null;
    recordCount: number;
};

/**
 * Lists attendance sessions for a tenant, newest first. When `layers` is
 * provided, only sessions for those layers are returned (used to scope history
 * to the tenant's active absensi layers).
 *
 * The optional `classGroupId` / `entryYear` filters scope the result to sessions
 * that actually received a recording from a student in that rombel / entry year
 * (resolved via an EXISTS subquery over the session's linked records). This lets
 * the history table answer "show me sessions involving rombel X" without loading
 * every record. `dateFrom`/`dateTo` (inclusive, "YYYY-MM-DD") bound the session
 * date.
 */
export async function listAttendanceSessions(
    tenantId: string,
    options: {
        layers?: readonly AttendanceRecordLayer[];
        limit?: number;
        classGroupId?: string;
        entryYear?: string;
        dateFrom?: string;
        dateTo?: string;
    } = {},
): Promise<AttendanceSessionSummary[]> {
    const layerFilter = options.layers && options.layers.length > 0
        ? inArray(attendanceSession.layer, [...options.layers])
        : undefined;
    const limit = options.limit && options.limit > 0 ? options.limit : 50;

    const filters: ReturnType<typeof eq>[] = [eq(attendanceSession.tenantId, tenantId)];
    if (layerFilter) filters.push(layerFilter);
    if (options.dateFrom) filters.push(sql`${attendanceSession.sessionDate} >= ${options.dateFrom}`);
    if (options.dateTo) filters.push(sql`${attendanceSession.sessionDate} <= ${options.dateTo}`);
    if (options.classGroupId) {
        // Session has a linked record from a student currently in this rombel.
        filters.push(
            exists(
                db
                    .select({ id: sql`1` })
                    .from(attendanceRecord)
                    .innerJoin(studentProfile, eq(studentProfile.id, attendanceRecord.studentId))
                    .innerJoin(
                        classMembership,
                        and(
                            eq(classMembership.tenantId, tenantId),
                            eq(classMembership.studentId, studentProfile.id),
                            eq(classMembership.classGroupId, options.classGroupId),
                            sql`${classMembership.endedAt} IS NULL`,
                        ),
                    )
                    .where(
                        and(
                            eq(attendanceRecord.tenantId, tenantId),
                            eq(attendanceRecord.sessionId, attendanceSession.id),
                        ),
                    ),
            ),
        );
    }
    if (options.entryYear) {
        // Session has a linked record from a student whose entry year matches.
        filters.push(
            exists(
                db
                    .select({ id: sql`1` })
                    .from(attendanceRecord)
                    .innerJoin(studentProfile, eq(studentProfile.id, attendanceRecord.studentId))
                    .where(
                        and(
                            eq(attendanceRecord.tenantId, tenantId),
                            eq(attendanceRecord.sessionId, attendanceSession.id),
                            sql`${studentProfile.entryDate} LIKE ${`${options.entryYear}%`}`,
                        ),
                    ),
            ),
        );
    }

    const rows = await db
        .select({
            id: attendanceSession.id,
            layer: attendanceSession.layer,
            sessionDate: attendanceSession.sessionDate,
            plannedStart: attendanceSession.plannedStart,
            plannedEnd: attendanceSession.plannedEnd,
            openedAt: attendanceSession.openedAt,
            closedAt: attendanceSession.closedAt,
            status: attendanceSession.status,
            notes: attendanceSession.notes,
            recordCount: sql<number>`cast(count(${attendanceRecord.id}) as unsigned)`.as("record_count"),
        })
        .from(attendanceSession)
        .leftJoin(
            attendanceRecord,
            and(
                eq(attendanceRecord.tenantId, attendanceSession.tenantId),
                eq(attendanceRecord.sessionId, attendanceSession.id),
            ),
        )
        .where(and(...filters))
        .groupBy(attendanceSession.id)
        .orderBy(desc(attendanceSession.sessionDate), desc(attendanceSession.openedAt))
        .limit(limit);

    return rows.map((row) => ({
        id: row.id,
        layer: row.layer,
        sessionDate: row.sessionDate,
        plannedStart: row.plannedStart,
        plannedEnd: row.plannedEnd,
        openedAt: row.openedAt,
        closedAt: row.closedAt,
        status: row.status,
        notes: row.notes,
        recordCount: Number(row.recordCount ?? 0),
    }));
}

/**
 * Returns the attendance records linked to a session, joined to the student's
 * identity (name, NIS) and current rombel (active `class_membership`). Used by
 * the history detail modal to show who actually recorded for the session.
 */
export type SessionRecordView = {
    id: string;
    studentId: string;
    studentName: string;
    nis: string;
    rombel: string | null;
    status: AttendanceRecordStatus;
    mode: AttendanceRecordMode;
    recordedAt: Date;
    outOfSession: boolean;
    notes: string | null;
};

export async function listSessionRecordsWithStudents(
    tenantId: string,
    sessionId: string,
): Promise<SessionRecordView[]> {
    const rows = await db
        .select({
            id: attendanceRecord.id,
            studentId: attendanceRecord.studentId,
            studentName: schoolPerson.fullName,
            nis: studentProfile.nis,
            rombel: classGroup.groupName,
            status: attendanceRecord.status,
            mode: attendanceRecord.mode,
            recordedAt: attendanceRecord.recordedAt,
            outOfSession: attendanceRecord.outOfSession,
            notes: attendanceRecord.notes,
        })
        .from(attendanceRecord)
        .innerJoin(studentProfile, eq(studentProfile.id, attendanceRecord.studentId))
        .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
        .leftJoin(
            classMembership,
            and(
                eq(classMembership.tenantId, tenantId),
                eq(classMembership.studentId, studentProfile.id),
                sql`${classMembership.endedAt} IS NULL`,
            ),
        )
        .leftJoin(classGroup, eq(classGroup.id, classMembership.classGroupId))
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.sessionId, sessionId),
            ),
        )
        .orderBy(attendanceRecord.recordedAt);

    return rows.map((row) => ({
        id: row.id,
        studentId: row.studentId,
        studentName: row.studentName,
        nis: row.nis,
        rombel: row.rombel ?? null,
        status: row.status,
        mode: row.mode,
        recordedAt: row.recordedAt,
        outOfSession: row.outOfSession,
        notes: row.notes,
    }));
}

/** Closes an open session (sets closedAt + status = "closed"). */
export async function closeSession(
    tenantId: string,
    sessionId: string,
): Promise<CloseSessionResult> {
    try {
        const result = await db
            .update(attendanceSession)
            .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
            .where(
                and(
                    eq(attendanceSession.tenantId, tenantId),
                    eq(attendanceSession.id, sessionId),
                    eq(attendanceSession.status, "open"),
                ),
            );
        const affected = ((result as unknown[])[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
        if (affected === 0) return { ok: false, code: "not-found" };
        return { ok: true };
    } catch {
        return { ok: false, code: "error" };
    }
}

export type DeleteSessionResult = { ok: true } | { ok: false; code: "not-found" | "error" };

/**
 * Deletes a session and detaches its linked records (sets their `sessionId` to
 * null so they remain as out-of-session history). The FK on `attendance_record`
 * is RESTRICT, so the detach must happen before the delete.
 */
export async function deleteSession(
    tenantId: string,
    sessionId: string,
): Promise<DeleteSessionResult> {
    try {
        await db
            .update(attendanceRecord)
            .set({ sessionId: null, updatedAt: new Date() })
            .where(and(eq(attendanceRecord.tenantId, tenantId), eq(attendanceRecord.sessionId, sessionId)));
        const result = await db
            .delete(attendanceSession)
            .where(and(eq(attendanceSession.tenantId, tenantId), eq(attendanceSession.id, sessionId)));
        const affected = ((result as unknown[])[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
        if (affected === 0) return { ok: false, code: "not-found" };
        return { ok: true };
    } catch {
        return { ok: false, code: "error" };
    }
}
