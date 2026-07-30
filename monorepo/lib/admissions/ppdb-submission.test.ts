import assert from "node:assert/strict";
import test from "node:test";

import {
  createPpdbSubmissionService,
  type PpdbSubmission,
  type PpdbPublicResultContext,
  type PpdbSubmissionDocument,
  type PpdbSubmissionStore,
} from "@/lib/admissions/ppdb-submission";
import type { PpdbFormField } from "@/lib/admissions/ppdb-session";
import type { SchoolAssetStorage } from "@/lib/master-data/school-profile-assets";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const requiredField = { id: "f1", label: "Nama Lengkap Sesuai Ijazah", type: "text" as const, required: true };

function memoryStore(
  sessionFields: readonly PpdbFormField[] = [requiredField],
  publicResults: Readonly<{
    sessionStatus?: "draft" | "published" | "ended";
    resultsPublishedAt: Date | null;
    resultCheckClosedAt?: Date | null;
    acceptedFeedback: string;
    acceptedNextSteps: string;
    rejectedFeedback: string;
    rejectedNextSteps: string;
    whatsappGroupUrl: string | null;
  }> = {
    sessionStatus: "ended",
    resultsPublishedAt: null,
    acceptedFeedback: "",
    acceptedNextSteps: "",
    rejectedFeedback: "",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  },
) {
  const submissions: PpdbSubmission[] = [];
  const documents: PpdbSubmissionDocument[] = [];
  const store: PpdbSubmissionStore = {
    async findPublishedSession(tenantId, sessionId) {
      if (tenantId !== principal.tenantId || sessionId !== "session-1") return null;
      return { id: sessionId, fields: sessionFields };
    },
    async createSubmission(submission, submissionDocuments = []) {
      if (submissions.some((item) => item.tenantId === submission.tenantId && item.registrationCode === submission.registrationCode)) return { ok: false, code: "duplicate-code" };
      submissions.push(structuredClone(submission));
      documents.push(...structuredClone(submissionDocuments));
      return { ok: true };
    },
    async findByRegistrationCode(tenantId, registrationCode) {
      const found = submissions.find((item) => item.tenantId === tenantId && item.registrationCode === registrationCode);
      return found ? structuredClone(found) : null;
    },
    async findResultAvailability(tenantId, sessionId) {
      if (tenantId !== principal.tenantId || sessionId !== "session-1") return null;
      return {
        sessionStatus: publicResults.sessionStatus ?? "ended",
        resultsPublishedAt: publicResults.resultsPublishedAt,
        resultCheckClosedAt: publicResults.resultCheckClosedAt ?? null,
      };
    },
    async findPublicResultContext(tenantId, sessionId, registrationCode) {
      const found = submissions.find((item) => item.tenantId === tenantId && item.sessionId === sessionId && item.registrationCode === registrationCode);
      if (!found) return null;
      return structuredClone({ ...found, ...publicResults, sessionStatus: publicResults.sessionStatus ?? "ended" }) satisfies PpdbPublicResultContext;
    },

    async findById(tenantId, submissionId) {
      const found = submissions.find((item) => item.tenantId === tenantId && item.id === submissionId);
      return found ? structuredClone(found) : null;
    },
    async list(tenantId, sessionId) {
      return submissions
        .filter((item) => item.tenantId === tenantId && (!sessionId || item.sessionId === sessionId))
        .map((item) => ({
          ...structuredClone(item),
          documents: documents.filter((document) => document.submissionId === item.id).map((document) => structuredClone(document)),
        }));
    },
    async findDocument(tenantId, submissionId, documentId) {
      return documents.find((item) => item.tenantId === tenantId && item.submissionId === submissionId && item.id === documentId) ?? null;
    },
    async applyDecision(tenantId, submissionId, expectedVersion, patch) {
      const index = submissions.findIndex((item) => item.tenantId === tenantId && item.id === submissionId && item.version === expectedVersion);
      if (publicResults.resultsPublishedAt) return "results-published";
      if (index < 0) return "conflict";
      submissions[index] = { ...submissions[index], status: patch.status, score: patch.score, version: expectedVersion + 1, updatedAt: patch.updatedAt };
      return "updated";
    },
  };
  return { store, submissions, documents };
}

test("accepts an anonymous submission when the Sesi is published and required fields are filled", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store, now: () => new Date("2026-02-01T00:00:00Z") });
  const result = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.registrationCode, /^PPDB-2026-[A-Z0-9]{6}$/);
  assert.deepEqual(fixture.submissions[0].formFields, [requiredField]);
});

test("stores a required PPDB document and exposes its metadata to the Tenant admin", async () => {
  const fileField = { id: "document", label: "Akta Kelahiran", type: "file" as const, required: true };
  const fixture = memoryStore([fileField]);
  const written = new Map<string, Uint8Array>();
  const storage: SchoolAssetStorage = {
    async write(_tenantId, key, bytes) { written.set(key, bytes); },
    async read(_tenantId, key) { return written.get(key) ?? new Uint8Array(); },
    async remove(_tenantId, key) { written.delete(key); },
  };
  const service = createPpdbSubmissionService({
    store: fixture.store,
    storage,
    id: (() => { let value = 0; return () => `id-${++value}`; })(),
  });
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const result = await service.submit(
    principal.tenantId,
    "session-1",
    { studentName: "Ahmad", nisn: "0012345678", formData: {} },
    { nisnRequired: true, documents: [{ fieldId: "document", originalFileName: "akta.pdf", mimeType: "application/pdf", extension: "pdf", bytes }] },
  );
  assert.equal(result.ok, true);
  assert.equal(written.size, 1);
  const [submission] = await service.list(principal);
  assert.deepEqual(submission.documents.map(({ fieldId, originalFileName, mimeType, byteSize }) => ({ fieldId, originalFileName, mimeType, byteSize })), [
    { fieldId: "document", originalFileName: "akta.pdf", mimeType: "application/pdf", byteSize: 5 },
  ]);
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
    await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "", { nisnRequired: false }),
    { ok: false, code: "results-unpublished" },
  );
});

