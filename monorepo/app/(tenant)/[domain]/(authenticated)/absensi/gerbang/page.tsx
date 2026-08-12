import { and, eq } from "drizzle-orm";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { listGerbangRecordsForDay } from "@/lib/attendance/attendance-record-data";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { ATTENDANCE_MODE_LABELS } from "@/lib/attendance/attendance-config";
import { db } from "@/db";
import { studentProfile, schoolPerson } from "@/db/schema";
import { GerbangRecordForm } from "./gerbang-record-form";

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

    const today = await listGerbangRecordsForDay(tenant.id);

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Absensi Gerbang</h1>
            <p className="text-muted-foreground">
                Mode {ATTENDANCE_MODE_LABELS[mode]}. Pilih siswa lalu catat Masuk atau Keluar.
            </p>

            <GerbangRecordForm domain={domain} students={students} />

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-3">Hari ini</h2>
                {today.length === 0 ? (
                    <p className="text-muted-foreground">Belum ada rekam Gerbang hari ini.</p>
                ) : (
                    <ul className="divide-y">
                        {today.map((record) => (
                            <li key={record.id} className="flex items-center justify-between py-2">
                                <span>{record.status === "masuk" ? "Masuk" : "Keluar"}</span>
                                <span className="text-muted-foreground text-sm">
                                    {record.recordedAt.toLocaleTimeString("id-ID")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
