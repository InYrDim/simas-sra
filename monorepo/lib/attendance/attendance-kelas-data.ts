import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
    attendanceRecord,
    attendanceSession,
    classGroup,
    classMembership,
    homeroomAssignment,
    schoolHoliday,
    schoolPerson,
    subject,
    teacherProfile,
    teachingAssignment,
    teachingSlot,
    tenant,
} from "@/db/schema";
import { dayOfWeekForCivilDate, type SchoolHolidayInput } from "@/lib/attendance/attendance-schedule";
import {
    addMinutesToHHMM,
    type KelasSlotDecisionInput,
} from "@/lib/attendance/attendance-kelas-schedule";
import { DEFAULT_KELAS_CLOSE_TOLERANCE_MINUTES } from "@/lib/attendance/attendance-config";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";

/**
 * Server-only data layer for the Kelas (classroom) attendance session,
 * bound to a Teaching Slot (wayfinder 04: identity = (tenant, slotId, date)).
 *
 * Pure decision logic lives in `attendance-kelas-schedule.ts`; this module owns
 * the slot query (slots joined with their teaching assignment) and the
 * session-backed transitions used by the worker (`openKelasSlotSession` /
 * `closeKelasSlotSession`, including the auto-alpa fill at close time).
 *
 * The system actor: auto-alpa records are written with
 * `recordedByUserId = null` — the same "system wrote this" pattern as the
 * worker-opened session's `openedByUserId = null`. Records stay correctable by
 * Guru/Admin afterwards (they are NOT immutable in content, only in identity).
 */

/** Slot facts the worker needs, already joined with the teaching assignment. */
export type KelasSlotWithAssignment = KelasSlotDecisionInput & {
    teachingAssignmentId: string;
    classGroupId: string;
    teacherProfileId: string;
};

/**
 * Loads every teaching slot for the tenant whose weekday matches `civilDate`
 * AND whose assignment is active and covers the date (wayfinder 03:
 * startsOn <= d < endsOn). The semester flag flows through untouched — the
 * caller filters it against the active academic_semester when it needs to.
 */
export async function listEffectiveKelasSlotsForDate(
    tenantId: string,
    civilDate: string,
): Promise<KelasSlotWithAssignment[]> {
    const dayOfWeek = dayOfWeekForCivilDate(civilDate);
    if (!dayOfWeek) return [];

    const rows = await db
        .select({
            slotId: teachingSlot.id,
            dayOfWeek: teachingSlot.dayOfWeek,
            startTime: teachingSlot.startTime,
            endTime: teachingSlot.endTime,
            semester: teachingSlot.semester,
            assignmentStatus: teachingAssignment.status,
            startsOn: teachingAssignment.startsOn,
            endsOn: teachingAssignment.endsOn,
            teachingAssignmentId: teachingAssignment.id,
            classGroupId: teachingAssignment.classGroupId,
            teacherProfileId: teachingAssignment.teacherProfileId,
        })
        .from(teachingSlot)
        .innerJoin(
            teachingAssignment,
            and(
                eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
            ),
        )
        .where(and(eq(teachingSlot.tenantId, tenantId), eq(teachingSlot.dayOfWeek, dayOfWeek)));

    // Date-window filter (wayfinder 03) — matches resolveKelasSlotDecision,
    // applied here so the worker only iterates genuinely applicable slots.
    return rows.filter(
        (row) =>
            row.assignmentStatus === "active" &&
            row.startsOn <= civilDate &&
            (row.endsOn === null || civilDate < row.endsOn),
    );
}

/** Holiday ranges for a tenant, shaped for the pure decision layer. */
export async function listKelasHolidays(tenantId: string): Promise<SchoolHolidayInput[]> {
    const rows = await db
        .select({ startDate: schoolHoliday.startDate, endDate: schoolHoliday.endDate })
        .from(schoolHoliday)
        .where(eq(schoolHoliday.tenantId, tenantId));
    return rows.map((row) => ({ startDate: row.startDate, endDate: row.endDate }));
}

/** Tenant settings row loaded once per worker pass (timezone + tolerance + gate). */
export async function loadTenantSettingsForKelas(
    tenantId: string,
): Promise<{ settings: unknown } | null> {
    const [row] = await db
        .select({ settings: tenant.settings })
        .from(tenant)
        .where(eq(tenant.id, tenantId))
        .limit(1);
    return row ?? null;
}

/**
 * Lists tenant ids that own at least one teaching slot (paginated by the
 * caller via limit/offset). The Kelas pass runs for these tenants regardless
 * of whether a Gerbang school schedule exists.
 */
