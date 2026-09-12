import assert from "node:assert/strict";
import test from "node:test";

import {
  approveWhatsAppBotRequest,
  buildSessionName,
  markWhatsAppBotRequestFulfilled,
  normalizeSessionName,
  normalizeWhatsAppPhone,
  rejectWhatsAppBotRequest,
  submitWhatsAppBotRequest,
  type WhatsAppBotRequestDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request";
import type { WhatsAppBotConnectionRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { WhatsAppBotRequestInsert, WhatsAppBotRequestRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";

function makeRequest(overrides: Partial<WhatsAppBotRequestRecord> = {}): WhatsAppBotRequestRecord {
  return {
    id: "req-1",
    tenantId: "tenant-1",
    requestedPhone: "6281234567890",
    desiredSessionName: null,
    picName: "Pak Budi",
    note: null,
    status: "pending",
    providerNote: null,
    resolutionMethod: null,
    openwaSessionId: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeConnection(): WhatsAppBotConnectionRecord {
  return {
    tenantId: "tenant-1",
    openwaSessionId: "sess-1",
    openwaSessionName: "sdn1-wa",
    openwaWebhookId: "wh-1",
    status: "connected",
    botPhone: "62812",
    botPushName: "Hadir",
    lastError: null,
  };
}

function makeDependencies(
  overrides: Partial<WhatsAppBotRequestDependencies> = {},
): { store: Map<string, WhatsAppBotRequestRecord>; deps: WhatsAppBotRequestDependencies } {
  const store = new Map<string, WhatsAppBotRequestRecord>();
  return {
    store,
    deps: {
      readLatestRequest: async (tenantId: string) =>
        [...store.values()].reverse().find((r) => r.tenantId === tenantId) ?? null,
      readConnection: async () => null,
      createRequest: async (input: WhatsAppBotRequestInsert) => {
        store.set(input.id, makeRequest({ ...input }));
      },
      readRequestById: async (id: string) => store.get(id) ?? null,
      updateRequest: async (id: string, changes) => {
        const current = store.get(id);
        if (current) store.set(id, { ...current, ...changes });
      },
      ...overrides,
    },
  };
}

test("normalizeWhatsAppPhone converts leading 0 and 8 prefixes to the 62 form", () => {
  assert.equal(normalizeWhatsAppPhone("081234567890"), "6281234567890");
  assert.equal(normalizeWhatsAppPhone("81234567890"), "6281234567890");
  assert.equal(normalizeWhatsAppPhone("+62 812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsAppPhone("6281234567890"), "6281234567890");
});

test("normalizeWhatsAppPhone rejects malformed numbers", () => {
  assert.equal(normalizeWhatsAppPhone(""), null);
  assert.equal(normalizeWhatsAppPhone("abc"), null);
  assert.equal(normalizeWhatsAppPhone("08123"), null);
  assert.equal(normalizeWhatsAppPhone("0812345678901234567"), null);
});

test("normalizeSessionName only accepts a 3-50 char alphanumeric-dash name", () => {
  assert.equal(normalizeSessionName("sdn1-wa"), "sdn1-wa");
  assert.equal(normalizeSessionName("  sdn1-wa  "), "sdn1-wa");
  assert.equal(normalizeSessionName(null), null);
  assert.equal(normalizeSessionName(""), null);
  assert.equal(normalizeSessionName("ab"), null);
  assert.equal(normalizeSessionName("bad name!"), null);
});

test("buildSessionName prefers the desired name and falls back to <domain>-wa", () => {
  assert.equal(buildSessionName("sdn-191.simas.dev", "sdn1-wa"), "sdn1-wa");
  assert.equal(buildSessionName("sdn-191.simas.dev", null), "sdn-191-wa");
  assert.equal(buildSessionName("!!", null), "sekolah-wa");
});

test("submit accepts a valid request and records the normalized phone", async () => {
  const { deps, store } = makeDependencies();
  const result = await submitWhatsAppBotRequest(deps, "tenant-1", {
    requestedPhone: "0812-3456-7890",
    desiredSessionName: "sdn1-wa",
    picName: "  Pak Budi  ",
    note: "  Untuk pengumuman orang tua  ",
  });
  assert.ok(result.ok);
  assert.ok(store.has(result.requestId));
  const record = store.get(result.requestId)!;
  assert.equal(record.requestedPhone, "6281234567890");
  assert.equal(record.desiredSessionName, "sdn1-wa");
  assert.equal(record.picName, "Pak Budi");
  assert.equal(record.note, "Untuk pengumuman orang tua");
  assert.equal(record.status, "pending");
});

test("submit rejects invalid phone, missing PIC, and invalid session name", async () => {
  const { deps } = makeDependencies();
  assert.equal(
    (await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "x", desiredSessionName: null, picName: "P", note: null })).ok,
    false,
  );
  assert.deepEqual(
    await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "   ", note: null }),
    { ok: false, code: "pic-required" },
  );
  assert.deepEqual(
    await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: "bad name", picName: "P", note: null }),
    { ok: false, code: "session-name-invalid" },
  );
  assert.deepEqual(
    await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "P", note: "x".repeat(1001) }),
    { ok: false, code: "note-too-long" },
  );
});

