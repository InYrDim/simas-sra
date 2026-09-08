"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";

type Props = {
    domain: string;
    qrEnabled: boolean;
    sessionOpen: boolean;
    recordedStatus: "masuk" | "keluar" | "hadir" | "izin" | "sakit" | "alpa" | null;
    token: string;
    /** Layer label used in user-facing copy. Defaults to "Gerbang". */
    layerLabel?: string;
};

export function SiswaAbsensiQr({ qrEnabled, sessionOpen, recordedStatus, token, layerLabel = "Gerbang" }: Props) {
    const router = useRouter();
    const [generating, setGenerating] = useState(false);

    // Poll for the operator's scan result once a session is open and not yet recorded.
    useEffect(() => {
        if (!qrEnabled || !sessionOpen || recordedStatus) return;
        const id = setInterval(() => router.refresh(), 5000);
        return () => clearInterval(id);
    }, [qrEnabled, sessionOpen, recordedStatus, router]);

    if (!qrEnabled) {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <p className="text-muted-foreground">
                    Mode QR belum diaktifkan untuk lapisan {layerLabel}. Hubungi admin sekolah.
                </p>
            </div>
        );
    }

    if (recordedStatus) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
                <p className="text-lg font-semibold">
                    Absensi berhasil{recordedStatus === "masuk" ? " (Masuk)" : recordedStatus === "keluar" ? " (Keluar)" : ` (${recordedStatus})`}
                </p>
            </div>
        );
    }

    if (!sessionOpen) {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <p className="text-muted-foreground">
                    Belum ada sesi absensi {layerLabel.toLowerCase()} yang dibuka. Tunggu operator membuka sesi.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <p className="text-muted-foreground">Tunjukkan QR ini ke operator untuk dipindai.</p>
            <button
                type="button"
                onClick={() => {
                    setGenerating(true);
                    router.refresh();
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="h-4 w-4" aria-hidden />}
                Generate QR
            </button>
            <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={token} size={220} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Halaman ini akan otomatis memperbarui setelah absensi tercatat.</p>
        </div>
    );
}
