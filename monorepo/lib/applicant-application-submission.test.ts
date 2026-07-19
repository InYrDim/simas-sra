import assert from "node:assert/strict";
import test from "node:test";

import { createApplicantApplicationSubmission, type ApplicantApplicationSubmissionStore } from "@/lib/applicant-application-submission";

const input = { schoolName: "SMA 1", npsn: "20100001", educationLevel: "SMA", address: "Jalan Pendidikan 1", contactName: "Siti", contactPosition: "Kepala Sekolah", contactEmail: "siti@example.test", contactWhatsapp: "081234567890" };

function recordingStore(binding: { id: string; canonicalNpsn: string } | null = null) {
  const events: string[] = [];
  const writes: unknown[] = [];
  const store: ApplicantApplicationSubmissionStore = {
    async transaction(work) {
      events.push("transaction");
      return work({
        async lockApplicant(userId) { events.push(`lock:${userId}`); return true; },
        async getBinding() { return binding; },
        async createBinding(value) { events.push("bind"); writes.push(value); },
        async nextAttemptNumber() { return 1; },
        async createApplication(value) { events.push("create"); writes.push(value); },
      });
    },
  };
  return { events, store, writes };
}

test("first successful submission atomically binds the Pemohon and owns the application", async () => {
  const { events, store, writes } = recordingStore();
  const submit = createApplicantApplicationSubmission({ store, createId: (() => { const ids = ["application-1", "binding-1"]; return () => ids.shift()!; })(), now: () => new Date("2026-07-19T00:00:00Z") });

  const result = await submit("applicant-1", input);

  assert.deepEqual(result, { ok: true, applicationId: "application-1" });
  assert.deepEqual(events, ["transaction", "lock:applicant-1", "bind", "create"]);
  assert.deepEqual(writes[0], { id: "binding-1", userId: "applicant-1", canonicalNpsn: "20100001" });
  assert.equal((writes[1] as { ownerUserId: string }).ownerUserId, "applicant-1");
  assert.equal((writes[1] as { bindingId: string }).bindingId, "binding-1");
  assert.equal((writes[1] as { attemptNumber: number }).attemptNumber, 1);
});

test("invalid input and non-Pemohon identities create no binding or application", async () => {
  const first = recordingStore();
  const submitInvalid = createApplicantApplicationSubmission({ store: first.store });
  assert.equal((await submitInvalid("applicant-1", { ...input, npsn: "bad" })).ok, false);
  assert.deepEqual(first.events, []);

  const second = recordingStore();
  second.store.transaction = async (work) => work({
    async lockApplicant() { return false; }, async getBinding() { return null; }, async createBinding() {}, async nextAttemptNumber() { return 1; }, async createApplication() {},
  });
  const result = await createApplicantApplicationSubmission({ store: second.store })("other-1", input);
  assert.deepEqual(result, { ok: false, code: "forbidden" });
});

test("an existing binding permits only the same NPSN", async () => {
  const { store } = recordingStore({ id: "binding-1", canonicalNpsn: "20100001" });
  const submit = createApplicantApplicationSubmission({ store });
  assert.deepEqual(await submit("applicant-1", { ...input, npsn: "30100001" }), { ok: false, code: "npsn-conflict" });
});
