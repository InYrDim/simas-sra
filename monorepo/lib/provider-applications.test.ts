import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalConflictError,
  createApproveSimasApplicationCommand,
  createRejectSimasApplicationCommand,
  suggestSubdomain,
  type ApplicationApprovalStore,
  type ApplicationDecisionStore,
  type LockedApplicationApproval,
  type LockedApplicationDecision,
} from "@/lib/provider-applications";

function recordingStore(application: LockedApplicationDecision | null) {
  const events: string[] = [];
  const decisions: Array<{
    applicationId: string;
    providerAdminId: string;
    reason: string;
    decidedAt: Date;
  }> = [];
  const store: ApplicationDecisionStore = {
    async transaction(work) {
      events.push("transaction");
      return work({
        async lock(applicationId) {
          events.push(`lock:${applicationId}`);
          return application;
        },
        async reject(decision) {
                  events.push("reject");
                  decisions.push(decision);
                  return true;
                },
      });
    },
  };

  return { decisions, events, store };
}

const principal = {
  userId: "provider-1",
  name: "Provider Admin",
  email: "provider@simas.test",
};

test("rejection authorizes before reading input or starting a transaction", async () => {
  const { events, store } = recordingStore({ id: "application-1", status: "pending" });
  const guardedInput = new Proxy(
    {},
    {
      get() {
        events.push("input-read");
        return "application-1";
      },
    },
  );
  const reject = createRejectSimasApplicationCommand({
    authorize: async () => {
      events.push("authorize");
      throw new Error("forbidden");
    },
    store,
  });

  await assert.rejects(() => reject(guardedInput), /forbidden/);
  assert.deepEqual(events, ["authorize"]);
});

test("a pending application is rejected with normalized decision metadata", async () => {
  const { decisions, events, store } = recordingStore({
    id: "application-1",
    status: "pending",
  });
  const reject = createRejectSimasApplicationCommand({
    authorize: async () => principal,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    store,
  });

  const result = await reject({
    applicationId: "application-1",
    reason: "  Data   penanggung jawab tidak lengkap. ",
  });

  assert.deepEqual(result, { ok: true, status: "rejected" });
  assert.deepEqual(events, ["transaction", "lock:application-1", "reject"]);
  assert.deepEqual(decisions, [
    {
      applicationId: "application-1",
      providerAdminId: "provider-1",
      reason: "Data penanggung jawab tidak lengkap.",
      decidedAt: new Date("2026-07-18T12:00:00.000Z"),
    },
  ]);
});

test("rejection requires a non-empty reason before mutation", async () => {
  const { decisions, store } = recordingStore({ id: "application-1", status: "pending" });
  const reject = createRejectSimasApplicationCommand({
    authorize: async () => principal,
    store,
  });

  const result = await reject({ applicationId: "application-1", reason: "   " });

  assert.deepEqual(result, {
    ok: false,
    code: "invalid-input",
    errors: { reason: "Alasan penolakan wajib diisi." },
  });
  assert.deepEqual(decisions, []);
});

test("an identical rejection retry is idempotent without overwriting decision metadata", async () => {
  const { decisions, store } = recordingStore({
    id: "application-1",
    status: "rejected",
    decidedByProviderAdminId: "provider-1",
    rejectionReason: "Tidak memenuhi syarat",
  });
  const reject = createRejectSimasApplicationCommand({ authorize: async () => principal, store });

  assert.deepEqual(await reject({ applicationId: "application-1", reason: " Tidak  memenuhi syarat " }), {
    ok: true,
    status: "already-rejected",
  });
  assert.deepEqual(decisions, []);
});

test("a different rejection or an approved application is a decision conflict", async () => {
  const cases: LockedApplicationDecision[] = [
    { id: "application-1", status: "approved", decidedByProviderAdminId: "provider-1", rejectionReason: null },
    { id: "application-1", status: "rejected", decidedByProviderAdminId: "provider-1", rejectionReason: "Alasan lama" },
    { id: "application-1", status: "rejected", decidedByProviderAdminId: "provider-lain", rejectionReason: "Tidak memenuhi syarat" },
  ];
  for (const application of cases) {
    const { decisions, store } = recordingStore(application);
    const reject = createRejectSimasApplicationCommand({ authorize: async () => principal, store });

    const result = await reject({ applicationId: "application-1", reason: "Tidak memenuhi syarat" });

    assert.deepEqual(result, { ok: false, code: "decision-conflict", status: application.status });
    assert.deepEqual(decisions, []);
  }
});

test("a missing application is reported without mutation", async () => {
  const { decisions, store } = recordingStore(null);
  const reject = createRejectSimasApplicationCommand({
    authorize: async () => principal,
    store,
  });

  const result = await reject({ applicationId: "missing", reason: "Tidak ditemukan" });

  assert.deepEqual(result, { ok: false, code: "not-found" });
  assert.deepEqual(decisions, []);
});

const pendingApproval = {
  id: "application-1",
  status: "pending" as const,
  schoolName: "SMA Negeri 1 Bandung",
  npsn: "20200001",
  contactName: "Siti Aminah",
  contactEmail: "admin@sman1.test",
  approvedTenantId: null,
};

