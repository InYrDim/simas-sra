import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { readAbsensiSettings } from "@/lib/attendance/attendance-config";
import { QrCode, CreditCard, PenLine } from "lucide-react";
import {
    ATTENDANCE_MODE_LABELS,
    ATTENDANCE_LAYERS,
    isAttendanceMode,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";
import { ModeSettingsForm } from "@/app/(tenant)/[domain]/(authenticated)/absensi/settings/modes/mode-settings-form";

const MODE_ICON: Record<AttendanceMode, typeof QrCode> = {
    qr: QrCode,
    kartu: CreditCard,
    manual: PenLine,
};

export default async function AbsensiModePage({
    params,
}: {
    params: Promise<{ domain: string; mode: string }>;
}) {
    const { domain, mode } = await params;
    if (!isAttendanceMode(mode)) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Mode Absensi</h1>
                <p className="text-muted-foreground">Mode tidak dikenal.</p>
                <Link
                    href={`/${domain}/absensi/settings/modes`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali ke Mode Absensi
                </Link>
            </div>
        );
    }

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.settings.save";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const config = tenant ? await getAbsensiConfig(tenant.id) : null;
    if (!config || !config.allowedModes.includes(mode)) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Mode {ATTENDANCE_MODE_LABELS[mode]}</h1>
                <p className="text-muted-foreground">
                    Mode ini tidak diizinkan oleh Provider untuk Tenant ini.
                </p>
                <Link
                    href={`/${domain}/absensi/settings/modes`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali ke Mode Absensi
                </Link>
            </div>
        );
    }

    const settings = tenant ? readAbsensiSettings(tenant.settings) : null;
    const modeSettings = settings?.modeSettings?.[mode];
    const usedBy = ATTENDANCE_LAYERS.filter((layer) => config.activeLayers[layer]?.includes(mode));
    const Icon = MODE_ICON[mode];

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="size-5" aria-hidden />
                    <h1 className="text-2xl font-bold">Mode {ATTENDANCE_MODE_LABELS[mode]}</h1>
                </div>
                <Link
                    href={`/${domain}/absensi/settings/modes`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            <p className="text-sm text-muted-foreground">
                {usedBy.length > 0
                    ? `Digunakan pada lapisan: ${usedBy.join(", ")}.`
                    : "Belum digunakan pada lapisan mana pun."}
            </p>

            <ModeSettingsForm
                domain={domain}
                mode={mode}
                message={modeSettings?.message ?? ""}
                scanStart={modeSettings?.scanWindow?.start ?? ""}
                scanEnd={modeSettings?.scanWindow?.end ?? ""}
            />
        </div>
    );
}
