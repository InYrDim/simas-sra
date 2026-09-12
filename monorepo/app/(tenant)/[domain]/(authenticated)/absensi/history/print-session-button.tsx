"use client";

import { Printer } from "lucide-react";

import {
    printAbsensiSession,
    type PrintableRecord,
    type PrintableSession,
} from "./absensi-session-printer";

export function PrintSessionButton({
    domain,
    session,
    records,
    timezone,
}: {
    domain: string;
    session: PrintableSession;
    records: PrintableRecord[];
    timezone?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => printAbsensiSession({ domain, session, records, timezone })}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
            <Printer className="size-4" aria-hidden />
            Cetak
        </button>
    );
}
