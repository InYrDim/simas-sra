import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { ATTENDANCE_MODE_LABELS } from "@/lib/attendance/attendance-config";

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

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-bold">Absensi Gerbang</h1>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <p className="text-muted-foreground">
                    {mode
                        ? `Lapisan Gerbang aktif dengan mode ${ATTENDANCE_MODE_LABELS[mode]}. Pencatatan absensi Gerbang sedang dalam pengembangan.`
                        : "Lapisan Gerbang belum diaktifkan di Pengaturan Absensi."}
                </p>
            </div>
        </div>
    );
}
