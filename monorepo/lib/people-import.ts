import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type PeopleImportKind = "student" | "teacher" | "staff";
type Column = Readonly<{ key: string; label: string; required?: boolean; identifier?: boolean; date?: boolean; values?: readonly string[] }>;
const shared: readonly Column[] = [
  { key: "fullName", label: "Nama lengkap", required: true }, { key: "birthPlace", label: "Tempat lahir", required: true },
  { key: "birthDate", label: "Tanggal lahir", required: true, date: true }, { key: "gender", label: "Jenis kelamin", required: true, values: ["female", "male"] },
  { key: "nik", label: "NIK", identifier: true }, { key: "nip", label: "NIP", identifier: true }, { key: "street", label: "Alamat", required: true },
];
export const PEOPLE_IMPORT_CONTRACTS: Record<PeopleImportKind, { version: string; columns: readonly Column[] }> = {
  student: { version: "1.0.0", columns: [...shared, { key: "nis", label: "NIS", required: true, identifier: true }, { key: "nisn", label: "NISN", identifier: true }, { key: "entryDate", label: "Tanggal masuk", required: true, date: true }] },
  teacher: { version: "1.0.0", columns: [...shared, { key: "teacherNumber", label: "Nomor internal Guru", required: true, identifier: true }, { key: "nuptk", label: "NUPTK", identifier: true }, { key: "employmentType", label: "Jenis kepegawaian", required: true }, { key: "serviceStartDate", label: "Mulai masa kerja", required: true, date: true }] },
  staff: { version: "1.0.0", columns: [...shared, { key: "staffNumber", label: "Nomor internal Staf", required: true, identifier: true }, { key: "position", label: "Jabatan", required: true }, { key: "employmentType", label: "Jenis kepegawaian", required: true }, { key: "serviceStartDate", label: "Mulai masa kerja", required: true, date: true }] },
};

export type ImportFinding = { field: string; code: string; severity: "warning" | "rejected" };
export type ImportRow = { rowNumber: number; state: "ready" | "warning" | "rejected"; values: Record<string, string>; findings: ImportFinding[] };
export type ParseResult = { ok: true; kind: PeopleImportKind; version: string; rows: ImportRow[] } | { ok: false; code: string };

export async function buildPeopleImportTemplate(kind: PeopleImportKind) {
  const contract = PEOPLE_IMPORT_CONTRACTS[kind], workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Petunjuk"), data = workbook.addWorksheet("Data"), references = workbook.addWorksheet("Referensi", { state: "veryHidden" });
  instructions.addRows([[`Template impor ${kind}`], ["Isi sheet Data. Tanggal wajib menggunakan YYYY-MM-DD."], ["Jangan menambah formula, gambar, macro, link eksternal, sheet, atau mengubah header."]]);
  data.addRow(contract.columns.map((column) => column.label)); data.views = [{ state: "frozen", ySplit: 1 }];
  contract.columns.forEach((column, index) => { const sheetColumn = data.getColumn(index + 1); sheetColumn.width = 22; sheetColumn.numFmt = column.identifier ? "@" : "General"; });
  references.addRows([["entityKind", kind], ["templateVersion", contract.version], ["dateFormat", "YYYY-MM-DD"], ...contract.columns.filter((c) => c.values).flatMap((c) => c.values!.map((value) => [c.key, value]))]);
  await references.protect(randomUUID(), { selectLockedCells: false, selectUnlockedCells: false });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

const semver = /^(\d+)\.(\d+)\.(\d+)$/;
export async function parsePeopleImportWorkbook(bytes: Uint8Array): Promise<ParseResult> {
  if (bytes.byteLength > 10 * 1024 * 1024) return { ok: false, code: "file-too-large" };
  let zip: JSZip, workbook: ExcelJS.Workbook;
  try { zip = await JSZip.loadAsync(bytes); workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]); } catch { return { ok: false, code: "corrupt" }; }
  const names = Object.keys(zip.files).map((name) => name.toLowerCase());
  if (names.some((name) => name.includes("vbaproject") || name.endsWith(".bin"))) return { ok: false, code: "macro" };
  if (names.some((name) => name.includes("externallinks"))) return { ok: false, code: "external-link" };
  if (names.some((name) => name.startsWith("xl/media/"))) return { ok: false, code: "embedded-image" };
  if (names.some((name) => name.includes("encryptioninfo") || name.includes("encryptedpackage"))) return { ok: false, code: "password-protected" };
  if (workbook.worksheets.length !== 3 || new Set(workbook.worksheets.map((s) => s.name.trim().toLowerCase())).size !== 3 || !["Petunjuk", "Data", "Referensi"].every((name) => workbook.getWorksheet(name))) return { ok: false, code: "ambiguous-structure" };
  const reference = workbook.getWorksheet("Referensi")!, kind = String(reference.getCell("B1").value ?? "") as PeopleImportKind, version = String(reference.getCell("B2").value ?? "");
  if (!(kind in PEOPLE_IMPORT_CONTRACTS)) return { ok: false, code: "unsupported-entity" };
  const supported = PEOPLE_IMPORT_CONTRACTS[kind].version, actualVersion = semver.exec(version), supportedVersion = semver.exec(supported)!;
  if (!actualVersion || actualVersion[1] !== supportedVersion[1] || Number(actualVersion[2]) > Number(supportedVersion[2])) return { ok: false, code: "unsupported-version" };
  const data = workbook.getWorksheet("Data")!, contract = PEOPLE_IMPORT_CONTRACTS[kind];
  if (data.rowCount - 1 > 5000) return { ok: false, code: "too-many-rows" };
  const headers = contract.columns.map((c) => c.label); if (data.columnCount !== headers.length || headers.some((header, i) => String(data.getCell(1, i + 1).value ?? "") !== header)) return { ok: false, code: "ambiguous-structure" };
  const rows: ImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= data.actualRowCount; rowNumber++) {
    const row = data.getRow(rowNumber); if (!row.hasValues) continue; const values: Record<string, string> = {}, findings: ImportFinding[] = [];
    contract.columns.forEach((column, index) => { const cell = row.getCell(index + 1); if (cell.type === ExcelJS.ValueType.Formula) findings.push({ field: column.key, code: "formula", severity: "rejected" }); const value = String(cell.value ?? "").trim(); values[column.key] = value; if (column.required && !value) findings.push({ field: column.key, code: "required", severity: "rejected" }); if (column.date && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) findings.push({ field: column.key, code: "date-format", severity: "rejected" }); if (column.values && value && !column.values.includes(value)) findings.push({ field: column.key, code: "invalid-option", severity: "rejected" }); });
    if (findings.some((f) => f.code === "formula")) return { ok: false, code: "formula" };
    rows.push({ rowNumber, values, findings, state: findings.some((f) => f.severity === "rejected") ? "rejected" : findings.length ? "warning" : "ready" });
  }
  return { ok: true, kind, version, rows };
}

