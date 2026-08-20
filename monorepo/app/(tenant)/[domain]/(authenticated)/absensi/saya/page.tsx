import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";
import { buildStudentQrToken } from "@/lib/attendance/attendance-qr";
import { listGerbangRecordsForDayWithStudents, resolveOpenSession } from "@/lib/attendance/attendance-record-data";
import { db } from "@/db";
import { studentProfile, schoolPerson } from "@/db/schema";
import { SiswaAbsensiQr } from "./siswa-absensi-qr";

export default async function AbsensiSayaPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureAccess(domain, "absensi", "read");

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

    const config = await getAbsensiConfig(tenant.id);
    const qrEnabled = Boolean(config?.activeLayers.gerbang) && isTenantFeatureEnabled(tenant.settings, "absensiQr");
    const timezone = readTenantTimezone(tenant.settings);
    const openSession = qrEnabled ? await resolveOpenSession(tenant.id, "gerbang", new Date(), timezone) : null;
    const today = await listGerbangRecordsForDayWithStudents(tenant.id, new Date(), timezone);
    const myRecord = today.find((r) => r.studentId === profile.id);
    const token = buildStudentQrToken(tenant.npsn, profile.nis);

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Absensi Saya</h1>
            <p className="text-muted-foreground">{profile.fullName} · NIS {profile.nis}</p>
            <SiswaAbsensiQr
                domain={domain}
                qrEnabled={qrEnabled}
                sessionOpen={Boolean(openSession)}
                recordedStatus={myRecord?.status ?? null}
                token={token}
            />
        </div>
    );
}