test("checks an SD submission by registration code even when an optional NISN was provided", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(
    principal.tenantId,
    "session-1",
    { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } },
    { nisnRequired: false },
  );
  if (!submitted.ok) return assert.fail();

  assert.deepEqual(
    await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "", { nisnRequired: false }),
    { ok: false, code: "results-unpublished" },
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

test("rejects a submission when the published Sesi has no Form fields", async () => {
  const fixture = memoryStore([]);
  const service = createPpdbSubmissionService({ store: fixture.store });

  assert.deepEqual(
    await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad", nisn: "001", formData: {} }),
    { ok: false, code: "session-not-open" },
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

test("does not expose applicant status before the Sesi has ended", async () => {
  const fixture = memoryStore([requiredField], {
    sessionStatus: "published",
    resultsPublishedAt: null,
    acceptedFeedback: "",
    acceptedNextSteps: "",
    rejectedFeedback: "",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  });
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();

  assert.deepEqual(
    await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "0012345678"),
    { ok: false, code: "session-not-ended" },
  );
  assert.deepEqual(
    await service.checkStatus(principal.tenantId, "session-1", "INVALID", "0012345678"),
    { ok: false, code: "session-not-ended" },
  );
});

test("does not expose applicant identity before results publication", async () => {
  const fixture = memoryStore();
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  assert.deepEqual(await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "0012345678"), { ok: false, code: "results-unpublished" });
  assert.deepEqual(await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "wrong-nisn"), { ok: false, code: "results-unpublished" });
  assert.deepEqual(await service.checkStatus(principal.tenantId, "session-2", submitted.registrationCode, "0012345678"), { ok: false, code: "not-found" });
});

test("reveals outcome feedback only after results publication", async () => {
  const fixture = memoryStore([requiredField], {
    resultsPublishedAt: new Date("2026-09-01T00:00:00Z"),
    acceptedFeedback: "Selamat, Anda diterima.",
    acceptedNextSteps: "Lakukan daftar ulang.",
    rejectedFeedback: "Belum berhasil.",
    rejectedNextSteps: "Silakan mencoba kembali.",
    whatsappGroupUrl: "https://chat.whatsapp.com/example",
  });
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  fixture.submissions[0] = { ...fixture.submissions[0], status: "accepted", score: 92 };
  assert.deepEqual(await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "0012345678"), {
    ok: true,
    studentName: "Ahmad Budi",
    publicationStatus: "published",
    status: "accepted",
    score: 92,
    feedback: "Selamat, Anda diterima.",
    nextSteps: "Lakukan daftar ulang.",
    whatsappGroupUrl: "https://chat.whatsapp.com/example",
  });

  fixture.submissions[0] = { ...fixture.submissions[0], status: "rejected", score: 60 };
  assert.deepEqual(await service.checkStatus(principal.tenantId, "session-1", submitted.registrationCode, "0012345678"), {
    ok: true,
    studentName: "Ahmad Budi",
    publicationStatus: "published",
    status: "rejected",
    score: 60,
    feedback: "Belum berhasil.",
    nextSteps: "Silakan mencoba kembali.",
    whatsappGroupUrl: null,
  });
});

test("does not expose applicant data after status checking is closed", async () => {
  const fixture = memoryStore([requiredField], {
    resultsPublishedAt: new Date("2026-09-01T00:00:00Z"),
    resultCheckClosedAt: new Date("2026-09-08T00:00:00Z"),
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "Daftar ulang",
    rejectedFeedback: "Ditolak",
    rejectedNextSteps: "Coba lagi",
    whatsappGroupUrl: null,
  });
  const service = createPpdbSubmissionService({ store: fixture.store });

  assert.deepEqual(
    await service.checkStatus(principal.tenantId, "session-1", "PPDB-2026-ABCDEF", "0012345678"),
    { ok: false, code: "result-check-closed" },
  );
});

test("locks an Admin decision after results publication", async () => {
  const fixture = memoryStore([requiredField], {
    resultsPublishedAt: new Date("2026-09-01T00:00:00Z"),
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "Daftar ulang",
    rejectedFeedback: "Ditolak",
    rejectedNextSteps: "Coba lagi",
    whatsappGroupUrl: null,
  });
  const service = createPpdbSubmissionService({ store: fixture.store });
  const submitted = await service.submit(principal.tenantId, "session-1", { studentName: "Ahmad Budi", nisn: "0012345678", formData: { f1: "Ahmad Budi" } });
  if (!submitted.ok) return assert.fail();
  const [submission] = await service.list(principal);

  assert.deepEqual(await service.decide(principal, submission.id, { status: "accepted", score: 92 }), { ok: false, code: "results-published" });
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