function approvalStore(
  application: LockedApplicationApproval | null,
  conflict?: "npsn" | "subdomain" | "email",
) {
  const events: string[] = [];
  const provisions: unknown[] = [];
  const store: ApplicationApprovalStore = {
    async transaction(work) {
      events.push("transaction");
      return work({
        async lock(applicationId) {
          events.push(`lock:${applicationId}`);
          return application;
        },
        async findConflict() {
          events.push("check-conflicts");
          return conflict ?? null;
        },
        async provision(values) {
          events.push("provision");
          provisions.push(values);
        },
      });
    },
  };
  return { events, provisions, store };
}

test("approval authorizes before reading input, generating a credential, or starting a transaction", async () => {
  const { events, store } = approvalStore(pendingApproval);
  const guardedInput = new Proxy({}, { get() { events.push("input-read"); return "value"; } });
  const approve = createApproveSimasApplicationCommand({
    authorize: async () => { events.push("authorize"); throw new Error("forbidden"); },
    generateCredential: () => { events.push("credential"); return "secret"; },
    hashCredential: async () => "hash",
    store,
  });

  await assert.rejects(() => approve(guardedInput), /forbidden/);
  assert.deepEqual(events, ["authorize"]);
});

test("a pending application atomically provides its Tenant and one-time credential", async () => {
  const { events, provisions, store } = approvalStore(pendingApproval);
  const approve = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    generateCredential: () => "temporary-secret",
    hashCredential: async (credential) => `hashed:${credential}`,
    generateId: (() => {
      const ids = ["tenant-1", "user-1", "account-1"];
      return () => ids.shift()!;
    })(),
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    store,
  });

  const result = await approve({ applicationId: "application-1", subdomain: "  SMAN-1-Bandung  " });

  assert.deepEqual(result, {
    ok: true,
    status: "approved",
    tenantId: "tenant-1",
    schoolAdminEmail: "admin@sman1.test",
    temporaryCredential: "temporary-secret",
  });
  assert.deepEqual(events, ["transaction", "lock:application-1", "check-conflicts", "provision"]);
  assert.deepEqual(provisions, [{
    applicationId: "application-1",
    providerAdminId: "provider-1",
    tenant: {
      id: "tenant-1",
      name: "SMA Negeri 1 Bandung",
      npsn: "20200001",
      subdomain: "sman-1-bandung",
    },
    schoolAdmin: {
      id: "user-1",
      name: "Siti Aminah",
      email: "admin@sman1.test",
    },
    accountId: "account-1",
    credentialHash: "hashed:temporary-secret",
    decidedAt: new Date("2026-07-18T12:00:00.000Z"),
  }]);
});

test("approval validates the editable subdomain before opening a transaction", async () => {
  const { events, store } = approvalStore(pendingApproval);
  const approve = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    generateCredential: () => "secret",
    hashCredential: async () => "hash",
    store,
  });

  const result = await approve({ applicationId: "application-1", subdomain: "Tidak valid!" });

  assert.deepEqual(result, {
    ok: false,
    code: "invalid-input",
    errors: { subdomain: "Subdomain hanya boleh berisi huruf kecil, angka, dan tanda hubung." },
  });
  assert.deepEqual(events, []);
});

test("retrying an approved application returns its Tenant without another credential", async () => {
  const approved = { ...pendingApproval, status: "approved" as const, approvedTenantId: "tenant-existing" };
  const { provisions, store } = approvalStore(approved);
  const approve = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    generateCredential: () => "unused-secret",
    hashCredential: async () => "unused-hash",
    store,
  });

  const result = await approve({ applicationId: approved.id, subdomain: "sman-1-bandung" });

  assert.deepEqual(result, { ok: true, status: "already-approved", tenantId: "tenant-existing" });
  assert.deepEqual(provisions, []);
});

test("approval maps rejected state and database collisions to safe domain conflicts", async () => {
  const rejected = { ...pendingApproval, status: "rejected" as const };
  const rejectedStore = approvalStore(rejected);
  const rejectApprove = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    generateCredential: () => "secret",
    hashCredential: async () => "hash",
    store: rejectedStore.store,
  });
  assert.deepEqual(await rejectApprove({ applicationId: rejected.id, subdomain: "sman-1" }), {
    ok: false,
    code: "decision-conflict",
    status: "rejected",
  });

  const collidingStore: ApplicationApprovalStore = {
    async transaction() { throw new ApprovalConflictError("email"); },
  };
  const collisionApprove = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    generateCredential: () => "secret",
    hashCredential: async () => "hash",
    store: collidingStore,
  });
  assert.deepEqual(await collisionApprove({ applicationId: "application-1", subdomain: "sman-1" }), {
    ok: false,
    code: "resource-conflict",
    field: "email",
  });
});

test("subdomain suggestions are stable, DNS-safe, and editable", () => {
  assert.equal(suggestSubdomain("  SMA Négeri 1 — Bandung  "), "sma-negeri-1-bandung");
});
