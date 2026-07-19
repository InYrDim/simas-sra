import assert from "node:assert/strict";
import test from "node:test";

import {
  createApplicantApplicationSubmission,
  SubmissionConflict,
  type ApplicantApplicationSubmissionStore,
} from "@/lib/applicant-application-submission";

const input = {
  schoolName: "SMA 1",
  npsn: " 2010-0001 ",
  educationLevel: "SMA",
  address: "Jalan Pendidikan 1",
  contactName: "Siti",
  contactPosition: "Kepala Sekolah",
  contactEmail: "SITI@example.test",
  contactWhatsapp: "0812 3456 7890",
};

type StoredApplication = {
  id: string;
  payloadHash: string;
  status: "pending" | "approved" | "rejected";
};

function recordingStore(options: {
  binding?: { id: string; canonicalNpsn: string } | null;
  idempotent?: StoredApplication | null;
  pending?: StoredApplication | null;
    latest?: StoredApplication | null;
    nextAttempt?: number;
    applicant?: boolean;
  conflict?: SubmissionConflict["code"];
} = {}) {
  const events: string[] = [];
  const writes: unknown[] = [];
  const store: ApplicantApplicationSubmissionStore = {
    async transaction(work) {
      events.push("transaction");
      if (options.conflict) throw new SubmissionConflict(options.conflict);
      return work({
        async isApplicant() { return options.applicant ?? true; },
                async lockApplicant(userId) { events.push(`lock:${userId}`); return options.applicant ?? true; },
        async getBinding() { return options.binding ?? null; },
        async createBinding(value) { events.push("bind"); writes.push(value); },
        async findByIdempotencyKey() { return options.idempotent ?? null; },
        async findPending() { return options.pending ?? null; },
                async findLatest() { return options.latest ?? null; },
                async nextAttemptNumber() { return options.nextAttempt ?? 1; },
        async createApplication(value) { events.push("create"); writes.push(value); },
      });
    },
  };
  return { events, store, writes };
}

test("first successful submission atomically binds the Pemohon and creates attempt one", async () => {
  const { events, store, writes } = recordingStore();
  const ids = ["application-1", "binding-1"];
  const submit = createApplicantApplicationSubmission({
    store,
    createId: () => ids.shift()!,
    now: () => new Date("2026-07-19T00:00:00Z"),
  });

  const result = await submit("applicant-1", "render-key-1", input);

  assert.deepEqual(result, { ok: true, applicationId: "application-1", existing: false });
  assert.deepEqual(events, ["transaction", "lock:applicant-1", "bind", "create"]);
  assert.deepEqual(writes[0], { id: "binding-1", userId: "applicant-1", canonicalNpsn: "20100001" });
  const applicationWrite = writes[1] as Record<string, unknown>;
  assert.match(applicationWrite.payloadHash as string, /^[a-f0-9]{64}$/);
  assert.deepEqual({ ...applicationWrite, payloadHash: "<hash>" }, {
    id: "application-1",
    schoolName: "SMA 1",
    npsn: "2010-0001",
    educationLevel: "SMA",
    address: "Jalan Pendidikan 1",
    contactName: "Siti",
    contactPosition: "Kepala Sekolah",
    contactEmail: "siti@example.test",
    contactWhatsapp: "+6281234567890",
    needsNote: null,
    status: "pending",
    submittedAt: new Date("2026-07-19T00:00:00Z"),
    decidedAt: null,
    decidedByProviderAdminId: null,
    rejectionReason: null,
    approvedTenantId: null,
    ownerUserId: "applicant-1",
    bindingId: "binding-1",
    attemptNumber: 1,
    idempotencyKey: "render-key-1",
    payloadHash: "<hash>",
  });
});

test("invalid input, invalid key, and non-Pemohon identities create nothing", async () => {
  const first = recordingStore();
  const submit = createApplicantApplicationSubmission({ store: first.store });
  assert.equal((await submit("applicant-1", "key", { ...input, npsn: "bad" })).ok, false);
  assert.equal((await submit("applicant-1", "", input)).ok, false);
  assert.deepEqual(first.events, []);

  const second = recordingStore({ applicant: false });
  assert.deepEqual(await createApplicantApplicationSubmission({ store: second.store })("other-1", "valid-key", input), { ok: false, code: "forbidden" });
});

