import Link from "next/link";

import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { getSessionById } from "@/lib/attendance/attendance-record-data";
import { ScanAbsensiClient } from "./scan-absensi-client";

export default async function ScanAbsensiPage({
    params,
}: {
    params: Promise<{ domain: string; sessionId: string }>;
}) {
    const { domain, sessionId } = await params;
    await enforceTenantFeatureAccess(domain, "absensiQr", "read");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    const session = tenant ? await getSessionById(tenant.id, sessionId) : null;

    if (!tenant || !session) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Scan Absensi QR</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Sesi absensi tidak ditemukan. Pastikan sesi sudah dibuat dan masih aktif.
                    </p>
                    <Link
                        href={`/${domain}/absensi/${session?.layer ?? "gerbang"}`}
                        className="mt-4 inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                        Kembali ke Absensi
                    </Link>
                </div>
            </div>
        );
    }

    if (session.status !== "open" || (session.layer !== "gerbang" && session.layer !== "kelas")) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-bold">Scan Absensi QR</h1>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Sesi tidak dapat dipindai. Sesi harus berstatus aktif dan berlapis Gerbang atau Kelas.
                    </p>
                    <Link
                        href={`/${domain}/absensi/${session.layer}`}
                        className="mt-4 inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                        Kembali ke Absensi
                    </Link>
                </div>
            </div>
        );
    }

    const isKelas = session.layer === "kelas";

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-bold">Scan Absensi QR</h1>
                <Link
                    href={`/${domain}/absensi/${session.layer}`}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                    Kembali ke Absensi {isKelas ? "Kelas" : "Gerbang"}
                </Link>
            </div>
            <p className="text-muted-foreground">
                Arahkan kamera ke QR siswa untuk mencatat kehadiran {isKelas ? "Kelas" : "Gerbang"}.
            </p>
            <ScanAbsensiClient domain={domain} sessionId={session.id} layer={session.layer} />
        </div>
    );
}
