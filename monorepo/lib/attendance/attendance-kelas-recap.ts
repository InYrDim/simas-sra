import "server-only";

import { and, between, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
    academicSemester,
    academicYear,
    attendanceRecord,
    attendanceSession,
    classGroup,
    schoolPerson,
    subject,
    teacherProfile,
    teachingAssignment,
    teachingSlot,
} from "@/db/schema";
import { zonedWallClockToUtc } from "@/lib/attendance/attendance-date";
import type { AttendanceRecordStatus } from "@/lib/attendance/attendance-record";

/**
 * Read-side summaries for the per-lesson Kelas attendance model (wayfinder 07,
 * ticket 09). Kelas sessions are identified by (slot, date), so the lesson
 * context (time, subject, teacher) flows session -> teaching_slot ->
 * teaching_assignment -> subject/teacher_profile/school_person.
 *
 * Everything here is read-only; write paths stay in attendance-kelas-data.ts
 * and attendance-record-write.ts. Gerbang rows simply have no slot context.
 */

/** Lesson context attached to a Kelas session for history views. */
export type KelasSessionLessonContext = {
    sessionId: string;
    /** Slot start "HH:MM" (the lesson's planned start). */
    slotStart: string;
    /** Slot end "HH:MM" (session plannedEnd = slot end + tolerance). */
    slotEnd: string;
    subjectName: string | null;
    teacherName: string | null;
    className: string | null;
};

/**
 * Lesson context for the given Kelas sessions. Sessions whose slot/assignment
 * chain is gone (rare: slot deletes are guarded) come back with null context
 * instead of being dropped, so history rows never disappear.
 */
export async function getKelasLessonContextForSessions(
    tenantId: string,
    sessionIds: readonly string[],
): Promise<Map<string, KelasSessionLessonContext>> {
    const unique = [...new Set(sessionIds)];
    if (unique.length === 0) return new Map();

    const rows = await db
        .select({
            sessionId: attendanceSession.id,
            slotStart: teachingSlot.startTime,
            slotEnd: teachingSlot.endTime,
            subjectName: subject.name,
            teacherName: schoolPerson.fullName,
            className: classGroup.groupName,
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
        .innerJoin(
            subject,
            and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)),
        )
        .innerJoin(
            classGroup,
            and(eq(classGroup.tenantId, teachingAssignment.tenantId), eq(classGroup.id, teachingAssignment.classGroupId)),
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
        .where(and(eq(attendanceSession.tenantId, tenantId), inArray(attendanceSession.id, unique)));

    const map = new Map<string, KelasSessionLessonContext>();
    for (const row of rows) {
        map.set(row.sessionId, {
            sessionId: row.sessionId,
            slotStart: row.slotStart,
            slotEnd: row.slotEnd,
            subjectName: row.subjectName ?? null,
            teacherName: row.teacherName ?? null,
            className: row.className ?? null,
        });
    }
    // Sessions missing context keep an empty entry so the UI renders "—".
    for (const id of unique) {
        if (!map.has(id)) {
            map.set(id, {
                sessionId: id,
                slotStart: "",
                slotEnd: "",
                subjectName: null,
                teacherName: null,
                className: null,
            });
        }
    }
    return map;
}

/** One aggregate row of the per-subject semester recap. */
export type KelasSubjectRecapRow = {
    subjectName: string;
    className: string;
    teacherName: string;
    /** Kelas sessions of this subject inside the semester. */
    sessionCount: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpa: number;
    /** hadir / total recorded (0 when nothing recorded yet). */
    attendanceRate: number;
};

export type ActiveSemesterInfo = {
    kind: "odd" | "even";
    yearLabel: string;
    startDate: string;
    endDate: string;
};

/** The tenant's active semester (kind + year label + bounds), or null. */
export async function getActiveSemesterInfo(tenantId: string): Promise<ActiveSemesterInfo | null> {
    const [row] = await db
        .select({
            kind: academicSemester.kind,
            yearLabel: academicYear.label,
            startDate: academicSemester.startDate,
            endDate: academicSemester.endDate,
        })
        .from(academicSemester)
        .innerJoin(
            academicYear,
            and(
                eq(academicYear.tenantId, academicSemester.tenantId),
                eq(academicYear.id, academicSemester.academicYearId),
            ),
        )
        .where(
            and(
                eq(academicSemester.tenantId, tenantId),
                eq(academicSemester.status, "active"),
                eq(academicYear.archived, false),
            ),
        )
        .limit(1);
    return row ?? null;
}

/**
 * Per-subject semester recap (wayfinder 07 decision 2). Counts Kelas records
 * whose session's slot semester flag matches the active semester and whose
 * session date falls inside the semester bounds. Records without a session
 * (legacy / out-of-session writes) are excluded — they have no lesson to
 * attribute. `studentId` scopes to one student (Absensi Saya); omit it for
 * the tenant-wide recap.
 */
export async function listKelasSubjectRecap(
    tenantId: string,
    options: { studentId?: string } = {},
): Promise<{ semester: ActiveSemesterInfo | null; rows: KelasSubjectRecapRow[] }> {
    const semester = await getActiveSemesterInfo(tenantId);
    if (!semester) return { semester: null, rows: [] };

    const rows = await db
        .select({
            subjectName: subject.name,
            className: classGroup.groupName,
            teacherName: schoolPerson.fullName,
            sessionCount: sql<number>`cast(count(distinct ${attendanceSession.id}) as int)`,
            hadir: sql<number>`cast(count(${attendanceRecord.id}) filter (where ${attendanceRecord.status} = 'hadir') as int)`,
            izin: sql<number>`cast(count(${attendanceRecord.id}) filter (where ${attendanceRecord.status} = 'izin') as int)`,
            sakit: sql<number>`cast(count(${attendanceRecord.id}) filter (where ${attendanceRecord.status} = 'sakit') as int)`,
            alpa: sql<number>`cast(count(${attendanceRecord.id}) filter (where ${attendanceRecord.status} = 'alpa') as int)`,
        })
        .from(attendanceRecord)
        .innerJoin(
            attendanceSession,
            and(
                eq(attendanceSession.tenantId, attendanceRecord.tenantId),
                eq(attendanceSession.id, attendanceRecord.sessionId),
            ),
        )
        .innerJoin(
            teachingSlot,
            and(
                eq(teachingSlot.tenantId, attendanceSession.tenantId),
                eq(teachingSlot.id, attendanceSession.slotId),
                // Semester binding (wayfinder 03): slot flag must match.
                eq(teachingSlot.semester, semester.kind),
            ),
        )
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
            classGroup,
            and(eq(classGroup.tenantId, teachingAssignment.tenantId), eq(classGroup.id, teachingAssignment.classGroupId)),
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
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.layer, "kelas"),
                between(attendanceSession.sessionDate, semester.startDate, semester.endDate),
                options.studentId ? eq(attendanceRecord.studentId, options.studentId) : undefined,
            ),
        )
        .groupBy(subject.name, classGroup.groupName, schoolPerson.fullName)
        .orderBy(subject.name, classGroup.groupName);

    return {
        semester,
        rows: rows.map((row) => {
            const hadir = Number(row.hadir ?? 0);
            const izin = Number(row.izin ?? 0);
            const sakit = Number(row.sakit ?? 0);
            const alpa = Number(row.alpa ?? 0);
            const total = hadir + izin + sakit + alpa;
            return {
                subjectName: row.subjectName,
                className: row.className,
                teacherName: row.teacherName,
                sessionCount: Number(row.sessionCount ?? 0),
                hadir,
                izin,
                sakit,
                alpa,
                attendanceRate: total > 0 ? hadir / total : 0,
            };
        }),
    };
}

