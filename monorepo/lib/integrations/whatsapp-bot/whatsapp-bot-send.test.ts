import assert from "node:assert/strict";
import test from "node:test";

import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { WhatsAppBotConnectionRecord, OutboundMessageRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
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
    sendText: async () => ({ messageId: "msg-1", timestamp: 1706868000 }),
    ...overrides,
  } as unknown as OpenWaClient;
}

type Calls = {
  sentMessages: Array<{ chatId: string; text: string }>;
  clients: Array<{ apiBaseUrl: string; apiKey: string }>;
  recorded: OutboundMessageRecord[];
};

function makeDeps(overrides?: Partial<WhatsAppBotSendDependencies>): {
  deps: WhatsAppBotSendDependencies;
  calls: Calls;
} {
  const calls: Calls = { sentMessages: [], clients: [], recorded: [] };
  const deps: WhatsAppBotSendDependencies = {
    resolveCredential: async () => credential(),
    createClient: (config) => {
      calls.clients.push(config);
      return stubClient({
        sendText: async (sessionId, input) => {
          calls.sentMessages.push({ chatId: input.chatId, text: input.text });
          assert.equal(sessionId, "sess-1");
          return { messageId: "msg-1", timestamp: 1706868000 };
        },
      });
    },
    readConnectionByTenantId: async () => connectionRecord(),
    recordOutboundMessage: async (record) => {
      calls.recorded.push(record);
    },
    ...overrides,
  };
  return { deps, calls };
}

test("sendWhatsAppText normalizes a bare phone number to a WhatsApp JID", async () => {
  const { deps, calls } = makeDeps();

  const result = await sendWhatsAppText(deps, "tenant-a", { chatId: "62815551234", text: "Jadwal berubah." });
  assert.deepEqual(result, { ok: true, messageId: "msg-1" });

  assert.deepEqual(calls.sentMessages, [{ chatId: "62815551234@c.us", text: "Jadwal berubah." }]);
  assert.equal(calls.recorded[0].chatId, "62815551234@c.us");
  assert.equal(calls.recorded[0].toWa, "62815551234@c.us");
  assert.equal(calls.recorded[0].isGroup, false);
});

test("sendWhatsAppText keeps an already-fully-qualified JID unchanged", async () => {
  const { deps, calls } = makeDeps();

  const result = await sendWhatsAppText(deps, "tenant-a", { chatId: " 62815551234@c.us ", text: "Hai" });
  assert.deepEqual(result, { ok: true, messageId: "msg-1" });
  assert.deepEqual(calls.sentMessages, [{ chatId: "62815551234@c.us", text: "Hai" }]);
});

test("sendWhatsAppText forwards the message and records the outbound row", async () => {
  const { deps, calls } = makeDeps();

  const result = await sendWhatsAppText(deps, "tenant-a", { chatId: "62815551234@c.us", text: "Jadwal berubah." });
  assert.deepEqual(result, { ok: true, messageId: "msg-1" });

  assert.deepEqual(calls.clients, [{ apiBaseUrl: "https://openwa.example.com", apiKey: "k-123" }]);
  assert.deepEqual(calls.sentMessages, [{ chatId: "62815551234@c.us", text: "Jadwal berubah." }]);
  assert.equal(calls.recorded.length, 1);
  assert.equal(calls.recorded[0].tenantId, "tenant-a");
  assert.equal(calls.recorded[0].openwaMessageId, "msg-1");
  assert.equal(calls.recorded[0].chatId, "62815551234@c.us");
  assert.equal(calls.recorded[0].fromWa, "62812");
  assert.equal(calls.recorded[0].toWa, "62815551234@c.us");
  assert.equal(calls.recorded[0].deliveryStatus, "sent");
  assert.ok(calls.recorded[0].sentAt instanceof Date);
});

