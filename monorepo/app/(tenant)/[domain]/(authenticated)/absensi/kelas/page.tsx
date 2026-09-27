import { and, eq, sql } from "drizzle-orm";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import {
    ATTENDANCE_MODE_LABELS,
    ATTENDANCE_STATUS_LABELS,
    readTenantTimezone,
} from "@/lib/attendance/attendance-config";
import { listKelasRecordsForDayWithStudents } from "@/lib/attendance/attendance-record-data";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { listKelasSessionsForDayWithSlotInfo } from "@/lib/attendance/attendance-kelas-data";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { db } from "@/db";
import { classMembership, schoolPerson, studentProfile } from "@/db/schema";
import { KelasRecordForm } from "./kelas-record-form";
import { KelasSlotList } from "./kelas-slot-list";
import { ScanAbsensiModal } from "../scan-absensi-modal";

type KelasSearchParams = {
    sessionId?: string;
};

/**
 * Absensi Kelas after wayfinder 04: a session belongs to one Teaching Slot
 * (identity = tenant + slotId + date), so the page shows one card per slot
 * session of the day instead of the single daily session. Sessions are born
 * from the schedule worker (or opened manually for corrections).
 */
export default async function AbsensiKelasPage({
    params,
    searchParams,
}: {
    params: Promise<{ domain: string }>;
    searchParams: Promise<KelasSearchParams>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureEnabled(domain, "absensiKelas");

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const result = await evaluator.evaluate({ surface: "page", domain, operationId: "absensi.attendance.load" });
    enforceAuthorizedTenantOperation(result, { domain, operationId: "absensi.attendance.load" });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const config = tenant ? await getAbsensiConfig(tenant.id) : null;
    const modes = config?.activeLayers.kelas;

    if (!tenant || !modes || modes.length === 0) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Absensi Kelas</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Lapisan Kelas belum diaktifkan di Pengaturan Absensi.
                    </p>
                </div>
            </div>
        );
    }

    const sp = await searchParams;
    const selectedSessionId = sp.sessionId || "";

    const timezone = readTenantTimezone(tenant.settings);

    // Every Kelas session of the day with slot context (subject/teacher/class).
    const sessions = await listKelasSessionsForDayWithSlotInfo(tenant.id, timezone);
    const activeSession =
        sessions.find((s) => s.id === selectedSessionId) ?? sessions.find((s) => s.status === "open") ?? null;

    // Roster of the active session's rombel (empty without an active session).
    const rombelId = activeSession?.classGroupId ?? null;
    const studentRows = rombelId
        ? await db
            .select({ id: studentProfile.id, nis: studentProfile.nis, fullName: schoolPerson.fullName })
            .from(studentProfile)
            .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
            .innerJoin(classMembership, and(
                eq(classMembership.tenantId, tenant.id),
                eq(classMembership.studentId, studentProfile.id),
                eq(classMembership.classGroupId, rombelId),
                sql`${classMembership.endedAt} IS NULL`,
            ))
            .where(and(eq(studentProfile.tenantId, tenant.id), eq(studentProfile.status, "active"), eq(studentProfile.archived, false)))
            .orderBy(schoolPerson.fullName)
        : [];

    const today = activeSession
        ? (await listKelasRecordsForDayWithStudents(tenant.id, new Date(), timezone, activeSession.classGroupId)).filter(
            (r) => r.sessionId === activeSession.id,
        )
        : [];
    const recordedStudentIds = today.filter((r) => r.status === "hadir").map((r) => r.studentId);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Absensi Kelas</h1>
                <span className="text-sm text-muted-foreground">
                    Mode: {modes.map((m) => ATTENDANCE_MODE_LABELS[m]).join(", ")}
                </span>
            </div>

            {sessions.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Belum ada sesi hari ini. Sesi dibuka otomatis dari Jadwal Mengajar saat jendela
                        pelajaran dimulai; Admin/Guru dapat membuka manual untuk koreksi.
                    </p>
                </div>
            ) : (
                <KelasSlotList domain={domain} sessions={sessions} activeSessionId={activeSession?.id ?? ""} />
            )}

            {activeSession ? (
                <>
                    {activeSession.status === "open" &&
                    isTenantFeatureEnabled(tenant.settings, "absensiQr") &&
                    modes.includes("qr") ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <ScanAbsensiModal domain={domain} sessionId={activeSession.id} layer="kelas" />
                        </div>
                    ) : null}

                    <KelasRecordForm domain={domain} sessionId={activeSession.id} students={studentRows} recordedStudentIds={recordedStudentIds} />

                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-3">
                            Rekap sesi{activeSession.className ? ` · ${activeSession.className}` : ""}
                        </h2>
                        {today.length === 0 ? (
                            <p className="text-muted-foreground">Belum ada rekam pada sesi ini.</p>
                        ) : (
                            <ul className="divide-y">
                                {today.map((record) => (
                                    <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                                        <span className="min-w-0">
                                            <span className="font-medium">{record.studentName}</span>
                                            <span className="ml-2 text-xs text-muted-foreground">{record.nis}</span>
                                            {record.rombel ? (
                                                <span className="ml-2 text-xs text-muted-foreground">{record.rombel}</span>
                                            ) : null}
                                        </span>
                                        <span className="inline-flex shrink-0 items-center gap-2 text-sm">
                                            <span>{ATTENDANCE_STATUS_LABELS[record.status]}</span>
                                            <span className="text-muted-foreground">{record.recordedAt.toLocaleTimeString("id-ID")}</span>
                                            {record.outOfSession ? <span className="text-xs text-amber-600">· Luar Sesi</span> : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
}
