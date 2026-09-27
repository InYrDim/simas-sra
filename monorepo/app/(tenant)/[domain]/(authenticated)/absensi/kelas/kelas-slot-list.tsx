"use client";

import { useActionState, useTransition } from "react";

import {
    closeKelasSessionAction,
    deleteKelasSessionAction,
    type CloseKelasSessionResult,
    type DeleteKelasSessionResult,
} from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, CircleSlash, Clock, GraduationCap, User } from "lucide-react";
import type { KelasSessionSlotView } from "@/lib/attendance/attendance-kelas-data";

/**
 * Per-slot session list for the Absensi Kelas page (wayfinder 04: sessions are
 * per Teaching Slot). Selecting a card navigates back to the page with
 * ?sessionId=… so the server renders that slot's roster and records.
 */
export function KelasSlotList({
    domain,
    sessions,
    activeSessionId,
}: {
    domain: string;
    sessions: KelasSessionSlotView[];
    activeSessionId: string;
}) {
    const [closeState, closeAction, closePending] = useActionState<CloseKelasSessionResult, FormData>(
        () => closeKelasSessionAction(domain, activeSessionId),
        { ok: true },
    );
    const [deleteState, deleteAction, deletePending] = useActionState<DeleteKelasSessionResult, FormData>(
        () => deleteKelasSessionAction(domain, activeSessionId),
        { ok: true },
    );
    const [, startTransition] = useTransition();
    const active = sessions.find((s) => s.id === activeSessionId) ?? null;

    return (
        <div className="space-y-3">
            <ul className="grid gap-2 md:grid-cols-2">
                {sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                        <li key={session.id}>
                            <a
                                href={`/${domain}/absensi/kelas?sessionId=${session.id}`}
                                className={`block rounded-lg border bg-card text-card-foreground shadow-sm p-4 transition-colors hover:bg-muted/40 ${isActive ? "border-primary" : ""}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-2 font-medium truncate">
                                        <Clock aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        {session.plannedStart}–{session.plannedEnd}
                                    </span>
                                    {session.status === "open" ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 border-transparent">
                                            <CheckCircle2 aria-hidden className="h-3 w-3" />
                                            Buka
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            <CircleSlash aria-hidden className="h-3 w-3" />
                                            Selesai
                                        </Badge>
                                    )}
                                </div>
                                <p className="mt-2 truncate text-sm">{session.subjectName}</p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <GraduationCap aria-hidden className="h-3.5 w-3.5" />
                                        {session.className}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <User aria-hidden className="h-3.5 w-3.5" />
                                        {session.teacherName}
                                    </span>
                                </p>
                            </a>
                        </li>
                    );
                })}
            </ul>

            {active && active.status === "open" ? (
                <div className="flex flex-wrap items-center gap-2">
                    <form
                        action={(formData: FormData) => {
                            startTransition(() => {
                                closeAction(formData);
                            });
                        }}
                    >
                        <Button type="submit" variant="secondary" size="sm" disabled={closePending}>
                            {closePending ? <Spinner /> : null}
                            Tutup Sesi Ini
                        </Button>
                    </form>
                    <form
                        action={(formData: FormData) => {
                            startTransition(() => {
                                deleteAction(formData);
                            });
                        }}
                    >
                        <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
                            {deletePending ? <Spinner /> : null}
                            Hapus Sesi Ini
                        </Button>
                    </form>
                    {!closeState.ok ? (
                        <p className="text-sm text-destructive" role="alert">
                            Gagal menutup sesi. Coba lagi.
                        </p>
                    ) : null}
                    {!deleteState.ok ? (
                        <p className="text-sm text-destructive" role="alert">
                            Gagal menghapus sesi. Coba lagi.
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
