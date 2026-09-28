import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { listSchoolHolidays, listSchoolScheduleDays } from "@/lib/attendance/attendance-schedule-data";
import { GerbangScheduleForm } from "./gerbang-schedule-form";

/**
 * Jadwal Sekolah (relocated from /absensi/settings/schedule, ticket 07).
 * The gate intentionally stays on `absensiGerbang` — the gate follows the
 * data owner, so disabling Penjadwalan never locks Gerbang configuration.
 */
export default async function JadwalSekolahPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureEnabled(domain, "absensiGerbang");

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "jadwal.sekolah.load";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const days = tenant ? await listSchoolScheduleDays(tenant.id) : [];
    const holidays = tenant ? await listSchoolHolidays(tenant.id) : [];

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Jadwal Sekolah</h1>
                <Link
                    href={`/${domain}/jadwal/mengajar`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            <p className="text-sm text-muted-foreground">
                Jadwal ini dipakai absensi Gerbang: sesi Gerbang dibuka otomatis pada jam masuk
                dan ditutup pada jam pulang untuk hari yang efektif.
            </p>

            <GerbangScheduleForm domain={domain} days={days} holidays={holidays} />
        </div>
    );
}
