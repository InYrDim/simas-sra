import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { attendanceSession } from "@/db/schema";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";
import { ATTENDANCE_LAYER_LABELS, ATTENDANCE_MODE_LABELS, ATTENDANCE_STATUS_LABELS } from "@/lib/attendance/attendance-config";
import { civilDateInZone, localHHMMInZone } from "@/lib/attendance/attendance-date";
import { listSessionRecordsWithStudents } from "@/lib/attendance/attendance-record-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PublicAbsensiMonitoringPage({
    params,
}: {
    params: Promise<{ domain: string }>;
}) {
    const { domain } = await params;
    const tenantRow = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenantRow) notFound();

    const timezone = readTenantTimezone(tenantRow.settings);
    const today = civilDateInZone(new Date(), timezone);

    // Auto-follow the currently open Gerbang session for today.
    const [session] = await db
        .select({
            id: attendanceSession.id,
            layer: attendanceSession.layer,
            sessionDate: attendanceSession.sessionDate,
            plannedStart: attendanceSession.plannedStart,
            plannedEnd: attendanceSession.plannedEnd,
            status: attendanceSession.status,
        })
        .from(attendanceSession)
        .where(
            and(
                eq(attendanceSession.tenantId, tenantRow.id),
                eq(attendanceSession.layer, "gerbang"),
                eq(attendanceSession.sessionDate, today),
                eq(attendanceSession.status, "open"),
            ),
        )
        .limit(1);

    if (!session) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-slate-50 p-6">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Monitoring Absensi
                    </p>
                    <h1 className="mt-1 text-xl font-bold text-slate-900">Gerbang</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        Belum ada sesi Gerbang yang aktif saat ini.
                    </p>
                </section>
            </main>
        );
    }

    const records = await listSessionRecordsWithStudents(tenantRow.id, session.id);

    const counts = records.reduce<Record<string, number>>((acc, rec) => {
        acc[rec.status] = (acc[rec.status] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <main className="min-h-svh bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-4xl space-y-4">
                <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Monitoring Absensi
                    </p>
                    <h1 className="mt-1 text-xl font-bold text-slate-900">
                        {ATTENDANCE_LAYER_LABELS[session.layer]}
                    </h1>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-slate-400">Tanggal</dt>
                            <dd className="font-medium text-slate-800">{session.sessionDate}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-400">Jendela</dt>
                            <dd className="font-medium text-slate-800">
                                {session.plannedStart}–{session.plannedEnd}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-400">Status</dt>
                            <dd className="font-medium text-slate-800">
                                {session.status === "open" ? "Terbuka" : "Selesai"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-400">Rekam</dt>
                            <dd className="font-medium text-slate-800">{records.length}</dd>
                        </div>
                    </dl>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">
                        Jumlah berdasarkan status
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(ATTENDANCE_STATUS_LABELS).map((status) => (
                            <span
                                key={status}
                                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                            >
                                {ATTENDANCE_STATUS_LABELS[status as keyof typeof ATTENDANCE_STATUS_LABELS]}
                                <span className="font-semibold">{counts[status] ?? 0}</span>
                            </span>
                        ))}
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>NIS</TableHead>
                                <TableHead>Kelas</TableHead>
                                <TableHead>Jam</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Lapisan</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-slate-400">
                                        Belum ada siswa yang absen pada sesi ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                records.map((rec) => (
                                    <TableRow key={rec.id}>
                                        <TableCell className="font-medium text-slate-800">
                                            {rec.studentName}
                                        </TableCell>
                                        <TableCell className="text-slate-600">{rec.nis}</TableCell>
                                        <TableCell className="text-slate-600">
                                            {rec.rombel ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {localHHMMInZone(rec.recordedAt, timezone)}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {ATTENDANCE_MODE_LABELS[rec.mode]}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {ATTENDANCE_LAYER_LABELS[session.layer]}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5">
                                                {ATTENDANCE_STATUS_LABELS[rec.status]}
                                                {rec.outOfSession && (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                        Luar Sesi
                                                    </span>
                                                )}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </section>
            </div>
        </main>
    );
}
