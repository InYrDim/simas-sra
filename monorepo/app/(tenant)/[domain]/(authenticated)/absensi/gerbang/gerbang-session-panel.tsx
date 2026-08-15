"use client";

import { useActionState, useTransition } from "react";

import {
    openGerbangSessionAction,
    closeGerbangSessionAction,
    deleteGerbangSessionAction,
    type OpenGerbangSessionResult,
    type CloseGerbangSessionResult,
    type DeleteGerbangSessionResult,
} from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type OpenSessionView = {
    id: string;
    plannedStart: string;
    plannedEnd: string;
    openedAt: Date;
} | null;

type TodaysSessionView = {
    id: string;
    status: "open" | "closed";
    plannedStart: string;
    plannedEnd: string;
    openedAt: Date;
} | null;

export function GerbangSessionPanel({
    domain,
    openSession,
    todaysSession,
}: {
    domain: string;
    openSession: OpenSessionView;
    todaysSession: TodaysSessionView;
}) {
    const [openState, openAction, openPending] = useActionState<OpenGerbangSessionResult, FormData>(
        () => openGerbangSessionAction(domain),
        { ok: true },
    );
    const [closeState, closeAction, closePending] = useActionState<CloseGerbangSessionResult, FormData>(
        () => closeGerbangSessionAction(domain, openSession?.id ?? ""),
        { ok: true },
    );
    const [deleteState, deleteAction, deletePending] = useActionState<DeleteGerbangSessionResult, FormData>(
        () => deleteGerbangSessionAction(domain, (openSession ?? todaysSession)?.id ?? ""),
        { ok: true },
    );
    const [, startTransition] = useTransition();

    if (openSession) {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sesi Gerbang Aktif</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Buka
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Jendela: {openSession.plannedStart}–{openSession.plannedEnd} · Dibuka{" "}
                    {openSession.openedAt.toLocaleTimeString("id-ID")}
                </p>
                {!closeState.ok && (
                    <p className="text-sm text-destructive" role="alert">
                        Gagal menutup sesi. Coba lagi.
                    </p>
                )}
                {!deleteState.ok && (
                    <p className="text-sm text-destructive" role="alert">
                        Gagal menghapus sesi. Coba lagi.
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    <form
                        action={(formData: FormData) => {
                            startTransition(() => {
                                closeAction(formData);
                            });
                        }}
                    >
                        <Button type="submit" variant="secondary" disabled={closePending}>
                            {closePending ? <Spinner /> : null}
                            Selesai Sesi
                        </Button>
                    </form>
                    <form
                        action={(formData: FormData) => {
                            startTransition(() => {
                                deleteAction(formData);
                            });
                        }}
                    >
                        <Button type="submit" variant="destructive" disabled={deletePending}>
                            {deletePending ? <Spinner /> : null}
                            Hapus Sesi
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // A session exists for today but is already closed: creating another is
    // blocked by the one-session-per-day rule, so surface that instead of the
    // create form (which would otherwise fail with "already-open").
    if (todaysSession && todaysSession.status === "closed") {
        return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sesi Gerbang</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        Selesai
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Sesi hari ini sudah ditutup (Jendela: {todaysSession.plannedStart}–
                    {todaysSession.plannedEnd}). Satu sesi per hari. Rekam di luar sesi akan
                    ditandai &ldquo;Luar Sesi&rdquo;.
                </p>
                {!deleteState.ok && (
                    <p className="text-sm text-destructive" role="alert">
                        Gagal menghapus sesi. Coba lagi.
                    </p>
                )}
                <form
                    action={(formData: FormData) => {
                        startTransition(() => {
                            deleteAction(formData);
                        });
                    }}
                >
                    <Button type="submit" variant="destructive" disabled={deletePending}>
                        {deletePending ? <Spinner /> : null}
                        Hapus Sesi
                    </Button>
                </form>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Sesi Gerbang</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    Tutup
                </span>
            </div>
            <p className="text-sm text-muted-foreground">
                Buat sesi untuk mencatat absensi dalam jendela waktu. Rekam di luar sesi akan
                ditandai &ldquo;Luar Sesi&rdquo;.
            </p>
            {!openState.ok && (
                <p className="text-sm text-destructive" role="alert">
                    {openState.code === "already-open"
                        ? "Sudah ada sesi yang terbuka hari ini."
                        : "Gagal membuat sesi. Coba lagi."}
                </p>
            )}
            <form action={openAction} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground">Mulai</span>
                        <input
                            type="time"
                            name="plannedStart"
                            defaultValue="06:00"
                            className="rounded-md border bg-input/30 px-2 py-1.5 text-sm"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground">Selesai</span>
                        <input
                            type="time"
                            name="plannedEnd"
                            defaultValue="07:30"
                            className="rounded-md border bg-input/30 px-2 py-1.5 text-sm"
                        />
                    </label>
                </div>
                <Button type="submit" disabled={openPending}>
                    {openPending ? <Spinner /> : null}
                    Buat Sesi
                </Button>
            </form>
        </div>
    );
}
