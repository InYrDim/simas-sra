import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { listSchoolHolidays, listSchoolScheduleDays } from "@/lib/attendance/attendance-schedule-data";
import { GerbangScheduleForm } from "./gerbang-schedule-form";

export default async function AbsensiScheduleSettingsPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    await enforceTenantFeatureEnabled(domain, "absensiGerbang");

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.settings.save";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const days = tenant ? await listSchoolScheduleDays(tenant.id) : [];
    const holidays = tenant ? await listSchoolHolidays(tenant.id) : [];

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Jadwal Absensi Gerbang</h1>
                <Link
                    href={`/${domain}/absensi/settings`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            <GerbangScheduleForm domain={domain} days={days} holidays={holidays} />
        </div>
    );
}
