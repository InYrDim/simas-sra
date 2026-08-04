export type PpdbExportSubmission = Readonly<{
  registrationCode: string;
  studentName: string;
  nisn: string;
  status: string;
  score: number | null;
  submittedAt: Date;
}>;

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function buildPpdbSubmissionsCsv(submissions: readonly PpdbExportSubmission[]): string {
  const rows = [
    ["Kode Pendaftaran", "Nama Calon Siswa", "NISN", "Status", "Nilai", "Dikirim Pada"],
    ...submissions.map((submission) => [
      submission.registrationCode,
      submission.studentName,
      submission.nisn,
      submission.status,
      submission.score,
      submission.submittedAt.toISOString(),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
