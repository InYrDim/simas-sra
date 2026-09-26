import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { CalendarClock, Layers, QrCode, CreditCard, PenLine } from "lucide-react";
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

    const activeLayers = config
        ? ATTENDANCE_LAYERS.filter((layer) => Boolean(config.activeLayers[layer]))
        : [];

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

            {config && config.allowedLayers.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Provider belum mengizinkan mode atau lapisan absensi apa pun untuk Tenant ini.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <div className="flex items-center gap-2">
                            <Layers className="size-5" aria-hidden />
                            <h2 className="text-lg font-semibold">Lapisan Absensi</h2>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Aktifkan lapisan (Gerbang/Kelas) dan pilih mode pencatatannya.
                        </p>
                        <Link
                            href={`/${domain}/absensi/settings/layers`}
                            className="mt-4 inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        >
                            Atur lapisan
                        </Link>
                    </section>

                    <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <div className="flex items-center gap-2">
                            <QrCode className="size-5" aria-hidden />
                            <h2 className="text-lg font-semibold">Mode Absensi</h2>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Atur pesan dan jendela pindai untuk tiap mode yang diizinkan Provider.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {config?.allowedModes.map((mode) => {
                                const Icon = MODE_ICON[mode];
                                return (
                                    <Link
                                        key={mode}
                                        href={`/${domain}/absensi/settings/modes/${mode}`}
                                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                                    >
                                        <Icon className="size-4" aria-hidden />
                                        {ATTENDANCE_MODE_LABELS[mode]}
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {activeLayers.includes("gerbang") ? (
                        <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="size-5" aria-hidden />
                                <h2 className="text-lg font-semibold">Jadwal Sekolah (Gerbang)</h2>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Atur jam masuk/pulang per hari dan tanggal libur. Sesi Gerbang dibuka dan ditutup
                                otomatis mengikuti jadwal; sesi manual tetap bisa dibuat kapan saja.
                            </p>
                            <Link
                                href={`/${domain}/absensi/settings/schedule`}
                                className="mt-4 inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                            >
                                Atur jadwal
                            </Link>
                        </section>
                    ) : null}
                </div>
            )}

            {activeLayers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    Lapisan aktif: {activeLayers.join(", ")}.
                </p>
            )}
        </div>
    );
}