export type PeopleImportStorage = { write(tenantId: string, key: string, bytes: Uint8Array): Promise<void>; read(tenantId: string, key: string): Promise<Uint8Array>; remove(tenantId: string, key: string): Promise<void> };
export type ClaimedImportJob = { id: string; tenantId: string; batchId: string; storageKey: string; attempts: number };
export type PeopleImportStore = {
  createBatch(input: { batchId: string; jobId: string; tenantId: string; actorId: string; storageKey: string; byteSize: number }): Promise<{ batchId: string; jobId: string }>;
  claimJob(workerId: string): Promise<ClaimedImportJob | null>;
  completeValidation(input: { jobId: string; tenantId: string; batchId: string; kind: PeopleImportKind; version: string; rows: ImportRow[] }): Promise<void>;
  failJob(input: { jobId: string; code: string; retryable: boolean }): Promise<void>;
};
export function createPeopleImportService(deps: { store: PeopleImportStore; storage: PeopleImportStorage; id?: () => string }) {
  const id = deps.id ?? randomUUID;
  return {
    async upload(principal: MasterDataPrincipal, bytes: Uint8Array) {
      if (!principal.capabilities.write || bytes.byteLength > 10 * 1024 * 1024) return { ok: false, code: "denied" } as const;
      const batchId = id(), jobId = id(), storageKey = `tenants/${principal.tenantId}/people-import/${batchId}/source.xlsx`;
      await deps.storage.write(principal.tenantId, storageKey, bytes);
      try { await deps.store.createBatch({ batchId, jobId, tenantId: principal.tenantId, actorId: principal.userId, storageKey, byteSize: bytes.byteLength }); } catch (error) { await deps.storage.remove(principal.tenantId, storageKey); throw error; }
      return { ok: true, batchId } as const;
    },
    async runNext(workerId: string) {
      const job = await deps.store.claimJob(workerId); if (!job) return false;
      try { const parsed = await parsePeopleImportWorkbook(await deps.storage.read(job.tenantId, job.storageKey)); if (!parsed.ok) { await deps.store.failJob({ jobId: job.id, code: parsed.code, retryable: false }); return true; } await deps.store.completeValidation({ jobId: job.id, tenantId: job.tenantId, batchId: job.batchId, kind: parsed.kind, version: parsed.version, rows: parsed.rows }); } catch { await deps.store.failJob({ jobId: job.id, code: "validation-failed", retryable: job.attempts < 5 }); }
      return true;
    },
  };
}
