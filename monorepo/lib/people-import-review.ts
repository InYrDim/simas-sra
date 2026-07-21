import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { buildPeopleImportTemplate, PEOPLE_IMPORT_CONTRACTS, type ImportFinding, type PeopleImportKind } from "@/lib/people-import";

export type ReviewDecision = { action: "link" | "create-distinct" | "skip"; targetPersonId?: string; actorId: string };
export type IdentityCandidate = { id: string; fullName: string; birthPlace: string; birthDate: string; identifiers: Record<string, string>; hasTargetProfile: boolean; compatible: boolean };
export type ReviewRow = { id: string; rowNumber: number; state: "ready" | "warning" | "rejected"; values: Record<string, string>; findings: ImportFinding[]; candidates: IdentityCandidate[]; decision: ReviewDecision | null; identityFingerprint: string };

const identityKeys: Record<PeopleImportKind, readonly string[]> = { student: ["fullName", "birthPlace", "birthDate", "nik", "nip", "nis", "nisn"], teacher: ["fullName", "birthPlace", "birthDate", "nik", "nip", "teacherNumber", "nuptk"], staff: ["fullName", "birthPlace", "birthDate", "nik", "nip", "staffNumber"] };
export function importIdentityFingerprint(kind: PeopleImportKind, values: Record<string, string>) { return createHash("sha256").update(identityKeys[kind].map((key) => `${key}:${values[key]?.trim().toLocaleLowerCase("id-ID") ?? ""}`).join("|")).digest("hex"); }

export function classifyImportRowIdentity(_kind: PeopleImportKind, _values: Record<string, string>, exact: IdentityCandidate[]) {
  const rejected = (code: string, candidates = exact) => ({ state: "rejected" as const, finding: { field: "nik", code, severity: "rejected" as const }, candidates });
  if (exact.length > 1) return rejected("ambiguous-identity");
  const match = exact[0];
  if (!match) return { state: "ready" as const, finding: null, candidates: [] };
  if (!match.compatible) return rejected("shared-data-conflict");
  if (match.hasTargetProfile) return rejected("target-profile-exists");
  return { state: "warning" as const, finding: { field: "nik", code: "strong-link", severity: "warning" as const }, candidates: [match] };
}

export function isImportReviewDecisionAllowed(row: Pick<ReviewRow, "state" | "findings" | "candidates">, decision: Pick<ReviewDecision, "action" | "targetPersonId">) {
  if (row.state !== "warning") return false;
  if (decision.action === "link") return Boolean(decision.targetPersonId && row.candidates.some((candidate) => candidate.id === decision.targetPersonId && candidate.compatible && !candidate.hasTargetProfile));
  if (decision.targetPersonId) return false;
  return !row.findings.some((finding) => finding.code === "strong-link") && (decision.action === "create-distinct" || decision.action === "skip");
}

export function queryImportReview(rows: readonly ReviewRow[], query: { search?: string; state?: string; column?: string }) {
  const search = query.search?.trim().toLocaleLowerCase("id-ID") ?? "";
  return rows.filter((row) => (!query.state || row.state === query.state) && (!query.column || row.findings.some((finding) => finding.field === query.column)) && (!search || String(row.rowNumber).includes(search) || Object.values(row.values).some((value) => value.toLocaleLowerCase("id-ID").includes(search))));
}

export function carryForwardDecisions(previous: readonly ReviewRow[], next: readonly ReviewRow[]) {
  const byFingerprint = new Map(previous.filter((row) => row.decision).map((row) => [row.identityFingerprint, row]));
  return next.map((row) => { const old = byFingerprint.get(row.identityFingerprint); if (!old?.decision || !isImportReviewDecisionAllowed(row, old.decision)) return row; return { ...row, decision: { ...old.decision } }; });
}

export async function buildCorrectionWorkbook(kind: PeopleImportKind, rows: readonly ReviewRow[]) {
  const bytes = await buildPeopleImportTemplate(kind), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  const sheet = workbook.getWorksheet("Data")!, columns = PEOPLE_IMPORT_CONTRACTS[kind].columns;
  rows.filter((row) => row.state === "rejected" || row.decision?.action === "skip").forEach((row) => sheet.addRow(columns.map((column) => row.values[column.key] ?? "")));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
