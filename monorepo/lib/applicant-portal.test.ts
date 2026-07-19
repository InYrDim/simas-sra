import assert from "node:assert/strict";
import test from "node:test";

import { createApplicantPortalQuery, type ApplicantPortalStore } from "@/lib/applicant-portal";

const pending = {
  id: "application-2",
  attemptNumber: 2,
  status: "pending" as const,
  schoolName: "SMA Batunapara",
  npsn: "20100001",
  educationLevel: "SMA",
  address: "Jalan Pendidikan 1",
  contactName: "Siti",
  contactPosition: "Kepala Sekolah",
  contactEmail: "siti@example.test",
  contactWhatsapp: "+6281234567890",
  needsNote: null,
  submittedAt: new Date("2026-07-19T00:00:00Z"),
    decidedAt: null,
    rejectionReason: null,
};

test("portal query rejects a user without an active Pemohon identity", async () => {
  const store: ApplicantPortalStore = { async isApplicant() { return false; }, async listApplications() { throw new Error("must not load"); } };
  assert.deepEqual(await createApplicantPortalQuery(store)("other-1"), { ok: false, code: "forbidden" });
});

test("portal query returns the empty state for a Pemohon without Pengajuan", async () => {
  const store: ApplicantPortalStore = { async isApplicant() { return true; }, async listApplications() { return []; } };
  assert.deepEqual(await createApplicantPortalQuery(store)("applicant-1"), { ok: true, state: { kind: "empty" } });
});

test("portal query exposes a rejected snapshot, reason, and immediate resubmit state", async () => {
  const rejected = {
    ...pending,
    id: "application-1",
    attemptNumber: 1,
    status: "rejected" as const,
    decidedAt: new Date("2026-07-19T01:00:00Z"),
    rejectionReason: "Perbaiki data penanggung jawab.",
  };
  const store: ApplicantPortalStore = { async isApplicant() { return true; }, async listApplications() { return [rejected]; } };

  const result = await createApplicantPortalQuery(store)("applicant-1");

  assert.deepEqual(result, { ok: true, state: { kind: "rejected", current: rejected, history: [rejected] } });
  if (result.ok && result.state.kind === "rejected") assert.equal(Object.isFrozen(result.state.current), true);
});

test("portal query exposes a read-only pending snapshot and attempt-ordered history", async () => {
  const first = { ...pending, id: "application-1", attemptNumber: 1, status: "rejected" as const, submittedAt: new Date("2026-07-18T00:00:00Z") };
  const store: ApplicantPortalStore = { async isApplicant() { return true; }, async listApplications() { return [pending, first]; } };

  const result = await createApplicantPortalQuery(store)("applicant-1");

  assert.deepEqual(result, { ok: true, state: { kind: "pending", current: pending, history: [first, pending] } });
  if (result.ok && result.state.kind === "pending") assert.equal(Object.isFrozen(result.state.current), true);
});