/** Record view with lesson context for a single student (Absensi Saya). */
export type KelasStudentRecordWithContext = {
    id: string;
    status: AttendanceRecordStatus;
    recordedAt: Date;
    notes: string | null;
    outOfSession: boolean;
    /** True when the system actor wrote the record (auto-alpa fill). */
    bySystem: boolean;
    slotStart: string | null;
    subjectName: string | null;
    teacherName: string | null;
};

/**
 * A student's Kelas records over the last `days` civil days (newest first),
 * joined with the lesson context of their session (wayfinder 07 decision 1).
 * Records without a session keep null context so "—" renders instead of
 * dropping the row. `bySystem` marks system-written records (auto-alpa).
 */
export async function listKelasRecordsForStudentWithContext(
    tenantId: string,
    studentId: string,
    days = 30,
    timezone: string = "Asia/Jakarta",
): Promise<KelasStudentRecordWithContext[]> {
    const todayStart = zonedWallClockToUtc(
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0)),
        timezone,
    );
    const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000); // start of tomorrow
    const start = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const rows = await db
        .select({
            id: attendanceRecord.id,
            status: attendanceRecord.status,
            recordedAt: attendanceRecord.recordedAt,
            notes: attendanceRecord.notes,
            outOfSession: attendanceRecord.outOfSession,
            recordedByUserId: attendanceRecord.recordedByUserId,
            slotStart: teachingSlot.startTime,
            subjectName: subject.name,
            teacherName: schoolPerson.fullName,
        })
        .from(attendanceRecord)
        .leftJoin(
            attendanceSession,
            and(
                eq(attendanceSession.tenantId, attendanceRecord.tenantId),
                eq(attendanceSession.id, attendanceRecord.sessionId),
            ),
        )
        .leftJoin(
            teachingSlot,
            and(eq(teachingSlot.tenantId, attendanceSession.tenantId), eq(teachingSlot.id, attendanceSession.slotId)),
        )
        .leftJoin(
            teachingAssignment,
            and(
                eq(teachingAssignment.tenantId, teachingSlot.tenantId),
                eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
            ),
        )
        .leftJoin(
            subject,
            and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)),
        )
        .leftJoin(
            teacherProfile,
            and(
                eq(teacherProfile.tenantId, teachingAssignment.tenantId),
                eq(teacherProfile.id, teachingAssignment.teacherProfileId),
            ),
        )
        .leftJoin(
            schoolPerson,
            and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)),
        )
        .where(
            and(
                eq(attendanceRecord.tenantId, tenantId),
                eq(attendanceRecord.layer, "kelas"),
                eq(attendanceRecord.studentId, studentId),
                between(attendanceRecord.recordedAt, start, end),
            ),
        )
        .orderBy(desc(attendanceRecord.recordedAt));

    return rows.map((row) => ({
        id: row.id,
        status: row.status,
        recordedAt: row.recordedAt,
        notes: row.notes,
        outOfSession: row.outOfSession,
        bySystem: row.recordedByUserId === null,
        slotStart: row.slotStart ?? null,
        subjectName: row.subjectName ?? null,
        teacherName: row.teacherName ?? null,
    }));
}
