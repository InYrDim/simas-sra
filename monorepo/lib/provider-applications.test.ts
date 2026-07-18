import assert from "node:assert/strict";
import test from "node:test";

import {
  createRejectSimasApplicationCommand,
  type ApplicationDecisionStore,
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

test("terminal application decisions cannot transition again", async () => {
  for (const status of ["approved", "rejected"] as const) {
    const { decisions, store } = recordingStore({ id: "application-1", status });
    const reject = createRejectSimasApplicationCommand({
      authorize: async () => principal,
      store,
    });

    const result = await reject({ applicationId: "application-1", reason: "Tidak memenuhi syarat" });

    assert.deepEqual(result, { ok: false, code: "decision-conflict", status });
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
