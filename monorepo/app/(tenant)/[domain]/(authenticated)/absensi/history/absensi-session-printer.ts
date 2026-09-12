// Client-safe printer for a single attendance session. Mirrors the PPDB
// printer pattern: build a hidden A4 iframe document, then window.print() it.
// No server-only imports so it can be called from a client component.

export type PrintableSession = {
    id: string;
    layer: "gerbang" | "kelas";
    sessionDate: string;
    plannedStart: string;
    plannedEnd: string;
    status: "open" | "closed";
    notes: string | null;
    recordCount: number;
};

export type PrintableRecord = {
    studentName: string;
    nis: string;
    rombel: string | null;
    status: "masuk" | "keluar" | "hadir" | "izin" | "sakit" | "alpa";
    recordedAt: Date;
    outOfSession: boolean;
    notes: string | null;
};

const LAYER_LABELS: Record<PrintableSession["layer"], string> = {
    gerbang: "Gerbang",
    kelas: "Kelas",
};

const STATUS_LABELS: Record<PrintableRecord["status"], string> = {
    masuk: "Masuk",
    keluar: "Keluar",
    hadir: "Hadir",
    izin: "Izin",
    sakit: "Sakit",
    alpa: "Alpa",
};

export function printAbsensiSession({
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
    const iframe = document.createElement("iframe");
    iframe.title = "Rekapitulasi Absensi";
    Object.assign(iframe.style, {
        position: "fixed",
        width: "1px",
        height: "1px",
        right: "0",
        bottom: "0",
        border: "0",
        opacity: "0",
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
        iframe.remove();
        return;
    }

    const timeFmt = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
    });
    const printedAt = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
    }).format(new Date());

    const rows = records
        .map(
            (rec) => `<tr>
      <td>${escapeHtml(rec.studentName)}</td>
      <td>${escapeHtml(rec.nis)}</td>
      <td>${escapeHtml(rec.rombel ?? "—")}${rec.outOfSession ? ' <span class="badge">Luar Sesi</span>' : ""}</td>
      <td>${STATUS_LABELS[rec.status]}</td>
      <td>${timeFmt.format(rec.recordedAt)}</td>
      <td>${escapeHtml(rec.notes ?? "—")}</td>
    </tr>`,
        )
        .join("");

    doc.open();
    doc.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Rekapitulasi Absensi</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
    .document { min-height: 260mm; border: 1px solid #cbd5e1; padding: 14mm; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6mm; margin-bottom: 7mm; }
    .eyebrow { margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #475569; }
    h1 { margin: 2mm 0 0; font-size: 18pt; }
    .school { margin: 2mm 0 0; color: #475569; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 7mm; }
    .meta th, .meta td { border: 1px solid #cbd5e1; padding: 2.5mm 4mm; text-align: left; vertical-align: top; }
    .meta th { width: 32%; background: #f8fafc; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
    table.records { width: 100%; border-collapse: collapse; }
    table.records th, table.records td { border: 1px solid #cbd5e1; padding: 2mm 3mm; text-align: left; font-size: 10pt; }
    table.records th { background: #f1f5f9; text-transform: uppercase; letter-spacing: .04em; font-size: 8.5pt; color: #475569; }
    .badge { font-size: 8pt; color: #b45309; background: #fef3c7; padding: 0 4px; border-radius: 4px; }
    .footer { margin-top: 10mm; border-top: 1px solid #cbd5e1; padding-top: 4mm; font-size: 8pt; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <article class="document">
    <header class="header">
      <p class="eyebrow">Rekapitulasi Absensi</p>
      <h1>${escapeHtml(LAYER_LABELS[session.layer])}</h1>
      <p class="school" id="school"></p>
    </header>
    <table class="meta"><tbody>
      <tr><th>Tanggal Sesi</th><td>${escapeHtml(session.sessionDate)}</td></tr>
      <tr><th>Jendela</th><td>${escapeHtml(session.plannedStart)}–${escapeHtml(session.plannedEnd)}</td></tr>
      <tr><th>Status</th><td>${session.status === "open" ? "Terbuka" : "Selesai"}</td></tr>
      <tr><th>Jumlah Rekam</th><td>${session.recordCount}</td></tr>
      <tr><th>Catatan</th><td>${escapeHtml(session.notes ?? "—")}</td></tr>
      <tr><th>Tanggal Cetak</th><td>${escapeHtml(printedAt)}</td></tr>
    </tbody></table>
    <table class="records"><thead><tr>
      <th>Nama</th><th>NIS</th><th>Rombel</th><th>Status</th><th>Waktu</th><th>Keterangan</th>
    </tr></thead><tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center">Belum ada rekam.</td></tr>'}
    </tbody></table>
    <footer class="footer"><span>${escapeHtml(session.id)}</span><span>Dicetak melalui SIMAS</span></footer>
  </article>
</body>
</html>`);
    doc.close();

    const school = doc.getElementById("school");
    if (school) school.textContent = domain.replaceAll("-", " ").toLocaleUpperCase("id-ID");

    const cleanup = () => iframe.remove();
    win.addEventListener("afterprint", cleanup, { once: true });
    // Fallback cleanup if afterprint never fires (some browsers/headless).
    setTimeout(cleanup, 60_000);
    win.focus();
    win.print();
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
