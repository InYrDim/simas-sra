import { and, eq, sql } from "drizzle-orm";

import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import {
    ATTENDANCE_MODE_LABELS,
    ATTENDANCE_STATUS_LABELS,
    readTenantTimezone,
} from "@/lib/attendance/attendance-config";
import {
    listKelasRecordsForDayWithStudents,
} from "@/lib/attendance/attendance-record-data";
import {
    listKelasSessionsForDayWithSlotInfo,
    listHomeroomClassGroupIdsForUser,
    type KelasSessionSlotView,
} from "@/lib/attendance/attendance-kelas-data";
import {
    enforceKelasAttendancePageAccess,
} from "@/lib/attendance/attendance-kelas-access";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { db } from "@/db";
import { classMembership, schoolPerson, studentProfile } from "@/db/schema";
import { KelasRecordForm } from "./kelas-record-form";
import { KelasSlotList } from "./kelas-slot-list";
import { ScanAbsensiModal } from "../scan-absensi-modal";

type KelasSearchParams = {
    sessionId?: string;
    view?: string;
};

/**
 * Absensi Kelas in the per-Guru viewpoint (wayfinder 04, ticket 06): a Guru
 * lands on their own lessons of the day; the School Admin can toggle to the
 * per-Rombel viewpoint and sees every session. Wali Kelas (homeroom) get a
 * read-only view of their rombel's sessions. Sessions themselves come from
 * the slice-05 worker (or manual correction opens).
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
    const operationId = "absensi.kelas.load";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const principal = await enforceKelasAttendancePageAccess(domain, operationId);
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
    const timezone = readTenantTimezone(tenant.settings);
    const schoolAdmin = principal.schoolAdmin;
    const requestedView = sp.view === "rombel" ? "rombel" : sp.view === "guru" ? "guru" : null;
    // Admin defaults to the per-rombel supervisory view; teachers always per-guru.
    const view: "guru" | "rombel" = schoolAdmin
        ? (requestedView ?? "rombel")
        : "guru";

    // All sessions of the day with slot context, then scoped by viewpoint.
    let sessions = await listKelasSessionsForDayWithSlotInfo(tenant.id, timezone);
    if (view === "guru") {
        sessions = principal.teacherProfileId
            ? sessions.filter((s) => s.teacherProfileId === principal.teacherProfileId)
            : [];
    }

    // Homeroom-only users (no teaching assignments) see their rombel read-only.
    let homeroomClassGroupIds = new Set<string>();
    if (!schoolAdmin && !principal.teacherProfileId) {
        homeroomClassGroupIds = await listHomeroomClassGroupIdsForUser(tenant.id, principal.userId);
    }

    const selectedSessionId = sp.sessionId || "";
    const selectable: KelasSessionSlotView[] =
        view === "guru"
            ? sessions
            : homeroomClassGroupIds.size > 0 && !schoolAdmin
                ? sessions.filter((s) => homeroomClassGroupIds.has(s.classGroupId))
                : sessions;
    const activeSession =
        selectable.find((s) => s.id === selectedSessionId) ?? selectable.find((s) => s.status === "open") ?? null;

    // Mode gating: the manual record form only renders when "manual" is bound
    // to the Kelas layer in Pengaturan Absensi (activeLayers.kelas).
    const manualRecordEnabled = modes.includes("manual");

    // Write rights: School Admin (all) or the pengampu of that specific session.
    // Homeroom teachers are read-only (wayfinder 04).
    const canWrite = (session: KelasSessionSlotView | null): boolean => {
        if (!session) return false;
        if (schoolAdmin) return true;
        return Boolean(principal.teacherProfileId && session.teacherProfileId === principal.teacherProfileId);
    };

    // Roster of the active session's rombel.
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
    const writable = canWrite(activeSession);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Absensi Kelas</h1>
                <span className="text-sm text-muted-foreground">
                    Mode: {modes.map((m) => ATTENDANCE_MODE_LABELS[m]).join(", ")}
                </span>
            </div>

            {schoolAdmin ? (
                <form action={`/${domain}/absensi/kelas`} className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="sessionId" value={activeSession?.id ?? ""} />
                    <button
                        type="submit"
                        name="view"
                        value="guru"
                        className={`rounded-md border px-3 py-1.5 font-medium ${view === "guru" ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                    >
                        Per Guru
                    </button>
                    <button
                        type="submit"
                        name="view"
                        value="rombel"
                        className={`rounded-md border px-3 py-1.5 font-medium ${view === "rombel" ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                    >
                        Per Rombel
                    </button>
                </form>
            ) : null}

            {selectable.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        {view === "guru"
                            ? "Belum ada jadwal pelajaran Anda hari ini."
                            : "Belum ada sesi hari ini. Sesi dibuka otomatis dari Jadwal Mengajar saat jendela pelajaran dimulai."}
                    </p>
                </div>
            ) : (
                <KelasSlotList
                    domain={domain}
                    sessions={selectable}
                    activeSessionId={activeSession?.id ?? ""}
                    canWrite={canWrite}
                />
            )}

            {activeSession ? (
                <>
                    {writable && activeSession.status === "open" &&
                    isTenantFeatureEnabled(tenant.settings, "absensiQr") &&
                    modes.includes("qr") ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <ScanAbsensiModal domain={domain} sessionId={activeSession.id} layer="kelas" />
                        </div>
                    ) : null}

                    {writable ? (
                        manualRecordEnabled ? (
                            <KelasRecordForm
                                domain={domain}
                                sessionId={activeSession.id}
                                students={studentRows}
                                recordedStudentIds={recordedStudentIds}
                                disabled={activeSession.status === "closed"}
                            />
                        ) : activeSession.status === "open" ? (
                            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                                <p className="text-sm text-muted-foreground">
                                    Mode manual tidak aktif untuk lapisan Kelas. Aktifkan lewat Pengaturan Absensi
                                    untuk mencatat kehadiran lewat form.
                                </p>
                            </div>
                        ) : null
                    ) : (
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                            <p className="text-sm text-muted-foreground">
                                Anda melihat sesi ini sebagai Wali Kelas — hanya dapat melihat rekaman.
                            </p>
                        </div>
                    )}

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
