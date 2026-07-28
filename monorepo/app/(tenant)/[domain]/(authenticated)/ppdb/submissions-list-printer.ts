import type { PpdbSubmission, PpdbSubmissionStatus } from "@/lib/ppdb-submission";

export type PpdbPrintColumn = "registrationCode" | "studentName" | "nisn" | "score" | "submittedAt" | "status";

const columnLabels: Record<PpdbPrintColumn, string> = {
  registrationCode: "Kode Pendaftaran",
  studentName: "Nama Peserta",
  nisn: "NISN",
  score: "Skor",
  submittedAt: "Tanggal Daftar",
  status: "Status",
};

const statusLabels: Record<PpdbSubmissionStatus, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  rejected: "Ditolak",
};

function columnValue(submission: PpdbSubmission, column: PpdbPrintColumn) {
  if (column === "status") return statusLabels[submission.status];
  if (column === "submittedAt") return submission.submittedAt.toLocaleDateString("id-ID", { dateStyle: "medium" });
  if (column === "score") return submission.score === null ? "–" : String(submission.score);
  return submission[column] || "–";
}

export function printPpdbSubmissionsList({
  domain,
  submissions,
  columns,
}: {
  domain: string;
  submissions: readonly PpdbSubmission[];
  columns: readonly PpdbPrintColumn[];
}) {
  const iframe = document.createElement("iframe");
  iframe.title = "Daftar calon siswa PPDB";
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

  const printDocument = iframe.contentDocument;
  const printWindow = iframe.contentWindow;
  if (!printDocument || !printWindow) {
    iframe.remove();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Daftar Calon Siswa PPDB</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 9pt; }
    header { border-bottom: 2px solid #0f172a; margin-bottom: 7mm; padding-bottom: 5mm; text-align: center; }
    h1 { margin: 0; font-size: 17pt; }
    .school { margin: 2mm 0 0; color: #475569; font-size: 10pt; }
    .meta { display: flex; justify-content: space-between; gap: 8mm; margin-bottom: 4mm; color: #475569; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #94a3b8; padding: 2.4mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #e2e8f0; font-size: 8pt; text-transform: uppercase; letter-spacing: .03em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .number { width: 10mm; text-align: center; }
    footer { margin-top: 5mm; color: #64748b; font-size: 8pt; text-align: right; }
  </style>
</head>
<body>
  <header>
    <h1>Daftar Calon Siswa PPDB</h1>
    <p class="school" id="school"></p>
  </header>
  <section class="meta"><span id="summary"></span><span id="printed-at"></span></section>
  <table>
    <thead><tr id="table-head"><th class="number">No.</th></tr></thead>
    <tbody id="table-body"></tbody>
  </table>
  <footer>Dicetak melalui SIMAS</footer>
</body>
</html>`);
  printDocument.close();

  const school = printDocument.getElementById("school");
  const summary = printDocument.getElementById("summary");
  const printedAt = printDocument.getElementById("printed-at");
  const tableHead = printDocument.getElementById("table-head");
  const tableBody = printDocument.getElementById("table-body");

  if (school) school.textContent = domain.replaceAll("-", " ").toLocaleUpperCase("id-ID");
  if (summary) summary.textContent = `Jumlah calon siswa: ${submissions.length}`;
  if (printedAt) {
    printedAt.textContent = `Dicetak: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`;
  }

  for (const column of columns) {
    const heading = printDocument.createElement("th");
    heading.textContent = columnLabels[column];
    tableHead?.appendChild(heading);
  }

  submissions.forEach((submission, index) => {
    const row = printDocument.createElement("tr");
    const number = printDocument.createElement("td");
    number.className = "number";
    number.textContent = String(index + 1);
    row.appendChild(number);

    for (const column of columns) {
      const cell = printDocument.createElement("td");
      cell.textContent = columnValue(submission, column);
      row.appendChild(cell);
    }
    tableBody?.appendChild(row);
  });

  const cleanup = () => iframe.remove();
  printWindow.onafterprint = cleanup;
  window.setTimeout(cleanup, 60_000);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    printWindow.focus();
    printWindow.print();
  }));
}
