import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";
import { buildStudentQrToken } from "@/lib/attendance/attendance-qr";
import { listGerbangRecordsForDayWithStudents, listGerbangRecordsForStudent, listKelasRecordsForDayWithStudents, listKelasRecordsForStudent, resolveOpenSession } from "@/lib/attendance/attendance-record-data";
import { localHHMMInZone, civilDateInZone } from "@/lib/attendance/attendance-date";
import { db } from "@/db";
import { studentProfile, schoolPerson, classMembership, classGroup } from "@/db/schema";
import { SiswaAbsensiQr } from "./siswa-absensi-qr";

export default async function AbsensiSayaPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureEnabled(domain, "absensi");

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.self.load";
    const result = await evaluator.evaluate({
        surface: "page",
        domain,
        operationId,
        context: {
            policy: "self",
            async evaluate(principal) {
                return { allowed: Boolean(principal.selfPersonId), arm: "self" as const };
            },
        },
    });
    const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) notFound();

    const selfPersonId = principal.selfPersonId;
    if (!selfPersonId) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Absensi Saya</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Akun ini belum terhubung dengan profil siswa. Hubungi admin sekolah.
                    </p>
                </div>
            </div>
        );
    }

    const [profile] = await db
        .select({ id: studentProfile.id, nis: studentProfile.nis, fullName: schoolPerson.fullName })
        .from(studentProfile)
        .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
        .where(and(eq(studentProfile.tenantId, tenant.id), eq(studentProfile.personId, selfPersonId), eq(studentProfile.status, "active")))
        .limit(1);

    if (!profile) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Absensi Saya</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Profil siswa tidak ditemukan untuk akun ini.
                    </p>
                </div>
            </div>
        );
    }

    const [rombel] = await db
        .select({ name: classGroup.groupName })
        .from(classMembership)
        .innerJoin(classGroup, eq(classGroup.id, classMembership.classGroupId))
        .where(and(eq(classMembership.tenantId, tenant.id), eq(classMembership.studentId, profile.id), sql`${classMembership.endedAt} IS NULL`))
        .limit(1);

    const config = await getAbsensiConfig(tenant.id);
    const qrEnabled = Boolean(config?.activeLayers.gerbang?.includes("qr")) && isTenantFeatureEnabled(tenant.settings, "absensiQr");
    const kelasEnabled = isTenantFeatureEnabled(tenant.settings, "absensiKelas") && (config?.activeLayers.kelas?.length ?? 0) > 0;
    const timezone = readTenantTimezone(tenant.settings);
    const openSession = qrEnabled ? await resolveOpenSession(tenant.id, "gerbang", new Date(), timezone) : null;
    const today = await listGerbangRecordsForDayWithStudents(tenant.id, new Date(), timezone);
    const myRecord = today.find((r) => r.studentId === profile.id);
    const todayCivil = civilDateInZone(new Date(), timezone);
    const history = (await listGerbangRecordsForStudent(tenant.id, profile.id, 30, timezone)).filter(
        (record) => civilDateInZone(record.recordedAt, timezone) !== todayCivil,
    );
    const kelasToday = kelasEnabled ? await listKelasRecordsForDayWithStudents(tenant.id, new Date(), timezone) : [];
    const myKelasRecord = kelasToday.find((r) => r.studentId === profile.id);
    const kelasHistory = kelasEnabled
        ? (await listKelasRecordsForStudent(tenant.id, profile.id, 30, timezone)).filter(
              (record) => civilDateInZone(record.recordedAt, timezone) !== todayCivil,
          )
        : [];
    const token = buildStudentQrToken(tenant.npsn, profile.nis);

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Absensi Saya</h1>
            <p className="text-muted-foreground">{profile.fullName} · NIS {profile.nis}{rombel ? ` · ${rombel.name}` : " · belum terikat rombel"}</p>
            <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                <h2 className="text-lg font-semibold">Absensi Gerbang</h2>
                <SiswaAbsensiQr
                    domain={domain}
                    qrEnabled={qrEnabled}
                    sessionOpen={Boolean(openSession)}
                    recordedStatus={myRecord?.status ?? null}
                    token={token}
                />
                <h3 className="mt-4 text-base font-semibold">Waktu Absensi Hari Ini</h3>
                {myRecord ? (
                    <p className="mt-2 text-muted-foreground">
                        Tercatat pada {localHHMMInZone(myRecord.recordedAt, timezone)}
                        {myRecord.outOfSession ? " (di luar sesi)" : ""}
                        {myRecord.notes ? ` · ${myRecord.notes}` : ""}
                    </p>
                ) : (
                    <p className="mt-2 text-muted-foreground">Belum ada absensi tercatat hari ini.</p>
                )}
                <h3 className="mt-4 text-base font-semibold">Riwayat Absensi</h3>
                {history.length > 0 ? (
                    <ul className="mt-2 divide-y text-sm">
                        {history.map((record) => (
                            <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                                <span className="font-medium">{civilDateInZone(record.recordedAt, timezone)}</span>
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{record.status}</span>
                                    <span>{localHHMMInZone(record.recordedAt, timezone)}</span>
                                    {record.outOfSession ? <span className="text-xs">· di luar sesi</span> : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 text-muted-foreground">Belum ada riwayat absensi.</p>
                )}
            </section>

            {kelasEnabled ? (
                <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                    <h2 className="text-lg font-semibold">Absensi Kelas</h2>
                    <h3 className="mt-4 text-base font-semibold">Waktu Absensi Hari Ini</h3>
                    {myKelasRecord ? (
                        <p className="mt-2 text-muted-foreground">
                            Tercatat pada {localHHMMInZone(myKelasRecord.recordedAt, timezone)}
                            {myKelasRecord.outOfSession ? " (di luar sesi)" : ""}
                            {myKelasRecord.notes ? ` · ${myKelasRecord.notes}` : ""}
                        </p>
                    ) : (
                        <p className="mt-2 text-muted-foreground">Belum ada absensi tercatat hari ini.</p>
                    )}
                    <h3 className="mt-4 text-base font-semibold">Riwayat Absensi</h3>
                    {kelasHistory.length > 0 ? (
                        <ul className="mt-2 divide-y text-sm">
                            {kelasHistory.map((record) => (
                                <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                                    <span className="font-medium">{civilDateInZone(record.recordedAt, timezone)}</span>
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{record.status}</span>
                                        <span>{localHHMMInZone(record.recordedAt, timezone)}</span>
                                        {record.outOfSession ? <span className="text-xs">· di luar sesi</span> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-muted-foreground">Belum ada riwayat absensi.</p>
                    )}
                </section>
            ) : null}
        </div>
    );
}
