import assert from "node:assert/strict";
import test from "node:test";

import {
  OpenWaApiError,
  type OpenWaClient,
} from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";
import type { ConnectWhatsAppBotResult } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import type { WhatsAppBotRequestRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";
import {
  completeWhatsAppBotSelfService,
  readSelfServiceQr,
  readSelfServiceSessionStatus,
  startWhatsAppBotSelfService,
  type WhatsAppBotSelfServiceDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-self-service";

function makeRequest(overrides: Partial<WhatsAppBotRequestRecord> = {}): WhatsAppBotRequestRecord {
  return {
    id: "req-1",
    tenantId: "tenant-1",
    requestedPhone: "6281234567890",
    desiredSessionName: "sdn1-wa",
    picName: "Pak Budi",
    note: null,
    status: "approved",
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

type StubCredentials = { apiKey: string; sessionKey: string };

function makeDependencies(overrides: {
  requests?: Map<string, WhatsAppBotRequestRecord>;
  conflicts?: Set<string>;
  qrStatus?: string;
  sessionStatus?: string;
  openWaClient?: unknown;
  adminApiKey?: string | null;
  adminApiBaseUrl?: string | null;
  connectResult?: ConnectWhatsAppBotResult;
} = {}) {
  const requests = overrides.requests ?? new Map<string, WhatsAppBotRequestRecord>();
  if (!requests.has("req-1")) requests.set("req-1", makeRequest());

  const calls: string[] = [];
  const credentials: StubCredentials[] = [];
  const marked: string[] = [];

  const clientStub = (overrides.openWaClient as Partial<OpenWaClient>) ?? {
    createSession: async (name: string) => {
      calls.push(`create:${name}`);
      if (overrides.conflicts?.has(name)) throw new OpenWaApiError("conflict", `duplicate ${name}`);
      return { id: `sess-${name}`, name, status: "created", phone: null, pushName: null };
    },
    startSession: async (sessionId: string) => {
      calls.push(`start:${sessionId}`);
      return { id: sessionId, name: `sess-${sessionId}`, status: "qr_ready", phone: null, pushName: null };
    },
    createApiKey: async (input: { name: string; role: string; allowedSessions: string[] }) => {
      calls.push(`key:${input.name}`);
      return {
        id: "key-1",
        keyPrefix: "owa_k1_ab",
        role: input.role,
        allowedSessions: input.allowedSessions,
        apiKey: "admin-owned-key-123",
      };
    },
    getSession: async (sessionId: string) => {
      calls.push(`session:${sessionId}`);
      return {
        id: sessionId,
        name: `sess-${sessionId}`,
        status: overrides.sessionStatus ?? "qr_ready",
        phone: null,
        pushName: null,
      };
    },
    getSessionQr: async (sessionId: string) => {
      calls.push(`qr:${sessionId}`);
      return { qrCode: "data:image/png;base64,qr", status: overrides.qrStatus ?? "qr_ready" };
    },
  };

  const deps: WhatsAppBotSelfServiceDependencies = {
    readLatestRequest: async (tenantId: string) =>
      [...requests.values()].reverse().find((r) => r.tenantId === tenantId) ?? null,
    updateRequest: async (id: string, changes) => {
      const current = requests.get(id);
      if (current) requests.set(id, { ...current, ...changes });
    },
    createClient: (config: OpenWaConnectionConfig) => {
      calls.push(`client:${config.apiKey}`);
      return clientStub as OpenWaClient;
    },
    adminApiBaseUrl: overrides.adminApiBaseUrl === undefined ? "https://openwa.example.com" : overrides.adminApiBaseUrl,
    adminApiKey: overrides.adminApiKey === undefined ? "admin-key" : overrides.adminApiKey,
    upsertCredential: async (input) => {
      calls.push(`credential:${input.sessionKey}`);
      credentials.push({ apiKey: input.apiKey, sessionKey: input.sessionKey });
    },
    connect: async (domain: string, tenantId: string) => {
      calls.push(`connect:${domain}:${tenantId}`);
      return overrides.connectResult ?? { ok: true, sessionId: "sess-sdn1-wa", sessionName: "sdn1-wa", webhookId: "wh-1" };
    },
    markFulfilled: async (requestId: string, _actorId: string, method: "self_service") => {
      calls.push(`fulfill:${requestId}:${method}`);
      marked.push(requestId);
      const current = requests.get(requestId);
      if (current) requests.set(requestId, { ...current, status: "fulfilled", resolutionMethod: method });
      return { ok: true };
    },
  };

  return { deps, requests, calls, credentials, marked };
}

test("start rejects a request that is not approved", async () => {
  const { deps, requests } = makeDependencies();
  requests.set("req-1", makeRequest({ status: "pending" }));
  assert.deepEqual(await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev"), { ok: false, code: "not-approved" });
});

test("start reports provisioning-disabled without an admin key", async () => {
  const { deps } = makeDependencies({ adminApiKey: null });
  assert.deepEqual(await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev"), { ok: false, code: "provisioning-disabled" });
});

test("start provisions a session and a scoped operator API key", async () => {
  const { deps, requests, calls, credentials } = makeDependencies();
  const result = await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.sessionName, "sdn1-wa");
    assert.equal(result.alreadyStarted, false);
    assert.ok(calls.includes("create:sdn1-wa"));
    assert.ok(calls.includes("start:sess-sdn1-wa"));
    assert.ok(calls.some((c) => c.startsWith("key:sdn1-wa-key")));
    assert.deepEqual(credentials, [{ apiKey: "admin-owned-key-123", sessionKey: "sdn1-wa" }]);
    assert.equal(requests.get("req-1")!.openwaSessionId, "sess-sdn1-wa");
  }
});

test("start retries with a numeric suffix when the session name is taken", async () => {
  const { deps } = makeDependencies({ conflicts: new Set(["sdn1-wa", "sdn1-wa-2"]) });
  const result = await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.sessionName, "sdn1-wa-3");
});

test("start fails when every candidate session name is taken", async () => {
  const { deps } = makeDependencies({
    conflicts: new Set(["sdn1-wa", "sdn1-wa-2", "sdn1-wa-3", "sdn1-wa-4", "sdn1-wa-5", "sdn1-wa-6"]),
  });
  assert.deepEqual(await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev"), { ok: false, code: "session-name-taken" });
});

test("start is idempotent: an existing session id is returned without re-provisioning", async () => {
  const { deps, calls } = makeDependencies();
  const initial = await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev");
  assert.ok(initial.ok);
  const callsAfterFirst = calls.length;

  const again = await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev");
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.alreadyStarted, true);
  assert.equal(calls.length, callsAfterFirst);
});

test("start maps unauthorized admin key errors", async () => {
  const openWaClient = {
    createSession: async () => {
      throw new OpenWaApiError("unauthorized", "bad key");
    },
  };
  const { deps } = makeDependencies({ openWaClient });
  assert.deepEqual(await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev"), { ok: false, code: "admin-key-invalid" });
});

test("start maps start-session failures", async () => {
  const openWaClient = {
    createSession: async () => ({
      id: "sess-sdn1-wa",
      name: "sdn1-wa",
      status: "created",
      phone: null,
      pushName: null,
    }),
    startSession: async () => {
      throw new OpenWaApiError("unreachable", "network down");
    },
  };
  const { deps, calls } = makeDependencies({ openWaClient });
  const result = await startWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev");
  assert.deepEqual(result, { ok: false, code: "openwa-unreachable" });
  assert.ok(!calls.some((c) => c.startsWith("key:")));
});

test("qr requires an approved, started request", async () => {
  const { deps, requests } = makeDependencies();
  assert.deepEqual(await readSelfServiceQr(deps, "tenant-1"), { ok: false, code: "not-started" });

  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));
  const qr = await readSelfServiceQr(deps, "tenant-1");
  assert.equal(qr.ok, true);
  if (qr.ok) assert.equal(qr.qrCode, "data:image/png;base64,qr");
});

test("complete reports session-not-ready until the QR was scanned", async () => {
  const { deps, requests, marked } = makeDependencies({ connectResult: { ok: false, code: "session-not-found" } });
  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));

  const result = await completeWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev", "user-1");
  assert.deepEqual(result, { ok: false, code: "session-not-ready" });
  assert.equal(marked.length, 0);
});

