import { and, eq } from "drizzle-orm";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";
import { listGerbangRecordsForDayWithStudents, resolveOpenSession, resolveTodaysSession } from "@/lib/attendance/attendance-record-data";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { ATTENDANCE_MODE_LABELS } from "@/lib/attendance/attendance-config";
import { db } from "@/db";
import { studentProfile, schoolPerson } from "@/db/schema";
import { GerbangRecordForm } from "./gerbang-record-form";
import { GerbangSessionPanel } from "./gerbang-session-panel";

export default async function AbsensiGerbangPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureAccess(domain, "absensiGerbang", "read");

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const result = await evaluator.evaluate({ surface: "page", domain, operationId: "absensi.attendance.load" });
    enforceAuthorizedTenantOperation(result, { domain, operationId: "absensi.attendance.load" });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const config = tenant ? await getAbsensiConfig(tenant.id) : null;
    const mode = config?.activeLayers.gerbang;

    if (!tenant || !mode) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Absensi Gerbang</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Lapisan Gerbang belum diaktifkan di Pengaturan Absensi.
                    </p>
                </div>
            </div>
        );
    }

    const students = await db
        .select({
            id: studentProfile.id,
            nis: studentProfile.nis,
            fullName: schoolPerson.fullName,
        })
        .from(studentProfile)
        .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
        .where(
            and(
                eq(studentProfile.tenantId, tenant.id),
                eq(studentProfile.status, "active"),
                eq(studentProfile.archived, false),
            ),
        )
        .orderBy(schoolPerson.fullName);

    const timezone = readTenantTimezone(tenant.settings);
    const today = await listGerbangRecordsForDayWithStudents(tenant.id, new Date(), timezone);
    const openSession = await resolveOpenSession(tenant.id, "gerbang", new Date(), timezone);
    // Any session for today (open or closed) blocks creating a new one, so the
    // panel must reflect it instead of offering "Buat Sesi".
    const todaysSession = await resolveTodaysSession(tenant.id, "gerbang", new Date(), timezone);

    const inSession = today.filter((r) => !r.outOfSession);
    const outOfSession = today.filter((r) => r.outOfSession);

    // Students who already have a "masuk" record today cannot be picked again for entry.
    const alreadyMasukStudentIds = today
        .filter((r) => r.status === "masuk")
        .map((r) => r.studentId);

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Absensi Gerbang</h1>
            <p className="text-muted-foreground">
                Mode {ATTENDANCE_MODE_LABELS[mode]}. Pilih siswa lalu catat Masuk atau Keluar.
            </p>

            <GerbangSessionPanel
                domain={domain}
                openSession={
                    openSession
                        ? {
                            id: openSession.id,
                            plannedStart: openSession.plannedStart,
                            plannedEnd: openSession.plannedEnd,
                            openedAt: openSession.openedAt,
                        }
                        : null
                }
                todaysSession={
                    todaysSession
                        ? {
                            id: todaysSession.id,
                            status: todaysSession.status,
                            plannedStart: todaysSession.plannedStart,
                            plannedEnd: todaysSession.plannedEnd,
                            openedAt: todaysSession.openedAt,
                        }
                        : null
                }
            />

            {openSession ? (
                <>
                    <GerbangRecordForm
                        domain={domain}
                        students={students}
                        alreadyMasukStudentIds={alreadyMasukStudentIds}
                    />

                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-3">Hari ini</h2>
                        {today.length === 0 ? (
                            <p className="text-muted-foreground">Belum ada rekam Gerbang hari ini.</p>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                        Dalam Sesi ({inSession.length})
                                    </h3>
                                    <ul className="divide-y">
                                        {inSession.map((record) => (
                                            <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                                                <span className="min-w-0">
                                                    <span className="font-medium">{record.studentName}</span>
                                                    <span className="ml-2 text-xs text-muted-foreground">{record.nis}</span>
                                                </span>
                                                <span className="inline-flex shrink-0 items-center gap-2 text-sm">
                                                    <span>{record.status === "masuk" ? "Masuk" : record.status === "keluar" ? "Keluar" : record.status === "izin" ? "Izin" : "Sakit"}</span>
                                                    <span className="text-muted-foreground">
                                                        {record.recordedAt.toLocaleTimeString("id-ID")}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {outOfSession.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                            Luar Sesi ({outOfSession.length})
                                        </h3>
                                        <ul className="divide-y">
                                            {outOfSession.map((record) => (
                                                <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <span className="min-w-0">
                                                            <span className="font-medium">{record.studentName}</span>
                                                            <span className="ml-2 text-xs text-muted-foreground">{record.nis}</span>
                                                        </span>
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                            Luar Sesi
                                                        </span>
                                                    </span>
                                                    <span className="inline-flex shrink-0 items-center gap-2 text-sm">
                                                        <span>{record.status === "masuk" ? "Masuk" : record.status === "keluar" ? "Keluar" : record.status === "izin" ? "Izin" : "Sakit"}</span>
                                                        <span className="text-muted-foreground">
                                                            {record.recordedAt.toLocaleTimeString("id-ID")}
                                                        </span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Belum ada sesi Gerbang yang aktif. Buat sesi terlebih dahulu untuk mencatat absensi.
                    </p>
                </div>
            )}
        </div>
    );
}
