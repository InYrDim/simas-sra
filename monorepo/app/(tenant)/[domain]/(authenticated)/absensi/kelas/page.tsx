import { and, eq, sql } from "drizzle-orm";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { readTenantTimezone, ATTENDANCE_STATUS_LABELS, ATTENDANCE_MODE_LABELS } from "@/lib/attendance/attendance-config";
import {
    listKelasRecordsForDayWithStudents,
    resolveOpenSession,
    resolveTodaysSession,
} from "@/lib/attendance/attendance-record-data";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { db } from "@/db";
import { classGroup, academicYear, studentProfile, schoolPerson, classMembership } from "@/db/schema";
import { KelasRecordForm } from "./kelas-record-form";
import { KelasSessionPanel } from "./kelas-session-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type KelasSearchParams = {
    classGroupId?: string;
};

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
    const selectedRombel = sp.classGroupId || "";

    // Active rombel options for the picker (active academic year, not archived).
    const rombelOptions = await db
        .select({ id: classGroup.id, name: classGroup.groupName })
        .from(classGroup)
        .innerJoin(academicYear, eq(academicYear.id, classGroup.academicYearId))
        .where(
            and(
                eq(classGroup.tenantId, tenant.id),
                eq(classGroup.lifecycle, "active"),
                eq(classGroup.archived, false),
                eq(academicYear.lifecycle, "active"),
                eq(academicYear.archived, false),
            ),
        )
        .orderBy(classGroup.groupName);

    const timezone = readTenantTimezone(tenant.settings);
    const openSession = await resolveOpenSession(tenant.id, "kelas", new Date(), timezone);
    const todaysSession = await resolveTodaysSession(tenant.id, "kelas", new Date(), timezone);

    // Students in the selected rombel (or all active students when none chosen).
    const studentRows = selectedRombel
        ? await db
            .select({ id: studentProfile.id, nis: studentProfile.nis, fullName: schoolPerson.fullName })
            .from(studentProfile)
            .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
            .innerJoin(classMembership, and(
                eq(classMembership.tenantId, tenant.id),
                eq(classMembership.studentId, studentProfile.id),
                eq(classMembership.classGroupId, selectedRombel),
                sql`${classMembership.endedAt} IS NULL`,
            ))
            .where(and(eq(studentProfile.tenantId, tenant.id), eq(studentProfile.status, "active"), eq(studentProfile.archived, false)))
            .orderBy(schoolPerson.fullName)
        : await db
            .select({ id: studentProfile.id, nis: studentProfile.nis, fullName: schoolPerson.fullName })
            .from(studentProfile)
            .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
            .innerJoin(classMembership, and(
                eq(classMembership.tenantId, tenant.id),
                eq(classMembership.studentId, studentProfile.id),
                sql`${classMembership.endedAt} IS NULL`,
            ))
    const today = await listKelasRecordsForDayWithStudents(tenant.id, new Date(), timezone, selectedRombel || undefined);
    const recordedStudentIds = today.filter((r) => r.status === "hadir").map((r) => r.studentId);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Absensi Kelas</h1>
                <span className="text-sm text-muted-foreground">
                    Mode: {modes.map((m) => ATTENDANCE_MODE_LABELS[m]).join(", ")}
                </span>
            </div>

            <form action={`/${domain}/absensi/kelas`} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Rombel</span>
                    <Select name="classGroupId" defaultValue={selectedRombel}>
                        <SelectTrigger className="h-9 w-56 bg-input/30">
                            <SelectValue placeholder="Semua siswa" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Semua siswa</SelectItem>
                            {rombelOptions.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>
                <button type="submit" className="h-9 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    Tampilkan
                </button>
            </form>

            <KelasSessionPanel
                domain={domain}
                openSession={
                    openSession
                        ? { id: openSession.id, plannedStart: openSession.plannedStart, plannedEnd: openSession.plannedEnd, openedAt: openSession.openedAt }
                        : null
                }
                todaysSession={
                    todaysSession
                        ? { id: todaysSession.id, status: todaysSession.status, plannedStart: todaysSession.plannedStart, plannedEnd: todaysSession.plannedEnd, openedAt: todaysSession.openedAt }
                        : null
                }
            />

            {openSession ? (
                <KelasRecordForm domain={domain} students={studentRows} recordedStudentIds={recordedStudentIds} />
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Buat sesi terlebih dahulu untuk mencatat absensi kelas.
                    </p>
                </div>
            )}

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-3">Hari ini{selectedRombel ? ` · ${rombelOptions.find((r) => r.id === selectedRombel)?.name ?? ""}` : ""}</h2>
                {today.length === 0 ? (
                    <p className="text-muted-foreground">Belum ada rekam Kelas hari ini.</p>
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
        </div>
    );
}
