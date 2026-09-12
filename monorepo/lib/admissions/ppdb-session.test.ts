import assert from "node:assert/strict";
import test from "node:test";

import { createPpdbSessionService, findPpdbIdentityField, ppdbSystemFields, type PpdbSession, type PpdbSessionStore } from "@/lib/admissions/ppdb-session";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const validInput = { academicYearId: "year-1", endDate: "2026-08-31" };
const field = { id: "f1", label: "Alamat", type: "text" as const, required: true };
const systemFields = [...ppdbSystemFields];

function memoryStore(options: { hasPendingSubmissions?: boolean } = {}) {
  const sessions: PpdbSession[] = [];
  const store: PpdbSessionStore = {
    async list(tenantId) { return sessions.filter((session) => session.tenantId === tenantId).map((session) => structuredClone(session)); },
    async transaction(tenantId, work) {
      const snapshot = structuredClone(sessions);
      try {
        return await work({
          async list() { return sessions.filter((session) => session.tenantId === tenantId).map((session) => structuredClone(session)); },
          async hasPendingSubmissions() { return options.hasPendingSubmissions ?? false; },
          async save(session) { const index = sessions.findIndex((item) => item.id === session.id && item.tenantId === tenantId); if (index < 0) sessions.push(structuredClone(session)); else sessions[index] = structuredClone(session); },
        });
      } catch (error) { sessions.splice(0, sessions.length, ...snapshot); throw error; }
    },
  };
  return { store, sessions };
}

test("resolves identity fields from semantic purpose and legacy labels", () => {
  assert.equal(findPpdbIdentityField([{ ...field, id: "name", purpose: "studentName" }], "studentName")?.id, "name");
  assert.equal(findPpdbIdentityField([{ ...field, id: "custom-name", label: "Nama Lengkap Calon Siswa" }], "studentName")?.id, "custom-name");
  assert.equal(findPpdbIdentityField([{ ...field, id: "custom-nisn", label: "NISN" }], "nisn")?.id, "custom-nisn");
});

test("creates a draft Sesi PPDB referencing an existing Tahun Ajaran", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store, id: (() => { let value = 0; return () => `id-${++value}`; })(), now: () => new Date("2026-01-10T00:00:00Z") });
  const created = await service.create(principal, validInput);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.session.status, "draft");
  assert.deepEqual(created.session.fields, []);
  assert.deepEqual(created.session.draftFields, systemFields);
  assert.deepEqual(created.session.resultSettings, {
    acceptedFeedback: "",
    acceptedNextSteps: "",
    rejectedFeedback: "",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  });
  assert.equal(created.session.resultsPublishedAt, null);
  assert.equal(created.session.resultCheckClosedAt, null);
});

test("normalizes and validates result feedback settings", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();

  const updated = await service.updateResultSettings(principal, created.session.id, {
    acceptedFeedback: "  Selamat, Anda diterima.  ",
    acceptedNextSteps: "  Lakukan daftar ulang. ",
    rejectedFeedback: "  Terima kasih telah mendaftar. ",
    rejectedNextSteps: "  Silakan mencoba kembali. ",
    whatsappGroupUrl: "  https://chat.whatsapp.com/example  ",
  });

  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.deepEqual(updated.session.resultSettings, {
    acceptedFeedback: "Selamat, Anda diterima.",
    acceptedNextSteps: "Lakukan daftar ulang.",
    rejectedFeedback: "Terima kasih telah mendaftar.",
    rejectedNextSteps: "Silakan mencoba kembali.",
    whatsappGroupUrl: "https://chat.whatsapp.com/example",
  });
  assert.deepEqual(
    await service.updateResultSettings(principal, created.session.id, {
      ...updated.session.resultSettings,
      acceptedFeedback: "x".repeat(2001),
    }),
    { ok: false, code: "invalid-result-settings" },
  );
  assert.deepEqual(
    await service.updateResultSettings(principal, created.session.id, {
      ...updated.session.resultSettings,
      whatsappGroupUrl: "https://example.test/group",
    }),
    { ok: false, code: "invalid-result-settings" },
  );
});

test("rejects result publication while a submission is still pending", async () => {
  const fixture = memoryStore({ hasPendingSubmissions: true });
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  await service.updateFields(principal, created.session.id, systemFields);
  await service.publish(principal, created.session.id);
  await service.end(principal, created.session.id);
  await service.updateResultSettings(principal, created.session.id, {
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "",
    rejectedFeedback: "Belum diterima",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  });

  assert.deepEqual(await service.publishResults(principal, created.session.id), { ok: false, code: "pending-submissions" });
});

test("publishes results only once for an ended Sesi with required feedback", async () => {
  const fixture = memoryStore();
  const timestamp = new Date("2026-09-01T00:00:00Z");
  const service = createPpdbSessionService({ store: fixture.store, now: () => timestamp });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.publishResults(principal, created.session.id), { ok: false, code: "session-not-ended" });
  await service.updateFields(principal, created.session.id, systemFields);
  await service.publish(principal, created.session.id);
  await service.end(principal, created.session.id);
  assert.deepEqual(await service.publishResults(principal, created.session.id), { ok: false, code: "result-feedback-required" });
  await service.updateResultSettings(principal, created.session.id, {
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "",
    rejectedFeedback: "Belum diterima",
    rejectedNextSteps: "",
    whatsappGroupUrl: "",
  });

  const published = await service.publishResults(principal, created.session.id);

  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.session.resultsPublishedAt?.toISOString(), timestamp.toISOString());
  assert.deepEqual(await service.publishResults(principal, created.session.id), { ok: false, code: "results-already-published" });
  assert.deepEqual(
    await service.updateResultSettings(principal, created.session.id, {
      ...published.session.resultSettings,
      acceptedFeedback: "Changed",
    }),
    { ok: false, code: "result-settings-locked" },
  );
});

