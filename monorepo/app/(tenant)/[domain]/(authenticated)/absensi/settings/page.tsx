import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { AbsensiSettingsForm } from "@/app/(tenant)/[domain]/(authenticated)/absensi/settings/absensi-settings-form";

export default async function AbsensiSettingsPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.settings.save";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const config = tenant ? await getAbsensiConfig(tenant.id) : null;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Pengaturan Absensi</h1>
                <Link
                    href={`/${domain}/absensi`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            <p className="text-sm text-muted-foreground">
                Pilih lapisan absensi yang aktif, lalu tentukan mode pencatatannya. Mode dan lapisan
                yang tidak diizinkan oleh Provider tidak dapat diaktifkan.
            </p>

            {config && config.allowedLayers.length > 0 ? (
                <AbsensiSettingsForm
                    domain={domain}
                    allowedModes={config.allowedModes}
                    allowedLayers={config.allowedLayers}
                    activeLayers={config.activeLayers}
                />
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Provider belum mengizinkan mode atau lapisan absensi apa pun untuk Tenant ini.
                    </p>
                </div>
            )}
        </div>
    );
}
