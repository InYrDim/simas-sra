"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { recordQrAction } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Spinner } from "@/components/ui/spinner";
import { Camera, CheckCircle2, XCircle } from "lucide-react";

type ScanState =
    | { kind: "idle" }
    | { kind: "scanning"; token: string | null }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string };

export function ScanAbsensiClient({ domain, sessionId }: { domain: string; sessionId: string }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanningRef = useRef(false);
    const [state, setState] = useState<ScanState>({ kind: "idle" });
    const [cameraError, setCameraError] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        scanningRef.current = false;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        setState({ kind: "scanning", token: null });
        scanningRef.current = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            await video.play();

            const detector = "BarcodeDetector" in window ? new (window as unknown as { BarcodeDetector: new () => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector() : null;
            const canvas = document.createElement("canvas");

            const tick = async () => {
                if (!scanningRef.current) return;
                if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                    requestAnimationFrame(tick);
                    return;
                }
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                    const codes = detector ? await detector.detect(canvas) : [];
                    if (codes.length > 0) {
                        const token = codes[0].rawValue;
                        setState({ kind: "scanning", token });
                        const result = await recordQrAction(domain, sessionId, token);
                        if (result.ok) {
                            setState({ kind: "success", message: result.status === "masuk" ? "Masuk tercatat" : "Keluar tercatat" });
                        } else {
                            setState({
                                kind: "error",
                                message:
                                    result.code === "wrong-tenant"
                                        ? "QR bukan milik sekolah ini."
                                        : result.code === "student-not-found"
                                          ? "Siswa tidak ditemukan."
                                          : result.code === "bad-token"
                                            ? "Format QR tidak valid."
                                            : "Gagal mencatat absensi.",
                            });
                        }
                        return;
                    }
                } catch {
                    // transient decode error; keep scanning
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        } catch {
            setCameraError("Tidak dapat mengakses kamera. Izinkan akses kamera dan coba lagi.");
            setState({ kind: "idle" });
        }
    }, [domain, sessionId]);

    useEffect(() => () => stopCamera(), [stopCamera]);

    return (
        <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-lg border bg-black aspect-video">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                {state.kind !== "scanning" && (
                    <div className="absolute inset-0 grid place-items-center text-white/80">
                        <Camera className="size-10" aria-hidden />
                    </div>
                )}
            </div>

            {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}

            {state.kind === "success" && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
                    <CheckCircle2 className="size-5" aria-hidden />
                    <span>{state.message}</span>
                </div>
            )}
            {state.kind === "error" && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                    <XCircle className="size-5" aria-hidden />
                    <span>{state.message}</span>
                </div>
            )}

            <div className="flex gap-2">
                {state.kind === "scanning" ? (
                    <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                        <Spinner /> Menghentikan kamera
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Camera className="size-4" aria-hidden />
                        Buka Kamera
                    </button>
                )}
                {(state.kind === "success" || state.kind === "error") && (
                    <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                        Scan Lagi
                    </button>
                )}
            </div>
        </div>
    );
}
