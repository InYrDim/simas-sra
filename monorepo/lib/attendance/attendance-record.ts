/**
 * Pure, framework-agnostic layer for validating Absensi (attendance) records.
 *
 * This module owns the status vocabulary and the invariant that a record's
 * `status` must be consistent with its `layer`. It has no dependency on the
 * database, Next.js, or the request scope, so it stays trivially unit-testable.
 *
 * The persisted shape lives in `db/schema.ts` (`attendance_record`), which
 * enforces the same invariant via a CHECK constraint.
 */

export const ATTENDANCE_RECORD_LAYERS = ["gerbang", "kelas"] as const;
export type AttendanceRecordLayer = (typeof ATTENDANCE_RECORD_LAYERS)[number];

export const ATTENDANCE_RECORD_MODES = ["manual", "qr", "kartu"] as const;
export type AttendanceRecordMode = (typeof ATTENDANCE_RECORD_MODES)[number];

/** Status values allowed for the Gerbang (gate) layer. */
export const GERBANG_STATUSES = ["masuk", "keluar"] as const;
/** Status values allowed for the Kelas (classroom) layer. */
export const KELAS_STATUSES = ["hadir", "izin", "sakit", "alpa"] as const;

export const ATTENDANCE_RECORD_STATUSES = [
    ...GERBANG_STATUSES,
    ...KELAS_STATUSES,
] as const;
export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number];

export function isAttendanceRecordLayer(value: unknown): value is AttendanceRecordLayer {
    return (
        typeof value === "string" &&
        (ATTENDANCE_RECORD_LAYERS as readonly string[]).includes(value)
    );
}

export function isAttendanceRecordMode(value: unknown): value is AttendanceRecordMode {
    return (
        typeof value === "string" &&
        (ATTENDANCE_RECORD_MODES as readonly string[]).includes(value)
    );
}

export function isAttendanceRecordStatus(value: unknown): value is AttendanceRecordStatus {
    return (
        typeof value === "string" &&
        (ATTENDANCE_RECORD_STATUSES as readonly string[]).includes(value)
    );
}

/**
 * Returns true when the given status is valid for the given layer. This is the
 * single source of truth mirrored by the `attendance_record_layer_status_check`
 * constraint in `db/schema.ts`.
 */
export function isStatusValidForLayer(
    layer: AttendanceRecordLayer,
    status: AttendanceRecordStatus,
): boolean {
    if (layer === "gerbang") return (GERBANG_STATUSES as readonly string[]).includes(status);
    return (KELAS_STATUSES as readonly string[]).includes(status);
}

/**
 * Validates a candidate attendance record. Returns a list of human-readable
 * error keys (empty when valid). Use this before any write so the server layer
 * can fail closed without relying solely on the database CHECK constraint.
 */
export function validateAttendanceRecord(input: {
    layer: unknown;
    mode: unknown;
    status: unknown;
}): string[] {
    const errors: string[] = [];
    if (!isAttendanceRecordLayer(input.layer)) errors.push("invalid-layer");
    if (!isAttendanceRecordMode(input.mode)) errors.push("invalid-mode");
    if (!isAttendanceRecordStatus(input.status)) {
        errors.push("invalid-status");
    } else if (isAttendanceRecordLayer(input.layer) && !isStatusValidForLayer(input.layer, input.status)) {
        errors.push("status-layer-mismatch");
    }
    return errors;
}