test("complete connects the webhook and fulfills the approved request", async () => {
  const { deps, requests, marked } = makeDependencies();
  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));

  const result = await completeWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev", "user-1");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.sessionId, "sess-sdn1-wa");
    assert.equal(result.webhookId, "wh-1");
  }
  assert.deepEqual(marked, ["req-1"]);
  assert.equal(requests.get("req-1")!.status, "fulfilled");
  assert.equal(requests.get("req-1")!.resolutionMethod, "self_service");
});

test("complete rejects a request that never started", async () => {
  const { deps } = makeDependencies();
  assert.deepEqual(await completeWhatsAppBotSelfService(deps, "tenant-1", "sdn-191.simas.dev", "user-1"), { ok: false, code: "not-started" });
});

test("status check requires an approved, started request", async () => {
  const { deps } = makeDependencies();
  assert.deepEqual(await readSelfServiceSessionStatus(deps, "tenant-1"), { ok: false, code: "not-started" });
});

test("status poll reports qr_ready as not yet connected", async () => {
  const { deps, requests, calls } = makeDependencies();
  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));

  const result = await readSelfServiceSessionStatus(deps, "tenant-1");
  assert.deepEqual(result, { ok: true, status: "qr_ready", connected: false });
  assert.ok(calls.includes("session:sess-sdn1-wa"));
});

test("status poll reports connected once the phone linked", async () => {
  const { deps, requests } = makeDependencies({ sessionStatus: "connected" });
  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));

  const result = await readSelfServiceSessionStatus(deps, "tenant-1");
  assert.deepEqual(result, { ok: true, status: "connected", connected: true });
});

test("status poll maps unexpected errors", async () => {
  const { deps, requests } = makeDependencies({
    openWaClient: {
      getSession: async () => {
        throw new Error("boom");
      },
    },
  });
  requests.set("req-1", makeRequest({ openwaSessionId: "sess-sdn1-wa" }));

  const result = await readSelfServiceSessionStatus(deps, "tenant-1");
  assert.deepEqual(result, { ok: false, code: "openwa-error" });
});