test("submit is blocked while the tenant already has a connection", async () => {
  const { deps } = makeDependencies({ readConnection: async () => makeConnection() });
  assert.deepEqual(
    await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "P", note: null }),
    { ok: false, code: "connection-exists" },
  );
});

test("submit is blocked while a pending or approved request exists", async () => {
  const approved = makeDependencies();
  approved.store.set("req-old", makeRequest({ id: "req-old", tenantId: "tenant-1", status: "approved" }));
  assert.deepEqual(
    await submitWhatsAppBotRequest(approved.deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "P", note: null }),
    { ok: false, code: "request-pending" },
  );

  const pending = makeDependencies();
  pending.store.set("req-old", makeRequest({ id: "req-old", tenantId: "tenant-1", status: "pending" }));
  assert.deepEqual(
    await submitWhatsAppBotRequest(pending.deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "P", note: null }),
    { ok: false, code: "request-pending" },
  );
});

test("submit succeeds again after a rejected request", async () => {
  const { deps, store } = makeDependencies();
  store.set("req-old", makeRequest({ id: "req-old", tenantId: "tenant-1", status: "rejected", providerNote: "Nomor tidak valid" }));
  const result = await submitWhatsAppBotRequest(deps, "tenant-1", { requestedPhone: "081234567890", desiredSessionName: null, picName: "P", note: null });
  assert.ok(result.ok);
});

test("approve transitions only a pending request", async () => {
  const { deps, store } = makeDependencies();
  store.set("req-1", makeRequest());
  assert.deepEqual(await approveWhatsAppBotRequest(deps, "req-1", null), { ok: true });
  assert.equal(store.get("req-1")!.status, "approved");

  assert.deepEqual(await approveWhatsAppBotRequest(deps, "req-1", null), { ok: false, code: "not-approvable" });
  assert.deepEqual(await approveWhatsAppBotRequest(deps, "missing", null), { ok: false, code: "not-found" });
});

test("reject transitions only a pending request and records the note and actor", async () => {
  const { deps, store } = makeDependencies();
  store.set("req-1", makeRequest());
  assert.deepEqual(await rejectWhatsAppBotRequest(deps, "req-1", "admin-1", "  Nomor belum aktif  "), { ok: true });
  const rejected = store.get("req-1")!;
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.providerNote, "Nomor belum aktif");
  assert.equal(rejected.resolvedBy, "admin-1");
  assert.ok(rejected.resolvedAt);

  assert.deepEqual(await rejectWhatsAppBotRequest(deps, "req-1", "admin-1", null), { ok: false, code: "already-resolved" });
});

test("markFulfilled works from pending and approved with a resolution method", async () => {
  const { deps, store } = makeDependencies();
  store.set("req-1", makeRequest({ status: "pending" }));
  store.set("req-2", makeRequest({ id: "req-2", status: "approved" }));
  store.set("req-3", makeRequest({ id: "req-3", status: "rejected" }));

  assert.deepEqual(await markWhatsAppBotRequestFulfilled(deps, "req-1", "admin-1", "provider"), { ok: true });
  assert.equal(store.get("req-1")!.status, "fulfilled");
  assert.equal(store.get("req-1")!.resolutionMethod, "provider");

  assert.deepEqual(await markWhatsAppBotRequestFulfilled(deps, "req-2", "admin-1", "self_service"), { ok: true });
  assert.equal(store.get("req-2")!.resolutionMethod, "self_service");

  assert.deepEqual(await markWhatsAppBotRequestFulfilled(deps, "req-3", "admin-1", "provider"), { ok: false, code: "already-resolved" });
  assert.deepEqual(await markWhatsAppBotRequestFulfilled(deps, "missing", "admin-1", "provider"), { ok: false, code: "not-found" });
});