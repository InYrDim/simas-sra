import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";
import { SCHOOL_PERSON_RELIGIONS } from "@/lib/student-master-data";
import { STAFF_EMPLOYMENT_TYPES, STAFF_POSITIONS } from "@/lib/staff-master-data";
import { TEACHER_EMPLOYMENT_TYPES } from "@/lib/teacher-master-data";

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

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const collapse = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ");
const digits = (value: string | undefined) => collapse(value).replace(/[^0-9]/g, "");

export function normalizePeopleImportValues(kind: PeopleImportKind, input: Record<string, string>) {
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, collapse(value)]));
  for (const key of ["nik", "nip", "nisn", "nuptk"] as const) if (key in values) values[key] = digits(values[key]);
  if (kind === "student" && "nis" in values) values.nis = digits(values.nis);
  return values;
}

export function validatePeopleImportValues(kind: PeopleImportKind, input: Record<string, string>, today = new Date().toISOString().slice(0, 10)) {
  const values = normalizePeopleImportValues(kind, input), findings: ImportFinding[] = [];
  const reject = (field: string, code: string) => findings.push({ field, code, severity: "rejected" });
  const required = (field: string) => { if (!values[field]) reject(field, "required"); };
  for (const field of ["fullName", "birthPlace", "birthDate", "gender", "street"]) required(field);
  if (values.fullName && (values.fullName.length < 2 || values.fullName.length > 150)) reject("fullName", "invalid-length");
  if (values.birthPlace && (values.birthPlace.length < 2 || values.birthPlace.length > 100)) reject("birthPlace", "invalid-length");
  if (values.gender && !["male", "female"].includes(values.gender)) reject("gender", "invalid-option");
  if (values.birthDate && !validDate(values.birthDate)) reject("birthDate", "invalid-date");
  else if (values.birthDate > today) reject("birthDate", "future-date");
  if (values.nik && values.nik.length !== 16) reject("nik", "invalid-length");
  if (values.nip && values.nip.length !== 18) reject("nip", "invalid-length");
  if (values.religion && !SCHOOL_PERSON_RELIGIONS.includes(values.religion as (typeof SCHOOL_PERSON_RELIGIONS)[number])) reject("religion", "invalid-option");

  if (kind === "student") {
    required("nis"); required("entryDate");
    if (values.nisn && values.nisn.length !== 10) reject("nisn", "invalid-length");
    if (values.entryDate && !validDate(values.entryDate)) reject("entryDate", "invalid-date");
  } else {
    const numberField = kind === "teacher" ? "teacherNumber" : "staffNumber";
    required(numberField); required("employmentType"); required("serviceStartDate");
    if (values.serviceStartDate && !validDate(values.serviceStartDate)) reject("serviceStartDate", "invalid-date");
    if (kind === "teacher") {
      if (values.nuptk && values.nuptk.length !== 16) reject("nuptk", "invalid-length");
      if (values.employmentType && !TEACHER_EMPLOYMENT_TYPES.includes(values.employmentType as (typeof TEACHER_EMPLOYMENT_TYPES)[number])) reject("employmentType", "invalid-option");
    } else {
      required("position");
      if (values.position && !STAFF_POSITIONS.includes(values.position as (typeof STAFF_POSITIONS)[number])) reject("position", "invalid-option");
      if (values.employmentType && !STAFF_EMPLOYMENT_TYPES.includes(values.employmentType as (typeof STAFF_EMPLOYMENT_TYPES)[number])) reject("employmentType", "invalid-option");
      if (values.position === "other") reject("position", "other-detail-required");
      if (values.employmentType === "other") reject("employmentType", "other-detail-required");
    }
  }
  return { values, findings };
}

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
    contract.columns.forEach((column, index) => { const cell = row.getCell(index + 1); if (cell.type === ExcelJS.ValueType.Formula) findings.push({ field: column.key, code: "formula", severity: "rejected" }); values[column.key] = String(cell.value ?? "").trim(); });
    if (findings.some((f) => f.code === "formula")) return { ok: false, code: "formula" };
    const validated = validatePeopleImportValues(kind, values); findings.push(...validated.findings);
    rows.push({ rowNumber, values: validated.values, findings, state: findings.some((f) => f.severity === "rejected") ? "rejected" : findings.length ? "warning" : "ready" });
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