export async function listTenantIdsWithKelasSlots(limit = 100, offset = 0): Promise<string[]> {
    const rows = await db
        .select({ tenantId: teachingSlot.tenantId })
        .from(teachingSlot)
        .groupBy(teachingSlot.tenantId)
        .orderBy(teachingSlot.tenantId)
        .limit(limit)
        .offset(offset);
    return rows.map((row) => row.tenantId);
}

/**
 * Lesson identity (mapel / jam / guru) of one slot for the close-time
 * notification (wayfinder 07 model C). Null when the chain is gone.
 */
export async function getKelasSlotLessonInfo(
    tenantId: string,
    slotId: string,
): Promise<{ subjectName: string; slotStart: string; teacherName: string } | null> {
    const [row] = await db
        .select({
            subjectName: subject.name,
            slotStart: teachingSlot.startTime,
            teacherName: schoolPerson.fullName,
        })
        .from(teachingSlot)
        .innerJoin(
            teachingAssignment,
            and(
                eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
            ),
        )
        .innerJoin(
            subject,
            and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)),
        )
        .innerJoin(
            teacherProfile,
            and(
                eq(teacherProfile.tenantId, teachingAssignment.tenantId),
                eq(teacherProfile.id, teachingAssignment.teacherProfileId),
            ),
        )
        .innerJoin(
            schoolPerson,
            and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)),
        )
        .where(and(eq(teachingSlot.tenantId, tenantId), eq(teachingSlot.id, slotId)))
        .limit(1);
    return row ?? null;
}

/**
 * The worker's Kelas gate: the `penjadwalan` feature must be enabled before a
 * session is opened (ticket 02 recheck), and the Kelas layer must be active.
 * Reads stay tolerant: an unset legacy flag keeps the placeholder access.
 */
export async function tenantAllowsKelasSessions(tenantId: string): Promise<boolean> {
    const [row] = await db
        .select({ settings: tenant.settings })
        .from(tenant)
        .where(eq(tenant.id, tenantId))
        .limit(1);
    if (!row) return false;
    return (
        isTenantFeatureEnabled(row.settings, "penjadwalan") && isTenantFeatureEnabled(row.settings, "absensiKelas")
    );
}

/** Result of the idempotent per-slot session open. */
export type OpenKelasSlotResult = { created: boolean; sessionId?: string };

/**
 * Same as `openKelasSlotSession` but records the human actor who opened the
 * session manually (source stays "manual"-like via `openedByUserId`).
 */
export async function openKelasSlotSessionManually(input: {
    tenantId: string;
    slot: KelasSlotDecisionInput;
    sessionDate: string;
    toleranceMinutes: number;
    openedAt: Date;
    actorUserId: string;
}): Promise<OpenKelasSlotResult> {
    const result = await openKelasSlotSession(input);
    if (!result.created || !result.sessionId) return result;
    await db
        .update(attendanceSession)
        .set({ openedByUserId: input.actorUserId, source: "manual", updatedAt: input.openedAt })
        .where(eq(attendanceSession.id, result.sessionId));
    return result;
}

/**
 * Opens the Kelas session for (tenant, slot, date). Idempotent: when the
 * session already exists the unique constraint (tenant, slotId, sessionDate)
 * or the pre-check makes this a no-op. plannedEnd = slot end + tolerance.
 * Race with a concurrent opener resolves to "already open".
 */
export async function openKelasSlotSession(input: {
    tenantId: string;
    slot: KelasSlotDecisionInput;
    sessionDate: string;
    toleranceMinutes: number;
    openedAt: Date;
}): Promise<OpenKelasSlotResult> {
    const existing = await db
        .select({ id: attendanceSession.id })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, input.tenantId),
                eq(attendanceSession.slotId, input.slot.slotId),
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
            layer: "kelas",
            slotId: input.slot.slotId,
            sessionDate: input.sessionDate,
            plannedStart: input.slot.startTime,
            plannedEnd: addMinutesToHHMM(input.slot.endTime, input.toleranceMinutes),
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

export type CloseKelasSlotResult =
    | { ok: true; alpaCount: number; /** Students just filled with alpa (for close-time notify, wayfinder 07). */
        alpaStudentIds: string[] }
    | { ok: false; code: "not-found" | "error" };

/**
 * Closes an open Kelas session BY ID (manual close path) with the same
 * auto-alpa fill as the worker path. Reuses the per-slot close by resolving
 * the session's slot/date first.
 */
