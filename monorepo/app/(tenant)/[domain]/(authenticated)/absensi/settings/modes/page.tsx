import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { QrCode, CreditCard, PenLine } from "lucide-react";
import {
    ATTENDANCE_MODE_LABELS,
    ATTENDANCE_LAYERS,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";

const MODE_ICON: Record<AttendanceMode, typeof QrCode> = {
    qr: QrCode,
    kartu: CreditCard,
    manual: PenLine,
};

export default async function AbsensiModesPage({
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
    const allowedModes = config?.allowedModes ?? [];

    const layersUsing = (mode: AttendanceMode) =>
        ATTENDANCE_LAYERS.filter((layer) => config?.activeLayers[layer] === mode);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Mode Absensi</h1>
                <Link
                    href={`/${domain}/absensi/settings`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            {allowedModes.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Provider belum mengizinkan mode absensi apa pun untuk Tenant ini.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {allowedModes.map((mode) => {
                        const Icon = MODE_ICON[mode];
                        const usedBy = layersUsing(mode);
                        return (
                            <Link
                                key={mode}
                                href={`/${domain}/absensi/settings/modes/${mode}`}
                                className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:bg-muted"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="size-5" aria-hidden />
                                    <h2 className="text-lg font-semibold">{ATTENDANCE_MODE_LABELS[mode]}</h2>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {usedBy.length > 0
                                        ? `Digunakan pada: ${usedBy.join(", ")}.`
                                        : "Belum digunakan pada lapisan mana pun."}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
