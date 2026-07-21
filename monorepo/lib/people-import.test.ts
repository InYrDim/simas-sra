import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildPeopleImportTemplate, parsePeopleImportWorkbook, PEOPLE_IMPORT_CONTRACTS, createPeopleImportService, type PeopleImportStore } from "@/lib/people-import";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };

test("versioned templates and parser use the same contract", async () => {
  for (const kind of ["student", "teacher", "staff"] as const) {
    const bytes = await buildPeopleImportTemplate(kind);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Petunjuk", "Data", "Referensi"]);
    assert.equal(workbook.getWorksheet("Referensi")?.state, "veryHidden");
    assert.equal(workbook.getWorksheet("Data")?.getRow(1).values instanceof Array, true);
    const parsed = await parsePeopleImportWorkbook(bytes);
    assert.equal(parsed.ok, true); if (!parsed.ok) continue;
    assert.equal(parsed.kind, kind); assert.equal(parsed.version, PEOPLE_IMPORT_CONTRACTS[kind].version);
  }
});

test("parser rejects formulas, unsupported versions, ambiguous structure, images, and excessive rows", async () => {
  const bytes = await buildPeopleImportTemplate("student");
  const mutate = async (fn: (workbook: ExcelJS.Workbook) => void) => { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]); fn(workbook); return new Uint8Array(await workbook.xlsx.writeBuffer()); };
  assert.deepEqual(await parsePeopleImportWorkbook(await mutate((w) => { w.getWorksheet("Data")!.getCell("A2").value = { formula: "1+1" }; })), { ok: false, code: "formula" });
  assert.deepEqual(await parsePeopleImportWorkbook(await mutate((w) => { w.getWorksheet("Referensi")!.getCell("B2").value = "99.0.0"; })), { ok: false, code: "unsupported-version" });
  assert.deepEqual(await parsePeopleImportWorkbook(await mutate((w) => { w.addWorksheet("Data "); })), { ok: false, code: "ambiguous-structure" });
  assert.deepEqual(await parsePeopleImportWorkbook(await mutate((w) => { const image = w.addImage({ base64: "iVBORw0KGgo=", extension: "png" }); w.getWorksheet("Data")!.addImage(image, "A1:A1"); })), { ok: false, code: "embedded-image" });
  assert.deepEqual(await parsePeopleImportWorkbook(await mutate((w) => { w.getWorksheet("Data")!.getCell(5002, 1).value = "x"; })), { ok: false, code: "too-many-rows" });
  assert.deepEqual(await parsePeopleImportWorkbook(new Uint8Array(10 * 1024 * 1024 + 1)), { ok: false, code: "file-too-large" });
});

test("parser revalidates ordinary form rules with stable field findings", async () => {
  const bytes = await buildPeopleImportTemplate("teacher"), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.getWorksheet("Data")!.addRow(["A", "P", "2099-02-31", "female", "123", "123", "Jalan", "G-1", "123", "unknown", "not-a-date"]);
  const parsed = await parsePeopleImportWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.ok, true); if (!parsed.ok) return;
  assert.equal(parsed.rows[0]?.state, "rejected");
  assert.deepEqual(parsed.rows[0]?.findings.map((finding) => [finding.field, finding.code]), [
    ["fullName", "invalid-length"], ["birthPlace", "invalid-length"], ["birthDate", "future-date"], ["nik", "invalid-length"],
    ["nip", "invalid-length"], ["serviceStartDate", "invalid-date"], ["nuptk", "invalid-length"], ["employmentType", "invalid-option"],
  ]);
});

test("upload stores a Tenant-scoped file and durable validation writes no Master Data", async () => {
  const calls: string[] = []; let claimed = false;
  const store: PeopleImportStore = {
    async createBatch(input) { calls.push(`batch:${input.tenantId}:${input.storageKey}`); return { batchId: "batch-1", jobId: "job-1" }; },
    async claimJob() { if (claimed) return null; claimed = true; return { id: "job-1", tenantId: "tenant-1", batchId: "batch-1", storageKey: "tenants/tenant-1/people-import/batch-1/source.xlsx", attempts: 1 }; },
    async completeValidation(input) { calls.push(`revision:${input.tenantId}:${input.rows.length}`); },
    async failJob() { calls.push("failed"); },
  };
  const files = new Map<string, Uint8Array>();
  const service = createPeopleImportService({ store, storage: { async write(tenantId, key, bytes) { assert.ok(key.startsWith(`tenants/${tenantId}/`)); files.set(key, bytes); }, async read(tenantId, key) { assert.ok(key.startsWith(`tenants/${tenantId}/`)); return files.get(key)!; }, async remove() {} }, id: (() => { let n = 0; return () => ["batch-1", "job-1"][n++]!; })() });
  const uploaded = await service.upload(principal, await buildPeopleImportTemplate("student"));
  assert.deepEqual(uploaded, { ok: true, batchId: "batch-1" });
  assert.deepEqual(await Promise.all([service.runNext("worker-a"), service.runNext("worker-b")]), [true, false]);
  assert.deepEqual(calls, ["batch:tenant-1:tenants/tenant-1/people-import/batch-1/source.xlsx", "revision:tenant-1:0"]);
});