export async function closeKelasSessionById(
    tenantId: string,
    sessionId: string,
    closedAt: Date,
): Promise<CloseKelasSlotResult> {
    const [row] = await db
        .select({ slotId: attendanceSession.slotId, sessionDate: attendanceSession.sessionDate })
        .from(attendanceSession)
        .where(and(eq(attendanceSession.tenantId, tenantId), eq(attendanceSession.id, sessionId)))
        .limit(1);
    if (!row?.slotId) return { ok: false, code: "not-found" };
    return closeKelasSlotSession({ tenantId, slotId: row.slotId, sessionDate: row.sessionDate, closedAt });
}

/**
 * Closes the open Kelas session for (tenant, slot, date) and fills unrecorded
 * students with `alpa` (mode manual, actor = system/null). Runs in one
 * transaction: unrecorded = active members of the assignment's rombel without
 * a kelas record linked to this session. Idempotent on the session status.
 */
export async function closeKelasSlotSession(input: {
    tenantId: string;
    slotId: string;
    sessionDate: string;
    closedAt: Date;
}): Promise<CloseKelasSlotResult> {
    try {
        return await db.transaction(async (tx) => {
            const [session] = await tx
                .select({
                    id: attendanceSession.id,
                    status: attendanceSession.status,
                    classGroupId: teachingAssignment.classGroupId,
                })
                .from(attendanceSession)
                .innerJoin(
                    teachingSlot,
                    and(
                        eq(teachingSlot.tenantId, attendanceSession.tenantId),
                        eq(teachingSlot.id, attendanceSession.slotId),
                    ),
                )
                .innerJoin(
                    teachingAssignment,
                    and(
                        eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                        eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
                    ),
                )
                .where(
                    and(
                        eq(attendanceSession.tenantId, input.tenantId),
                        eq(attendanceSession.slotId, input.slotId),
                        eq(attendanceSession.sessionDate, input.sessionDate),
                    ),
                )
                .limit(1);
            if (!session) return { ok: false as const, code: "not-found" as const };

            let alpaCount = 0;
            let alpaStudentIds: string[] = [];
            if (session.status === "open") {
                // Unrecorded = rombel members with no kelas record in this session.
                const members = await tx
                    .select({ studentId: classMembership.studentId })
                    .from(classMembership)
                    .where(
                        and(
                            eq(classMembership.tenantId, input.tenantId),
                            eq(classMembership.classGroupId, session.classGroupId),
                            // Only active memberships: endedAt IS NULL + planned = false
                            // is exactly what the generated activeStudentSlot encodes.
                            isNull(classMembership.endedAt),
                            eq(classMembership.planned, false),
                        ),
                    );
                const recorded = await tx
                    .select({ studentId: attendanceRecord.studentId })
                    .from(attendanceRecord)
                    .where(
                        and(
                            eq(attendanceRecord.tenantId, input.tenantId),
                            eq(attendanceRecord.sessionId, session.id),
                            eq(attendanceRecord.layer, "kelas"),
                        ),
                    );
                const recordedIds = new Set(recorded.map((row) => row.studentId));
                const missing = members.map((row) => row.studentId).filter((id) => !recordedIds.has(id));

                if (missing.length > 0) {
                    const now = input.closedAt;
                    await tx.insert(attendanceRecord).values(
                        missing.map((studentId) => ({
                            id: crypto.randomUUID(),
                            tenantId: input.tenantId,
                            studentId,
                            sessionId: session.id,
                            layer: "kelas" as const,
                            mode: "manual" as const,
                            recordedAt: now,
                            status: "alpa" as const,
                            recordedByUserId: null,
                            outOfSession: false,
                            notes: "Alpa otomatis (penutupan sesi)",
                            version: 1,
                            createdAt: now,
                            updatedAt: now,
                        })),
                    );
                    alpaCount = missing.length;
                    alpaStudentIds = [...missing];
                }

                await tx
                    .update(attendanceSession)
                    .set({ status: "closed", closedAt: input.closedAt, updatedAt: input.closedAt })
                    .where(
                        and(
                            eq(attendanceSession.tenantId, input.tenantId),
                            eq(attendanceSession.id, session.id),
                            eq(attendanceSession.status, "open"),
                        ),
                    );
            }

            return { ok: true as const, alpaCount, alpaStudentIds };
        });
    } catch {
        return { ok: false, code: "error" };
    }
}

/**
 * Effective tolerance for a tenant: the configured Kelas close tolerance, or
 * the module default when unset. Kept here so the worker needs one import.
 */
export function readKelasToleranceFromSettings(settings: unknown): number {
    const safe = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
    const absensi = safe.absensi && typeof safe.absensi === "object" ? (safe.absensi as Record<string, unknown>) : {};
    const raw = absensi.kelasCloseToleranceMinutes;
    return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 120
        ? raw
        : DEFAULT_KELAS_CLOSE_TOLERANCE_MINUTES;
}