test("lets an Admin close and reopen result checking after publication", async () => {
  const fixture = memoryStore();
  const timestamp = new Date("2026-09-08T00:00:00Z");
  const service = createPpdbSessionService({ store: fixture.store, now: () => timestamp });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.setResultCheckOpen(principal, created.session.id, false), { ok: false, code: "results-unpublished" });
  await service.updateFields(principal, created.session.id, systemFields);
  await service.publish(principal, created.session.id);
  await service.end(principal, created.session.id);
  await service.updateResultSettings(principal, created.session.id, {
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "",
    rejectedFeedback: "Belum diterima",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  });
  await service.publishResults(principal, created.session.id);

  const closed = await service.setResultCheckOpen(principal, created.session.id, false);
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.session.resultCheckClosedAt?.toISOString(), timestamp.toISOString());

  const reopened = await service.setResultCheckOpen(principal, created.session.id, true);
  assert.equal(reopened.ok, true);
  if (!reopened.ok) return;
  assert.equal(reopened.session.resultCheckClosedAt, null);
});

test("rejects publishing a Sesi with no Form fields", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.publish(principal, created.session.id, []), { ok: false, code: "empty-fields" });
});

test("validates dynamic choice fields and stable field identities", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();

  const dynamicFields = [
    ...systemFields,
    { id: "address", label: "Alamat", type: "textarea" as const, required: true, description: "Alamat domisili" },
    { id: "birth-date", label: "Tanggal lahir", type: "date" as const, required: true },
    { id: "interests", label: "Minat", type: "checkbox" as const, required: false, options: ["Sains", "Olahraga"] },
  ];
  assert.equal((await service.updateFields(principal, created.session.id, dynamicFields)).ok, true);
  assert.deepEqual(
    await service.updateFields(principal, created.session.id, [systemFields[0]]),
    { ok: false, code: "invalid-input" },
  );
  assert.deepEqual(
    await service.updateFields(principal, created.session.id, [...systemFields, { ...field, type: "radio", options: ["Sama", "Sama"] }]),
    { ok: false, code: "invalid-input" },
  );
  assert.deepEqual(
    await service.updateFields(principal, created.session.id, [...systemFields, { ...systemFields[0] }]),
    { ok: false, code: "invalid-input" },
  );
});

test("publishes the current Form fields atomically", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();

  const published = await service.publish(principal, created.session.id, systemFields);

  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.session.status, "published");
  assert.deepEqual(published.session.fields, systemFields);
});

test("keeps published fields stable while editing a draft revision", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  const published = await service.publish(principal, created.session.id, systemFields);
  if (!published.ok) return assert.fail();
  const revisedFields = [...systemFields, field];

  const saved = await service.updateFields(principal, created.session.id, revisedFields);

  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.session.fields, systemFields);
  assert.deepEqual(saved.session.draftFields, revisedFields);

  const republished = await service.publish(principal, created.session.id);
  assert.equal(republished.ok, true);
  if (!republished.ok) return;
  assert.deepEqual(republished.session.fields, revisedFields);
});

test("allows only one published Sesi PPDB per Tenant at a time", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const first = await service.create(principal, validInput);
  const second = await service.create(principal, validInput);
  if (!first.ok || !second.ok) return assert.fail();
  await service.updateFields(principal, first.session.id, systemFields);
  await service.updateFields(principal, second.session.id, systemFields);
  assert.equal((await service.publish(principal, first.session.id)).ok, true);
  assert.deepEqual(await service.publish(principal, second.session.id), { ok: false, code: "published-conflict" });
});

test("ends only a published Sesi, and never reopens it", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  assert.deepEqual(await service.end(principal, created.session.id), { ok: false, code: "invalid-transition" });
  await service.updateFields(principal, created.session.id, systemFields);
  await service.publish(principal, created.session.id);
  const ended = await service.end(principal, created.session.id);
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(ended.session.status, "ended");
  assert.deepEqual(await service.publish(principal, created.session.id), { ok: false, code: "invalid-transition" });
});

test("scopes Sesi PPDB reads and writes to the requesting Tenant", async () => {
  const fixture = memoryStore();
  const service = createPpdbSessionService({ store: fixture.store });
  const created = await service.create(principal, validInput);
  if (!created.ok) return assert.fail();
  const foreignPrincipal: MasterDataPrincipal = { ...principal, tenantId: "tenant-2" };
  assert.deepEqual(await service.list(foreignPrincipal), []);
  assert.deepEqual(await service.publish(foreignPrincipal, created.session.id), { ok: false, code: "not-found" });
  assert.deepEqual(await service.updateResultSettings(foreignPrincipal, created.session.id, {
    acceptedFeedback: "Diterima",
    acceptedNextSteps: "",
    rejectedFeedback: "Ditolak",
    rejectedNextSteps: "",
    whatsappGroupUrl: null,
  }), { ok: false, code: "not-found" });
  assert.deepEqual(await service.publishResults(foreignPrincipal, created.session.id), { ok: false, code: "not-found" });
});
