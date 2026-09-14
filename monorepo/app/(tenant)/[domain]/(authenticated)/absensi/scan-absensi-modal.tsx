"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { ScanAbsensiClient } from "@/app/(tenant)/[domain]/(authenticated)/scan/absensi/[sessionId]/scan-absensi-client";

export function ScanAbsensiModal({
    domain,
    sessionId,
    layer,
}: {
    domain: string;
    sessionId: string;
    layer: "gerbang" | "kelas";
}) {
    return (
        <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
                <QrCode className="size-4" aria-hidden />
                Scan QR
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Scan Absensi QR</DialogTitle>
                    <DialogDescription>
                        Arahkan kamera ke QR siswa untuk mencatat kehadiran.
                    </DialogDescription>
                </DialogHeader>
                <ScanAbsensiClient domain={domain} sessionId={sessionId} layer={layer} />
            </DialogContent>
        </Dialog>
    );
}