/** View shape for the per-slot session list on the Absensi Kelas page. */
export type KelasSessionSlotView = {
    id: string;
    status: "open" | "closed";
    sessionDate: string;
    plannedStart: string;
    plannedEnd: string;
    openedAt: Date;
    closedAt: Date | null;
    slotId: string;
    teacherProfileId: string;
    classGroupId: string;
    className: string;
    subjectName: string;
    teacherName: string;
};

/**
 * Every Kelas session of the tenant's today (civil date in `timezone`), joined
 * with its slot context: subject/teacher flow from slot -> assignment, class
 * from the assignment's rombel (wayfinder 04). Sorted by planned start.
 */
export async function listKelasSessionsForDayWithSlotInfo(
    tenantId: string,
    timezone: string,
    now: Date = new Date(),
): Promise<KelasSessionSlotView[]> {
    const { civilDateInTimeZone } = await import("@/lib/attendance/attendance-schedule");
    const sessionDate = civilDateInTimeZone(now, timezone);

    const rows = await db
        .select({
            id: attendanceSession.id,
            status: attendanceSession.status,
            sessionDate: attendanceSession.sessionDate,
            plannedStart: attendanceSession.plannedStart,
            plannedEnd: attendanceSession.plannedEnd,
            openedAt: attendanceSession.openedAt,
            closedAt: attendanceSession.closedAt,
            slotId: attendanceSession.slotId,
            teacherProfileId: teachingAssignment.teacherProfileId,
            classGroupId: teachingAssignment.classGroupId,
            className: classGroup.groupName,
            subjectName: subject.name,
            teacherName: schoolPerson.fullName,
        })
        .from(attendanceSession)
        .innerJoin(
            teachingSlot,
            and(eq(teachingSlot.tenantId, attendanceSession.tenantId), eq(teachingSlot.id, attendanceSession.slotId)),
        )
        .innerJoin(
            teachingAssignment,
            and(
                eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
            ),
        )
        .innerJoin(
            classGroup,
            and(eq(classGroup.tenantId, teachingAssignment.tenantId), eq(classGroup.id, teachingAssignment.classGroupId)),
        )
        .innerJoin(
            subject,
            and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)),
        )
        // Teacher name flows assignment -> teacher_profile -> school_person
        // (same chain as the Jadwal Mengajar data layer).
        .innerJoin(
            teacherProfile,
            and(
                eq(teacherProfile.tenantId, teachingAssignment.tenantId),
                eq(teacherProfile.id, teachingAssignment.teacherProfileId),
            ),
        )
        .innerJoin(
            schoolPerson,
            and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)),
        )
        .where(
            and(
                eq(attendanceSession.tenantId, tenantId),
                eq(attendanceSession.layer, "kelas"),
                eq(attendanceSession.sessionDate, sessionDate),
            ),
        )
        .orderBy(attendanceSession.plannedStart);

    return rows.map((row) => ({ ...row, slotId: row.slotId ?? "" }));
}

/**
 * Teacher identity of a session's slot, for row-level write guards: the
 * pengampu's teacher_profile.id for the given session id (tenant-scoped).
 */
export async function getKelasSessionTeacherProfileId(
    tenantId: string,
    sessionId: string,
): Promise<string | null> {
    const [row] = await db
        .select({ teacherProfileId: teachingAssignment.teacherProfileId })
        .from(attendanceSession)
        .innerJoin(
            teachingSlot,
            and(eq(teachingSlot.tenantId, attendanceSession.tenantId), eq(teachingSlot.id, attendanceSession.slotId)),
        )
        .innerJoin(
            teachingAssignment,
            and(
                eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
            ),
        )
        .where(and(eq(attendanceSession.tenantId, tenantId), eq(attendanceSession.id, sessionId)))
        .limit(1);
    return row?.teacherProfileId ?? null;
}

/** Rombel ids where the account is the current homeroom teacher (Wali Kelas). */
export async function listHomeroomClassGroupIdsForUser(tenantId: string, userId: string): Promise<Set<string>> {
    const rows = await db
        .select({ classGroupId: homeroomAssignment.classGroupId })
        .from(homeroomAssignment)
        .innerJoin(
            teacherProfile,
            and(eq(teacherProfile.tenantId, homeroomAssignment.tenantId), eq(teacherProfile.id, homeroomAssignment.teacherId)),
        )
        .innerJoin(
            schoolPerson,
            and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)),
        )
        .where(
            and(
                eq(homeroomAssignment.tenantId, tenantId),
                eq(schoolPerson.accountUserId, userId),
                sql`${homeroomAssignment.endedAt} IS NULL`,
            ),
        );
    return new Set(rows.map((row) => row.classGroupId));
}