test("sendWhatsAppText trims and rejects empty input", async () => {
  const { deps, calls } = makeDeps();
  assert.deepEqual(
    await sendWhatsAppText(deps, "tenant-a", { chatId: "  ", text: "hai" }),
    { ok: false, code: "recipient-invalid" },
  );
  assert.deepEqual(
    await sendWhatsAppText(deps, "tenant-a", { chatId: "6281", text: "  " }),
    { ok: false, code: "recipient-invalid" },
  );
  assert.equal(calls.recorded.length, 0);
  assert.equal(calls.sentMessages.length, 0);
});

test("sendWhatsAppText returns unconfigured without credentials or base URL", async () => {
  const without = makeDeps({ resolveCredential: async () => null });
  assert.deepEqual(await sendWhatsAppText(without.deps, "tenant-a", { chatId: "6281", text: "hai" }), {
    ok: false,
    code: "unconfigured",
  });

  const noBaseUrl = makeDeps({ resolveCredential: async () => credential({ apiBaseUrl: null }) });
  assert.deepEqual(await sendWhatsAppText(noBaseUrl.deps, "tenant-a", { chatId: "6281", text: "hai" }), {
    ok: false,
    code: "unconfigured",
  });
});

test("sendWhatsAppText returns not-connected when the session is not connected", async () => {
  const { deps } = makeDeps({
    readConnectionByTenantId: async () => connectionRecord({ status: "error" }),
  });
  assert.deepEqual(await sendWhatsAppText(deps, "tenant-a", { chatId: "6281", text: "hai" }), {
    ok: false,
    code: "not-connected",
  });
});

test("sendWhatsAppText maps OpenWA send errors to result codes", async () => {
  const conflict = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new OpenWaApiError("conflict", "reconnecting");
        },
      }),
  });
  assert.deepEqual(
    await sendWhatsAppText(conflict.deps, "tenant-a", { chatId: "6281", text: "hai" }),
    { ok: false, code: "session-not-ready" },
  );

  const unreachable = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new OpenWaApiError("unreachable", "down");
        },
      }),
  });
  assert.deepEqual(
    await sendWhatsAppText(unreachable.deps, "tenant-a", { chatId: "6281", text: "hai" }),
    { ok: false, code: "openwa-unreachable" },
  );

  const invalid = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new OpenWaApiError("invalid", "undeliverable");
        },
      }),
  });
  assert.deepEqual(
    await sendWhatsAppText(invalid.deps, "tenant-a", { chatId: "6281", text: "hai" }),
    { ok: false, code: "recipient-invalid" },
  );
});

test("sendWhatsAppText does not record a message when the send fails", async () => {
  const { deps, calls } = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new OpenWaApiError("conflict", "reconnecting");
        },
      }),
  });
  await sendWhatsAppText(deps, "tenant-a", { chatId: "6281", text: "hai" });
  assert.equal(calls.recorded.length, 0);
});

test("sendWhatsAppText marks group chats as groups in the recorded row", async () => {
  const { deps, calls } = makeDeps();
  const result = await sendWhatsAppText(deps, "tenant-a", { chatId: "1203630000000@g.us", text: "Pengumuman" });
  assert.equal(result.ok, true);
  assert.equal(calls.recorded[0].isGroup, true);
});

test("sendWhatsAppText on an unauthorized key maps to openwa-unreachable", async () => {
  const { deps } = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new OpenWaApiError("unauthorized", "bad key");
        },
      }),
  });
  assert.deepEqual(await sendWhatsAppText(deps, "tenant-a", { chatId: "6281", text: "hai" }), {
    ok: false,
    code: "openwa-unreachable",
  });
});

test("sendWhatsAppText on an unexpected error maps to error and records nothing", async () => {
  const { deps, calls } = makeDeps({
    createClient: () =>
      stubClient({
        sendText: async () => {
          throw new Error("boom");
        },
      }),
  });
  assert.deepEqual(await sendWhatsAppText(deps, "tenant-a", { chatId: "6281", text: "hai" }), {
    ok: false,
    code: "error",
  });
  assert.equal(calls.recorded.length, 0);
});