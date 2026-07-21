import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  buildCorrectionWorkbook,
  carryForwardDecisions,
  classifyImportRowIdentity,
  isImportReviewDecisionAllowed,
  queryImportReview,
  type IdentityCandidate,
  type ReviewRow,
} from "@/lib/people-import-review";

const row = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "row-1", rowNumber: 2, state: "warning", values: { fullName: "Siti Aminah", nik: "0011223344556677", nis: "0007" },
  findings: [{ field: "fullName", code: "similar-person", severity: "warning" }], candidates: [], decision: null, identityFingerprint: "fp-1", ...overrides,
});
const candidate = (overrides: Partial<IdentityCandidate> = {}): IdentityCandidate => ({ id: "person-1", fullName: "Siti Aminah", birthPlace: "Palu", birthDate: "2010-01-02", identifiers: { nik: "0011223344556677" }, hasTargetProfile: false, compatible: true, ...overrides });

test("identity review requires explicit strong-link and rejects unsafe exact matches", () => {
  assert.deepEqual(classifyImportRowIdentity("student", row().values, [candidate()]), { state: "warning", finding: { field: "nik", code: "strong-link", severity: "warning" }, candidates: [candidate()] });
  assert.equal(classifyImportRowIdentity("student", row().values, [candidate({ hasTargetProfile: true })]).finding?.code, "target-profile-exists");
  assert.equal(classifyImportRowIdentity("student", row().values, [candidate({ compatible: false })]).finding?.code, "shared-data-conflict");
  assert.equal(classifyImportRowIdentity("student", row().values, [candidate(), candidate({ id: "person-2" })]).finding?.code, "ambiguous-identity");
  const strong = row({ candidates: [candidate()], findings: [{ field: "nik", code: "strong-link", severity: "warning" }] });
  assert.equal(isImportReviewDecisionAllowed(strong, { action: "link", targetPersonId: "person-1" }), true);
  assert.equal(isImportReviewDecisionAllowed(strong, { action: "create-distinct" }), false);
  assert.equal(isImportReviewDecisionAllowed(strong, { action: "skip" }), false);
  assert.equal(isImportReviewDecisionAllowed(row({ candidates: [candidate()] }), { action: "create-distinct" }), true);
});

test("review search and filters cover row, names, identifiers, state, and problematic column", () => {
  const rows = [row(), row({ id: "row-2", rowNumber: 3, state: "rejected", values: { fullName: "Budi", nis: "0099" }, findings: [{ field: "nis", code: "conflict", severity: "rejected" }] })];
  assert.deepEqual(queryImportReview(rows, { search: "001122", state: "warning", column: "fullName" }).map((x) => x.id), ["row-1"]);
  assert.deepEqual(queryImportReview(rows, { search: "Budi" }).map((x) => x.id), ["row-2"]);
});

test("correction workbook excludes candidates and carry-forward requires unchanged identity and target", async () => {
  const source = row({ decision: { action: "link", targetPersonId: "person-1", actorId: "admin-a" } });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await buildCorrectionWorkbook("student", [source])) as never);
  assert.deepEqual(workbook.worksheets.map((x) => x.name), ["Petunjuk", "Data", "Referensi"]);
  assert.equal(JSON.stringify(workbook.getWorksheet("Data")?.getRow(2).values).includes("person-1"), false);

  assert.equal(carryForwardDecisions([source], [row({ id: "new", identityFingerprint: "fp-1", candidates: [candidate()] })])[0]?.decision?.action, "link");
  assert.equal(carryForwardDecisions([source], [row({ id: "changed", identityFingerprint: "fp-2" })])[0]?.decision, null);
  assert.equal(carryForwardDecisions([source], [row({ id: "target-changed", identityFingerprint: "fp-1", candidates: [candidate({ id: "person-2" })] })])[0]?.decision, null);
});
