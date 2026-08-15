import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import {
    listAttendanceSessions,
    listSessionRecordsWithStudents,
} from "@/lib/attendance/attendance-record-data";
import {
    ATTENDANCE_LAYER_LABELS,
    ATTENDANCE_LAYERS,
    ATTENDANCE_MODE_LABELS,
    ATTENDANCE_MODES,
    ATTENDANCE_STATUS_LABELS,
    readTenantTimezone,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";
import { localHHMMInZone } from "@/lib/attendance/attendance-date";
import { db } from "@/db";
import { classGroup, academicYear, studentProfile } from "@/db/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MasterDataFilterForm } from "@/components/master-data/master-data-filter-form";
import { MasterDataDetailDialog } from "@/components/master-data/master-data-detail-dialog";
import { Hand, QrCode, IdCard, LayoutGrid } from "lucide-react";

type HistorySearchParams = {
    classGroupId?: string;
    entryYear?: string;
    from?: string;
    to?: string;
    mode?: string;
    session?: string;
};

export default async function AbsensiHistoryPage({
    params,
    searchParams,
}: {
    params: Promise<{ domain: string }>;
    searchParams: Promise<HistorySearchParams>;
}) {
    const { domain } = await params;
    const sp = await searchParams;

    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const operationId = "absensi.history.load";
    const result = await evaluator.evaluate({ surface: "page", domain, operationId });
    enforceAuthorizedTenantOperation(result, { domain, operationId });

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) {
        return <div className="p-4 text-muted-foreground">Tenant tidak ditemukan.</div>;
    }

    const config = await getAbsensiConfig(tenant.id);
    const activeLayers = ATTENDANCE_LAYERS.filter(
        (layer): layer is AttendanceLayer => Boolean(config.activeLayers[layer]),
    );
    const timezone = readTenantTimezone(tenant.settings);

    // Modes actually in use: each active layer is bound to one mode in config.
    const activeModes = ATTENDANCE_MODES.filter((mode): mode is AttendanceMode =>
        activeLayers.some((layer) => config.activeLayers[layer] === mode),
    );
    const modeFilter = sp.mode && activeModes.includes(sp.mode as AttendanceMode)
        ? (sp.mode as AttendanceMode)
        : null;

    // Option lists for the filters (independent of the active session filter).
    const [rombelOptions, entryYearOptions] = await Promise.all([
        db
            .select({ id: classGroup.id, name: classGroup.groupName })
            .from(classGroup)
            .innerJoin(academicYear, eq(academicYear.id, classGroup.academicYearId))
            .where(
                and(
                    eq(classGroup.tenantId, tenant.id),
                    eq(classGroup.lifecycle, "active"),
                    eq(classGroup.archived, false),
                    eq(academicYear.lifecycle, "active"),
                    eq(academicYear.archived, false),
                ),
            )
            .orderBy(classGroup.groupName),
        db
            .selectDistinct({ year: sql<string>`cast(year(${studentProfile.entryDate}) as char)` })
            .from(studentProfile)
            .where(eq(studentProfile.tenantId, tenant.id))
            .orderBy(desc(sql`cast(year(${studentProfile.entryDate}) as char)`)),
    ]);

    const sessions = await listAttendanceSessions(tenant.id, {
        layers: activeLayers,
        limit: 100,
        classGroupId: sp.classGroupId || undefined,
        entryYear: sp.entryYear || undefined,
        dateFrom: sp.from || undefined,
        dateTo: sp.to || undefined,
    }).then((rows) =>
        modeFilter
            ? rows.filter((s) => config.activeLayers[s.layer] === modeFilter)
            : rows,
    );

    const selectedSession = sp.session
        ? sessions.find((s) => s.id === sp.session) ?? null
        : null;
    const sessionRecords = selectedSession
        ? await listSessionRecordsWithStudents(tenant.id, selectedSession.id)
        : [];

    const basePath = `/${domain}/absensi/history`;
    const filterAction = basePath; // GET form; drops `session` so filtering closes the modal

    // Preserves every active filter except `session` (which closes the modal).
    const tabHref = (mode: string | null) => {
        const q = new URLSearchParams();
        if (sp.classGroupId) q.set("classGroupId", sp.classGroupId);
        if (sp.entryYear) q.set("entryYear", sp.entryYear);
        if (sp.from) q.set("from", sp.from);
        if (sp.to) q.set("to", sp.to);
        if (mode) q.set("mode", mode);
        const s = q.toString();
        return s ? `${basePath}?${s}` : basePath;
    };

    const modeIcon: Record<AttendanceMode, React.ReactNode> = {
        manual: <Hand className="size-4" aria-hidden />,
        qr: <QrCode className="size-4" aria-hidden />,
        kartu: <IdCard className="size-4" aria-hidden />,
    };

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

            <div className="flex flex-wrap gap-2">
                <Link
                    href={tabHref(null)}
                    className={
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium " +
                        (!modeFilter
                            ? "bg-primary text-primary-foreground"
                            : "border hover:bg-muted")
                    }
                >
                    <LayoutGrid className="size-4" aria-hidden />
                    Semua
                </Link>
                {activeModes.map((mode) => (
                    <Link
                        key={mode}
                        href={tabHref(mode)}
                        className={
                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium " +
                            (modeFilter === mode
                                ? "bg-primary text-primary-foreground"
                                : "border hover:bg-muted")
                        }
                    >
                        {modeIcon[mode]}
                        {ATTENDANCE_MODE_LABELS[mode]}
                    </Link>
                ))}
            </div>

            <MasterDataFilterForm action={filterAction} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Rombel</span>
                    <select
                        name="classGroupId"
                        defaultValue={sp.classGroupId ?? ""}
                        className="h-9 rounded-md border border-input bg-input/30 px-2 text-sm"
                    >
                        <option value="">Semua</option>
                        {rombelOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Tahun Masuk</span>
                    <select
                        name="entryYear"
                        defaultValue={sp.entryYear ?? ""}
                        className="h-9 rounded-md border border-input bg-input/30 px-2 text-sm"
                    >
                        <option value="">Semua</option>
                        {entryYearOptions.map((e) => (
                            <option key={e.year} value={e.year}>
                                {e.year}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Dari Tanggal</span>
                    <input
                        type="date"
                        name="from"
                        defaultValue={sp.from ?? ""}
                        className="h-9 rounded-md border border-input bg-input/30 px-2 text-sm"
                    />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Sampai Tanggal</span>
                    <input
                        type="date"
                        name="to"
                        defaultValue={sp.to ?? ""}
                        className="h-9 rounded-md border border-input bg-input/30 px-2 text-sm"
                    />
                </label>

                {(sp.classGroupId || sp.entryYear || sp.from || sp.to || sp.mode) && (
                    <Link
                        href={basePath}
                        className="h-9 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                        Reset
                    </Link>
                )}
            </MasterDataFilterForm>

            {sessions.length === 0 ? (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-muted-foreground">
                        Belum ada sesi absensi yang cocok dengan filter. Sesi yang dibuat di Gerbang
                        atau Kelas akan muncul di sini.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Lapisan</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Jendela</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Catatan</TableHead>
                                <TableHead className="text-right">Jumlah Rekam</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions.map((session) => {
                                const href = `${basePath}?${new URLSearchParams({
                                    ...(sp.classGroupId ? { classGroupId: sp.classGroupId } : {}),
                                    ...(sp.entryYear ? { entryYear: sp.entryYear } : {}),
                                    ...(sp.from ? { from: sp.from } : {}),
                                    ...(sp.to ? { to: sp.to } : {}),
                                    session: session.id,
                                }).toString()}`;
                                return (
                                    <TableRow key={session.id} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>
                                            <Link href={href} className="block">
                                                <span className="font-medium">
                                                    {ATTENDANCE_LAYER_LABELS[session.layer]}
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={href} className="block">
                                                {session.sessionDate}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={href} className="block text-muted-foreground">
                                                {session.plannedStart}–{session.plannedEnd}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={href} className="block">
                                                <span
                                                    className={
                                                        session.status === "open"
                                                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                                                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                                    }
                                                >
                                                    {session.status === "open" ? "Terbuka" : "Selesai"}
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={href} className="block truncate text-muted-foreground">
                                                {session.notes || "—"}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={href} className="block font-medium">
                                                {session.recordCount} rekam
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {selectedSession && (
                <MasterDataDetailDialog
                    closeHref={basePath}
                    title={`Detail Sesi ${ATTENDANCE_LAYER_LABELS[selectedSession.layer]} · ${selectedSession.sessionDate}`}
                    description={`${selectedSession.plannedStart}–${selectedSession.plannedEnd} · ${sessionRecords.length} rekam`}
                >
                    {sessionRecords.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Belum ada rekam terkait sesi ini.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>NIS</TableHead>
                                    <TableHead>Rombel</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessionRecords.map((rec) => (
                                    <TableRow key={rec.id}>
                                        <TableCell className="font-medium">{rec.studentName}</TableCell>
                                        <TableCell>{rec.nis}</TableCell>
                                        <TableCell>{rec.rombel ?? "—"}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <span>{ATTENDANCE_STATUS_LABELS[rec.status]}</span>
                                                {rec.outOfSession && (
                                                    <Badge variant="outline">Luar Sesi</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{localHHMMInZone(rec.recordedAt, timezone)}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {rec.notes || "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </MasterDataDetailDialog>
            )}
        </div>
    );
}
