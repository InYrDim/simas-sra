import assert from "node:assert/strict";
import test from "node:test";

import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { WhatsAppBotConnectionRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { WhatsAppBotConnectionDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import {
  connectWhatsAppBot,
  disconnectWhatsAppBot,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-connection";
import type { ResolvedTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

function connectionRecord(overrides: Partial<WhatsAppBotConnectionRecord> = {}): WhatsAppBotConnectionRecord {
  return {
    tenantId: "tenant-a",
    openwaSessionId: "sess-1",
    openwaSessionName: "HadirBot",
    openwaWebhookId: "wh-1",
    status: "connected",
    botPhone: "62812",
    botPushName: "Hadir",
    lastError: null,
    ...overrides,
  };
}

function credential(overrides: Partial<ResolvedTenantOpenWaCredential> = {}): ResolvedTenantOpenWaCredential {
  return {
    tenantId: "tenant-a",
    apiBaseUrl: "https://openwa.example.com",
    usingGlobalDefault: true,
    apiKey: "k-123",
    sessionKey: "HadirBot",
    ...overrides,
  };
}

function stubClient(overrides: Partial<OpenWaClient> = {}): OpenWaClient {
  return {
    resolveSession: async () => ({
      id: "sess-1",
      name: "HadirBot",
      status: "ready",
      phone: "62812",
      pushName: "Hadir",
    }),
    createWebhook: async () => ({ id: "wh-1", url: "https://unused", active: true }),
    deleteWebhook: async () => {},
    ...overrides,
  } as unknown as OpenWaClient;
}

type Calls = {
  upserted: WhatsAppBotConnectionRecord[];
  removed: number;
  revalidated: string[];
  clients: Array<{ apiBaseUrl: string; apiKey: string }>;
};

function makeDeps(overrides?: Partial<WhatsAppBotConnectionDependencies>): {
  deps: WhatsAppBotConnectionDependencies;
  calls: Calls;
} {
  const calls: Calls = { upserted: [], removed: 0, revalidated: [], clients: [] };
  const deps: WhatsAppBotConnectionDependencies = {
    resolveCredential: async () => credential(),
    createClient: (config) => {
      calls.clients.push(config);
      return stubClient();
    },
    readConnectionBySessionKey: async () => null,
    readConnectionByTenantId: async () => null,
    upsertConnection: async (record) => {
      calls.upserted.push(record);
    },
    removeConnection: async () => {
      calls.removed += 1;
    },
    webhookUrl: "https://app.example.com/api/integrations/whatsapp-bot/webhook",
    deriveSecret: () => "tenant-secret",
    revalidate: (domain) => {
      calls.revalidated.push(domain);
    },
    ...overrides,
  };
  return { deps, calls };
}

test("connect registers the configured session and returns the webhook", async () => {
  const { deps, calls } = makeDeps();

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sessionId, "sess-1");
  assert.equal(result.sessionName, "HadirBot");
  assert.equal(result.webhookId, "wh-1");

  assert.deepEqual(calls.clients, [{ apiBaseUrl: "https://openwa.example.com", apiKey: "k-123" }]);
  assert.equal(calls.upserted.length, 1);
  assert.equal(calls.upserted[0].tenantId, "tenant-a");
  assert.equal(calls.upserted[0].openwaWebhookId, "wh-1");
  assert.equal(calls.upserted[0].status, "connected");
  assert.deepEqual(calls.revalidated, ["acme"]);
});

test("connect returns unconfigured when the tenant has no credentials", async () => {
  const { deps } = makeDeps({
    resolveCredential: async () => null,
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "unconfigured" });
});

test("connect returns unconfigured when no base URL resolves", async () => {
  const { deps } = makeDeps({
    resolveCredential: async () => credential({ apiBaseUrl: null }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "unconfigured" });
});

test("connect maps missing sessions to session-not-found", async () => {
  const { deps } = makeDeps({
    createClient: () =>
      stubClient({
        resolveSession: async () => {
          throw new OpenWaApiError("not-found", "missing");
        },
      }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "session-not-found" });
});

test("connect rejects a session that is not ready yet", async () => {
  const { deps } = makeDeps({
    createClient: () =>
      stubClient({
        resolveSession: async () => ({
          id: "sess-1",
          name: "HadirBot",
          status: "pending",
          phone: null,
          pushName: null,
        }),
      }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "session-not-found" });
});

test("connect surfaces openwa-unreachable when resolving the session fails across the network", async () => {
  const { deps } = makeDeps({
    createClient: () =>
      stubClient({
        resolveSession: async () => {
          throw new OpenWaApiError("unreachable", "down");
        },
      }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "openwa-unreachable" });
});

test("connect rejects a session already owned by another tenant", async () => {
  const { deps } = makeDeps({
    readConnectionBySessionKey: async () => connectionRecord({ tenantId: "tenant-b" }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "session-in-use" });
});

test("reconnecting the same session reuses the existing webhook", async () => {
  let created = 0;
  let deleted = 0;
  const client = stubClient({
    createWebhook: async () => {
      created += 1;
      return { id: "wh-new", url: "https://unused", active: true };
    },
    deleteWebhook: async () => {
      deleted += 1;
    },
  });
  const { deps, calls } = makeDeps({
    createClient: () => client,
    readConnectionByTenantId: async () => connectionRecord(),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.webhookId, "wh-1");
  assert.equal(created, 0);
  assert.equal(deleted, 0);
  assert.equal(calls.upserted[0].openwaWebhookId, "wh-1");
});

test("moving to a different session deletes the old webhook and registers a new one", async () => {
  let created = 0;
  let deleted = 0;
  const client = stubClient({
    createWebhook: async () => {
      created += 1;
      return { id: "wh-2", url: "https://unused", active: true };
    },
    deleteWebhook: async () => {
      deleted += 1;
    },
  });
  const { deps, calls } = makeDeps({
    createClient: () => client,
    readConnectionByTenantId: async () =>
      connectionRecord({
        openwaSessionId: "old-sess",
        openwaSessionName: "OldBot",
        openwaWebhookId: "wh-old",
      }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.webhookId, "wh-2");
  assert.equal(deleted, 1);
  assert.equal(created, 1);
  assert.equal(calls.upserted[0].openwaWebhookId, "wh-2");
});

test("connect maps webhook registration failures to webhook-failed", async () => {
  const { deps } = makeDeps({
    createClient: () =>
      stubClient({
        createWebhook: async () => {
          throw new OpenWaApiError("invalid", "bad payload");
        },
      }),
  });

  const result = await connectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "webhook-failed" });
});

test("disconnect with no connection is a no-op success", async () => {
  const { deps, calls } = makeDeps();

  const result = await disconnectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.removed, 0);
  assert.deepEqual(calls.revalidated, ["acme"]);
});

test("disconnect removes the OpenWA webhook and the local row", async () => {
  let deleted = 0;
  const client = stubClient({
    deleteWebhook: async () => {
      deleted += 1;
    },
  });
  const { deps, calls } = makeDeps({
    createClient: () => client,
    readConnectionByTenantId: async () => connectionRecord(),
  });

  const result = await disconnectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: true });
  assert.equal(deleted, 1);
  assert.equal(calls.removed, 1);
});

test("disconnect keeps the local row when OpenWA is unreachable", async () => {
  const { deps, calls } = makeDeps({
    createClient: () =>
      stubClient({
        deleteWebhook: async () => {
          throw new OpenWaApiError("unreachable", "down");
        },
      }),
    readConnectionByTenantId: async () => connectionRecord(),
  });

  const result = await disconnectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: false, code: "openwa-unreachable" });
  assert.equal(calls.removed, 0);
});

test("disconnect drops the local row when credentials were removed by the Provider", async () => {
  let clientCalled = false;
  const { deps, calls } = makeDeps({
    resolveCredential: async () => null,
    createClient: () => {
      clientCalled = true;
      return stubClient();
    },
    readConnectionByTenantId: async () => connectionRecord(),
  });

  const result = await disconnectWhatsAppBot(deps, "acme", "tenant-a");
  assert.deepEqual(result, { ok: true });
  assert.equal(clientCalled, false);
  assert.equal(calls.removed, 1);
});