import { and, between, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { studentProfile, attendanceRecord } from "@/db/schema";
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
 * Persists an attendance record. Fails closed on any invariant violation so the
 * database CHECK constraint is a backstop, not the only guard.
 */
export async function recordAttendance(
    input: RecordAttendanceInput,
): Promise<RecordAttendanceResult> {
    if (!isAttendanceRecordStatus(input.status) || !isStatusValidForLayer(input.layer, input.status)) {
        return { ok: false, code: "invalid-status" };
    }

    const resolved = await resolveStudentIdentity(input.tenantId, input.studentId);
    if (!resolved) return { ok: false, code: "student-not-found" };

    const id = randomUUID();
    const now = input.recordedAt ?? new Date();
    try {
        await db.insert(attendanceRecord).values({
            id,
            tenantId: input.tenantId,
            studentId: resolved.studentId,
            layer: input.layer,
            mode: input.mode,
            recordedAt: now,
            status: input.status,
            recordedByUserId: input.actorUserId,
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
): Promise<
    Array<{
        id: string;
        studentId: string;
        status: AttendanceRecordStatus;
        recordedAt: Date;
        recordedByUserId: string;
        notes: string | null;
    }>
> {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    return db
        .select({
            id: attendanceRecord.id,
            studentId: attendanceRecord.studentId,
            status: attendanceRecord.status,
            recordedAt: attendanceRecord.recordedAt,
            recordedByUserId: attendanceRecord.recordedByUserId,
            notes: attendanceRecord.notes,
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
