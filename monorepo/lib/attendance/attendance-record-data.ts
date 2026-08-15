import "server-only";

/**
 * Server-only re-export surface for the Absensi (attendance) record data layer.
 *
 * The actual logic lives in `attendance-record-write` so it can be exercised by
 * MySQL integration tests (which run outside Next.js and therefore cannot import
 * `server-only`). This module is the boundary that server actions / routes must
 * import — it guarantees the write path is never reachable from client code.
 */
export {
    recordAttendance,
    resolveStudentIdentity,
    listGerbangRecordsForDay,
    listGerbangRecordsBySession,
    listAttendanceSessions,
    listSessionRecordsWithStudents,
    resolveOpenSession,
    resolveTodaysSession,
    openSession,
    closeSession,
    deleteSession,
    type RecordAttendanceInput,
    type RecordAttendanceResult,
    type OpenSessionInput,
    type OpenSessionResult,
    type CloseSessionResult,
    type DeleteSessionResult,
    type AttendanceSessionSummary,
    type SessionRecordView,
} from "@/lib/attendance/attendance-record-write";