test("same idempotency key and payload returns the existing application", async () => {
  const initial = recordingStore();
  const submitInitial = createApplicantApplicationSubmission({ store: initial.store, createId: () => "application-1", now: () => new Date("2026-07-19") });
  await submitInitial("applicant-1", "retry-key", input);
  const hash = (initial.writes[1] as { payloadHash: string }).payloadHash;

  const retry = recordingStore({ binding: { id: "binding-1", canonicalNpsn: "20100001" }, idempotent: { id: "application-1", payloadHash: hash, status: "pending" } });
  const result = await createApplicantApplicationSubmission({ store: retry.store })("applicant-1", "retry-key", input);

  assert.deepEqual(result, { ok: true, applicationId: "application-1", existing: true });
  assert.ok(!retry.events.includes("create"));
});

test("same idempotency key with changed payload is a conflict", async () => {
  const store = recordingStore({ binding: { id: "binding-1", canonicalNpsn: "20100001" }, idempotent: { id: "application-1", payloadHash: "different", status: "pending" } }).store;
  assert.deepEqual(await createApplicantApplicationSubmission({ store })("applicant-1", "retry-key", input), { ok: false, code: "idempotency-conflict" });
});

test("an existing pending application blocks a different key", async () => {
  const store = recordingStore({ binding: { id: "binding-1", canonicalNpsn: "20100001" }, pending: { id: "application-1", payloadHash: "hash", status: "pending" } }).store;
  assert.deepEqual(await createApplicantApplicationSubmission({ store })("applicant-1", "other-key", input), { ok: false, code: "existing-pending", applicationId: "application-1" });
});

test("a rejected Pemohon can submit a new immutable attempt for the bound canonical NPSN", async () => {
  const previous = { id: "application-1", payloadHash: "old", status: "rejected" as const };
  const { store, writes } = recordingStore({
    binding: { id: "binding-1", canonicalNpsn: "20100001" },
    latest: previous,
    nextAttempt: 2,
  });

  const result = await createApplicantApplicationSubmission({ store, createId: () => "application-2" })("applicant-1", "retry-key-2", input);

  assert.deepEqual(result, { ok: true, applicationId: "application-2", existing: false });
  assert.equal((writes[0] as { attemptNumber: number }).attemptNumber, 2);
  assert.deepEqual(previous, { id: "application-1", payloadHash: "old", status: "rejected" });
});

test("a final application that was not rejected cannot be resubmitted", async () => {
  const { store, writes } = recordingStore({
    binding: { id: "binding-1", canonicalNpsn: "20100001" },
    latest: { id: "application-1", payloadHash: "old", status: "approved" },
  });

  assert.deepEqual(await createApplicantApplicationSubmission({ store })("applicant-1", "retry-key-2", input), {
    ok: false,
    code: "resubmit-conflict",
  });
  assert.deepEqual(writes, []);
});

test("a database-won pending collision returns the existing-pending outcome", async () => {
  const store = recordingStore({ conflict: "existing-pending" }).store;
  assert.deepEqual(await createApplicantApplicationSubmission({ store })("applicant-1", "valid-key", input), { ok: false, code: "existing-pending", applicationId: "" });
});

test("binding and database ownership conflicts expose only a support-safe NPSN conflict", async () => {
  const bound = recordingStore({ binding: { id: "binding-1", canonicalNpsn: "30100001" } }).store;
  assert.deepEqual(await createApplicantApplicationSubmission({ store: bound })("applicant-1", "valid-key", input), { ok: false, code: "npsn-conflict" });

  for (const code of ["npsn-conflict", "binding-conflict"] as const) {
    const racing = recordingStore({ conflict: code }).store;
    assert.deepEqual(await createApplicantApplicationSubmission({ store: racing })("applicant-1", "valid-key", input), { ok: false, code: "npsn-conflict" });
  }
});
