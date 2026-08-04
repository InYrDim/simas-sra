import assert from "node:assert/strict";
import test from "node:test";

import { buildPpdbSubmissionsCsv } from "@/lib/admissions/ppdb-export";

test("PPDB export contains only the approved result projection", () => {
  const csv = buildPpdbSubmissionsCsv([{
    registrationCode: "PPDB-2026-A1",
    studentName: "=HYPERLINK(\"https://evil.example\")",
    nisn: "123",
    status: "accepted",
    score: 91,
    submittedAt: new Date("2026-08-04T10:00:00.000Z"),
  }]);

  assert.match(csv, /^\uFEFF\"Kode Pendaftaran\",\"Nama Calon Siswa\",\"NISN\",\"Status\",\"Nilai\",\"Dikirim Pada\"/);
  assert.match(csv, /\"'=HYPERLINK\(""https:\/\/evil\.example""\)\"/);
  assert.match(csv, /\"accepted\",\"91\",\"2026-08-04T10:00:00\.000Z\"/);
  assert.doesNotMatch(csv, /formData|storageKey|originalFileName|mimeType/);
});
