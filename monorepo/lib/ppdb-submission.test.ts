import assert from "node:assert/strict";
import test from "node:test";

import { createPpdbSubmissionService, type PpdbSubmission, type PpdbSubmissionStore } from "@/lib/ppdb-submission";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const requiredField = { id: "f1", label: "Nama Lengkap Sesuai Ijazah", type: "text" as const, required: true };

function memoryStore(sessionFields = [requiredField]) {
  const submissions: PpdbSubmission[] = [];
  const store: PpdbSubmissionStore = {
    async findPublishedSession(tenantId, sessionId) {
      if (tenantId !== principal.tenantId || sessionId !== "session-1") return null;
      return { id: sessionId, fields: sessionFields };
    },
    async createSubmission(submission) {
      if (submissions.some((item) => item.tenantId === submission.tenantId && item.registrationCode === submission.registrationCode)) return { ok: false, code: "duplicate-code" };
      submissions.push(structuredClone(submission));
      return { ok: true };
    },
    async findByRegistrationCode(tenantId, registrationCode) {
      const found = submissions.find((item) => item.tenantId === tenantId && item.registrationCode === registrationCode);
      return found ? structuredClone(found) : null;
    },
    async findById(tenantId, submissionId) {
      const found = submissions.find((item) => item.tenantId === tenantId && item.id === submissionId);
      return found ? structuredClone(found) : null;
    },
    async list(tenantId, sessionId) {
      return submissions.filter((item) => item.tenantId === tenantId && (!sessionId || item.sessionId === sessionId)).map((item) => structuredClone(item));
    },
    async applyDecision(tenantId, submissionId, expectedVersion, patch) {
      const index = submissions.findIndex((item) => item.tenantId === tenantId && item.id === submissionId && item.version === expectedVersion);
      if (index < 0) return false;
      submissions[index] = { ...submissions[index], status: patch.status, score: patch.score, version: expectedVersion + 1, updatedAt: patch.updatedAt };
      return true;
    },
  };
  return { store, submissions };
}

test("accepts an anonymous submission when the Sesi is published and required fields are filled", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store, now: () => new Date("2026-02-01T00:00:00Z") });
  const result = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.registrationCode, /^PPDB-2026-[A-Z0-9]{6}$/);
});

test("accepts an SD submission without NISN and checks status using its registration code", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(
    principal.tenantId,
    "session-1",
    { studentName: "Ahmad Budi", nisn: "", formData: { f1: "Ahmad Budi" } },
    { nisnRequired: false },
  );
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.deepEqual(
    await service.checkStatus(principal.tenantId, submitted.registrationCode, "", { nisnRequired: false }),
    { ok: true, studentName: "Ahmad Budi", status: "pending", score: null },
  );
});

test("keeps NISN required for non-SD submissions", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  assert.deepEqual(
    await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad", nisn: "", formData: { f1: "Ahmad" } }),
    { ok: false, code: "invalid-input" },
  );
});

test("rejects a submission when the Sesi is not published", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  assert.deepEqual(await service.submit(principal.tenantId, "session-missing", { studentName: "Ahmad", nisn: "001", formData: {} }), { ok: false, code: "session-not-open" });
});

test("rejects a submission missing a required Form field", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  assert.deepEqual(await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad", nisn: "001", formData: {} }), { ok: false, code: "invalid-input" });
});

test("lets a Calon Siswa check status anonymously with registration code and NISN", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  assert.deepEqual(await service.checkStatus(principal.tenantId, submitted.registrationCode, "0012345678"), { ok: true, studentName: "Ahmad Budi", status: "pending", score: null });
  assert.deepEqual(await service.checkStatus(principal.tenantId, submitted.registrationCode, "wrong-nisn"), { ok: false, code: "not-found" });
});

test("lets an Admin decide a submission even after its Sesi has ended", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  const [submission] = await service.list(principal);
  const decided = await service.decide(principal, submission.id, { status: "accepted", score: 92 });
  assert.equal(decided.ok, true);
  const [updated] = await service.list(principal);
  assert.deepEqual({ status: updated.status, score: updated.score, version: updated.version }, { status: "accepted", score: 92, version: 2 });
});

test("scopes submission decisions to the requesting Tenant", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  const [submission] = await service.list(principal);
  const foreignPrincipal: MasterDataPrincipal = { ...principal, tenantId: "tenant-2" };
  assert.deepEqual(await service.decide(foreignPrincipal, submission.id, { status: "accepted", score: null }), { ok: false, code: "not-found" });
});
