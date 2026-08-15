import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { listAttendanceSessions } from "@/lib/attendance/attendance-record-data";
import { ATTENDANCE_LAYER_LABELS, ATTENDANCE_LAYERS, type AttendanceLayer } from "@/lib/attendance/attendance-config";

export default async function AbsensiHistoryPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.history.load";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const config = tenant ? await getAbsensiConfig(tenant.id) : null;
    const activeLayers = config
        ? ATTENDANCE_LAYERS.filter((layer): layer is AttendanceLayer => Boolean(config.activeLayers[layer]))
        : [];

    const sessions = tenant
        ? await listAttendanceSessions(tenant.id, { layers: activeLayers, limit: 50 })
        : [];

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Riwayat Absensi</h1>
                <Link
                    href={`/${domain}/absensi`}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali
                </Link>
            </div>

            {sessions.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Belum ada sesi absensi tercatat. Sesi yang dibuat di Gerbang atau Kelas akan
                        muncul di sini.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm divide-y">
                    {sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between gap-4 p-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{ATTENDANCE_LAYER_LABELS[session.layer]}</span>
                                    <span
                                        className={
                                            session.status === "open"
                                                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                                                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                        }
                                    >
                                        {session.status === "open" ? "Terbuka" : "Selesai"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {session.sessionDate} · {session.plannedStart}–{session.plannedEnd}
                                </p>
                                {session.notes && (
                                    <p className="mt-1 truncate text-xs text-muted-foreground">{session.notes}</p>
                                )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-sm font-medium">{session.recordCount} rekam</span>
                                <span className="text-xs text-muted-foreground">
                                    {session.openedAt.toLocaleTimeString("id-ID")}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
