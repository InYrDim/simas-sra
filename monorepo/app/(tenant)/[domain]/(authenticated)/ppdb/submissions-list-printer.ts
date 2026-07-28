import type { PpdbSubmission, PpdbSubmissionStatus } from "@/lib/ppdb-submission";

export type PpdbSystemPrintColumn = "registrationCode" | "studentName" | "nisn" | "score" | "submittedAt" | "status";
export type PpdbPrintColumn = Readonly<{ key: PpdbSystemPrintColumn | `field:${string}`; label: string }>;

export const ppdbSystemPrintColumns: readonly PpdbPrintColumn[] = [
  { key: "registrationCode", label: "Kode Pendaftaran" },
  { key: "studentName", label: "Nama Peserta" },
  { key: "nisn", label: "NISN" },
  { key: "score", label: "Skor" },
  { key: "submittedAt", label: "Tanggal Daftar" },
  { key: "status", label: "Status" },
];

export function getPpdbDynamicPrintColumns(submissions: readonly PpdbSubmission[]): PpdbPrintColumn[] {
  const fields = new Map<string, string>();
  for (const submission of submissions) {
    for (const field of submission.formFields) {
      if (field.purpose || fields.has(field.id)) continue;
      fields.set(field.id, field.label);
    }
  }
  return [...fields].map(([id, label]) => ({ key: `field:${id}` as const, label }));
}

const statusLabels: Record<PpdbSubmissionStatus, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  rejected: "Ditolak",
};

function columnValue(submission: PpdbSubmission, column: PpdbPrintColumn) {
  if (column.key.startsWith("field:")) {
    const fieldId = column.key.slice("field:".length);
    const field = submission.formFields.find((item) => item.id === fieldId);
    if (field?.type === "file") {
      return submission.documents.find((document) => document.fieldId === fieldId)?.originalFileName ?? "–";
    }
    const value = submission.formData[fieldId];
    if (Array.isArray(value)) return value.length ? value.join(", ") : "–";
    return value === undefined || value === null || String(value).trim() === "" ? "–" : String(value);
  }
  if (column.key === "status") return statusLabels[submission.status];
  if (column.key === "submittedAt") return submission.submittedAt.toLocaleDateString("id-ID", { dateStyle: "medium" });
  if (column.key === "score") return submission.score === null ? "–" : String(submission.score);
  if (column.key === "registrationCode") return submission.registrationCode;
  if (column.key === "studentName") return submission.studentName;
  if (column.key === "nisn") return submission.nisn || "–";
  return "–";
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
    heading.textContent = column.label;
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
