import assert from "node:assert/strict";
import test from "node:test";

import { OpenWaApiError, OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";

const config: OpenWaConnectionConfig = {
  apiBaseUrl: "https://openwa.example.com",
  apiKey: "k-123",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("getSession parses a top-level session payload with phone, pushName, and status", async () => {
  let requestedPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      requestedPath = String(input).replace(config.apiBaseUrl, "");
      return jsonResponse({
        id: "sess-1",
        name: "HadirBot",
        status: "ready",
        phone: "62812",
        pushName: "Hadir",
      });
    },
  });

  const session = await client.getSession("sess-1");
  assert.ok(session);
  assert.equal(session.id, "sess-1");
  assert.equal(session.name, "HadirBot");
  assert.equal(session.status, "ready");
  assert.equal(session.phone, "62812");
  assert.equal(session.pushName, "Hadir");
  assert.equal(requestedPath, "/api/sessions/sess-1");
});

test("getSession tolerates a nested client payload for phone and pushName", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ data: { id: "s1", name: "A", client: { phone: "628", pushName: "P" } } }),
  });
  const session = await client.getSession("s1");
  assert.equal(session?.phone, "628");
  assert.equal(session?.pushName, "P");
});

test("getSession returns null for a 404", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ error: "missing" }, 404),
  });
  assert.equal(await client.getSession("missing"), null);
});

test("getSession returns null for a 400 invalid (non-UUID input)", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ error: "Validation failed (uuid is expected)" }, 400),
  });
  assert.equal(await client.getSession("lab-bot"), null);
});

test("listSessions unwraps the data envelope and filters invalid entries", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () =>
      jsonResponse({
        data: [
          { id: "s1", name: "A", status: "ready", client: null },
          { id: "s2", name: "B", status: "pending", phone: "628" },
          { nope: true },
        ],
      }),
  });

  const sessions = await client.listSessions();
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].id, "s1");
  assert.equal(sessions[0].status, "ready");
  assert.equal(sessions[1].phone, "628");
  assert.equal(sessions[1].status, "pending");
});

test("resolveSession falls back to a case-insensitive name match", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/sessions/HADIR")) {
        return jsonResponse({ error: "missing" }, 404);
      }
      if (url.endsWith("/api/sessions")) {
        return jsonResponse({
          data: [
            { id: "sess-1", name: "Hadir", status: "ready" },
            { id: "sess-2", name: "Absen", status: "ready" },
          ],
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    },
  });

  const session = await client.resolveSession("HADIR");
  assert.equal(session.id, "sess-1");
});

test("resolveSession falls back to a name match when the id lookup 400s (stored session key is a name)", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/sessions/lab-bot")) {
        return jsonResponse({ error: "Validation failed (uuid is expected)" }, 400);
      }
      if (url.endsWith("/api/sessions")) {
        return jsonResponse({
          data: [
            { id: "fed2cb5c-83ae-40c9-ac41-68ae3378fe15", name: "lab-bot", status: "ready" },
            { id: "sess-2", name: "Absen", status: "ready" },
          ],
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    },
  });

  const session = await client.resolveSession("lab-bot");
  assert.equal(session.id, "fed2cb5c-83ae-40c9-ac41-68ae3378fe15");
  assert.equal(session.status, "ready");
});

test("resolveSession throws not-found when nothing matches", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ data: [] }),
  });

  await assert.rejects(
    () => client.resolveSession("Ghost"),
    (error) => error instanceof OpenWaApiError && error.code === "not-found",
  );
});

test("createWebhook posts the registration payload and parses the webhook", async () => {
  let requestBody: string | undefined;
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      requestBody = typeof init?.body === "string" ? init.body : undefined;
      return jsonResponse(
        {
          data: {
            id: "wh-1",
            url: "https://app.example.com/api/integrations/whatsapp-bot/webhook",
            active: true,
          },
        },
        201,
      );
    },
  });

  const webhook = await client.createWebhook("sess-1", {
    url: "https://app.example.com/api/integrations/whatsapp-bot/webhook",
    secret: "tenant-secret",
  });
  assert.equal(webhook.id, "wh-1");
  assert.equal(webhook.active, true);

  const payload = JSON.parse(requestBody ?? "{}") as Record<string, unknown>;
  assert.equal(payload.url, "https://app.example.com/api/integrations/whatsapp-bot/webhook");
  assert.deepEqual(payload.events, ["message.received"]);
  assert.equal(payload.secret, "tenant-secret");
  assert.equal(payload.retryCount, 3);
});

test("deleteWebhook issues a DELETE for the session webhook", async () => {
  let methodAndPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input, init) => {
      methodAndPath = `${init?.method ?? "GET"} ${String(input).replace(config.apiBaseUrl, "")}`;
      return new Response(null, { status: 204 });
    },
  });

  await client.deleteWebhook("sess-1", "wh-1");
  assert.equal(methodAndPath, "DELETE /api/sessions/sess-1/webhooks/wh-1");
});

test("createSession posts the session name and parses the created session", async () => {
  let pathAndBody: { path: string; body: Record<string, unknown> } = { path: "", body: {} };
  const client = new OpenWaClient({
    config,
    fetch: async (input, init) => {
      pathAndBody = {
        path: String(input).replace(config.apiBaseUrl, ""),
        body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      };
      return jsonResponse({ data: { id: "sess-new", name: "sdn1-wa", status: "created" } }, 201);
    },
  });

  const session = await client.createSession("sdn1-wa");
  assert.equal(session.id, "sess-new");
  assert.equal(session.name, "sdn1-wa");
  assert.equal(session.status, "created");
  assert.equal(pathAndBody.path, "/api/sessions");
  assert.deepEqual(pathAndBody.body, { name: "sdn1-wa" });
});

test("startSession posts to the session start endpoint and parses the qr_ready session", async () => {
  let requestedPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      requestedPath = String(input).replace(config.apiBaseUrl, "");
      return jsonResponse({ data: { id: "sess-1", name: "sdn1-wa", status: "qr_ready" } });
    },
  });

  const session = await client.startSession("sess-1");
  assert.equal(session.id, "sess-1");
  assert.equal(session.name, "sdn1-wa");
  assert.equal(session.status, "qr_ready");
  assert.equal(requestedPath, "/api/sessions/sess-1/start");
});

test("getSessionQr parses the QR data URL and status", async () => {
  let requestedPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      requestedPath = String(input).replace(config.apiBaseUrl, "");
      return jsonResponse({ data: { qrCode: "data:image/png;base64,...", status: "qr_ready" } });
    },
  });

  const qr = await client.getSessionQr("sess-1");
  assert.equal(qr.qrCode, "data:image/png;base64,...");
  assert.equal(qr.status, "qr_ready");
  assert.equal(requestedPath, "/api/sessions/sess-1/qr");
});

test("createApiKey posts a session-scoped operator key and returns the full key once", async () => {
  let pathAndBody: { path: string; body: Record<string, unknown> } = { path: "", body: {} };
  const client = new OpenWaClient({
    config,
    fetch: async (input, init) => {
      pathAndBody = {
        path: String(input).replace(config.apiBaseUrl, ""),
        body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      };
      return jsonResponse(
        {
          data: {
            id: "key-1",
            name: "sdn1-wa",
            keyPrefix: "owa_k1_ab",
            role: "operator",
            allowedSessions: ["sess-1"],
            isActive: true,
            usageCount: 0,
            createdAt: "2025-01-01T00:00:00Z",
            apiKey: "owa_k1_secret...",
          },
        },
        201,
      );
    },
  });

  const key = await client.createApiKey({ name: "sdn1-wa", role: "operator", allowedSessions: ["sess-1"] });
  assert.equal(key.id, "key-1");
  assert.equal(key.keyPrefix, "owa_k1_ab");
  assert.equal(key.apiKey, "owa_k1_secret...");
  assert.deepEqual(key.allowedSessions, ["sess-1"]);
  assert.equal(pathAndBody.path, "/api/auth/api-keys");
  assert.deepEqual(pathAndBody.body, { name: "sdn1-wa", role: "operator", allowedSessions: ["sess-1"] });
});

test("createSession maps a 409 duplicate name to a conflict error", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ error: "duplicate session name" }, 409),
  });
  await assert.rejects(
    () => client.createSession("sdn1-wa"),
    (error) => error instanceof OpenWaApiError && error.code === "conflict",
  );
});

test("network errors and non-2xx statuses map to OpenWaApiError codes", async () => {
  const unreachable = new OpenWaClient({
    config,
    fetch: async () => {
      throw new Error("socket hang up");
    },
  });
  await assert.rejects(
    () => unreachable.listSessions(),
    (error) => error instanceof OpenWaApiError && error.code === "unreachable",
  );

  const unauthorized = new OpenWaClient({ config, fetch: async () => jsonResponse({}, 401) });
  await assert.rejects(
    () => unauthorized.listSessions(),
    (error) => error instanceof OpenWaApiError && error.code === "unauthorized",
  );

  const invalid = new OpenWaClient({ config, fetch: async () => jsonResponse({}, 422) });
  await assert.rejects(
    () => invalid.listSessions(),
    (error) => error instanceof OpenWaApiError && error.code === "invalid",
  );
});

test("sendText posts to send-text and parses the MessageResponseDto", async () => {
  let pathAndBody: { path: string; body: Record<string, unknown> } = { path: "", body: {} };
  const client = new OpenWaClient({
    config,
    fetch: async (input, init) => {
      pathAndBody = {
        path: String(input).replace(config.apiBaseUrl, ""),
        body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      };
      return jsonResponse({ data: { messageId: "msg-1", timestamp: 1706868000 } }, 201);
    },
  });

  const sent = await client.sendText("sess-1", { chatId: "62815551234", text: "Jadwal berubah." });
  assert.equal(sent.messageId, "msg-1");
  assert.equal(sent.timestamp, 1706868000);
  assert.equal(pathAndBody.path, "/api/sessions/sess-1/messages/send-text");
  assert.deepEqual(pathAndBody.body, { chatId: "62815551234", text: "Jadwal berubah." });
});

test("sendText includes optional mentions and linkPreview only when provided", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      return jsonResponse({ messageId: "msg-1", timestamp: 1 }, 201);
    },
  });

  await client.sendText("sess-1", { chatId: "g", text: "Halo @62811", mentions: ["62811@c.us"] });
  assert.deepEqual(body, { chatId: "g", text: "Halo @62811", mentions: ["62811@c.us"] });
  assert.equal("linkPreview" in body, false);
});

test("sendTemplate resolves by id or name and carries vars", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      requests.push(typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {});
      return jsonResponse({ data: { messageId: "t-1", timestamp: 1 } }, 201);
    },
  });

  await client.sendTemplate("sess-1", { chatId: "6281", templateId: "tmpl-1", vars: { customer: "A" } });
  await client.sendTemplate("sess-1", { chatId: "6281", templateName: "order-confirmation" });
  assert.deepEqual(requests[0], { chatId: "6281", templateId: "tmpl-1", vars: { customer: "A" } });
  assert.deepEqual(requests[1], { chatId: "6281", templateName: "order-confirmation" });
});

test("sendImage carries url/caption or base64 with mimetype", async () => {
  let lastBody: Record<string, unknown> = {};
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      lastBody = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      return jsonResponse({ data: { messageId: "img-1", timestamp: 1 } }, 201);
    },
  });

  await client.sendImage("sess-1", { chatId: "6281", url: "https://example.com/x.jpg", caption: "Lihat" });
  assert.deepEqual(lastBody, { chatId: "6281", url: "https://example.com/x.jpg", caption: "Lihat" });

  await client.sendImage("sess-1", { chatId: "6281", base64: "aGVsbG8=", mimetype: "image/jpeg" });
  assert.deepEqual(lastBody, { chatId: "6281", base64: "aGVsbG8=", mimetype: "image/jpeg" });
});

test("sendDocument forwards filename and caption", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      return jsonResponse({ data: { messageId: "doc-1", timestamp: 1 } }, 201);
    },
  });

  await client.sendDocument("sess-1", { chatId: "6281", url: "https://example.com/r.pdf", filename: "r.pdf" });
  assert.deepEqual(body, { chatId: "6281", url: "https://example.com/r.pdf", filename: "r.pdf" });
});

test("sendLocation and sendContact post their DTOs", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      requests.push(typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {});
      return jsonResponse({ data: { messageId: "m", timestamp: 1 } }, 201);
    },
  });

  await client.sendLocation("sess-1", { chatId: "6281", latitude: -6.2, longitude: 106.8, description: "Jakarta" });
  assert.deepEqual(requests[0], { chatId: "6281", latitude: -6.2, longitude: 106.8, description: "Jakarta" });

  await client.sendContact("sess-1", { chatId: "6281", contactName: "Alice", contactNumber: "628999888777" });
  assert.deepEqual(requests[1], { chatId: "6281", contactName: "Alice", contactNumber: "628999888777" });
});

test("reply posts the quoted message", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenWaClient({
    config,
    fetch: async (_input, init) => {
      body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      return jsonResponse({ data: { messageId: "rep-1", timestamp: 1 } }, 201);
    },
  });

  const sent = await client.reply("sess-1", {
    chatId: "6281",
    quotedMessageId: "3EB0ABCD",
    text: "Baik",
  });
  assert.equal(sent.messageId, "rep-1");
  assert.deepEqual(body, { chatId: "6281", quotedMessageId: "3EB0ABCD", text: "Baik" });
});

test("sendText throws invalid when the response lacks a messageId", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ data: { timestamp: 1 } }, 201),
  });
  await assert.rejects(
    () => client.sendText("sess-1", { chatId: "6281", text: "hai" }),
    (error) => error instanceof OpenWaApiError && error.code === "invalid",
  );
});

test("listChats unwraps the array and parses the summary", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      assert.equal(String(input).replace(config.apiBaseUrl, ""), "/api/sessions/sess-1/chats");
      return jsonResponse([
        { id: "6281555@c.us", name: "Alice", isGroup: false, kind: "individual", unreadCount: 1, timestamp: 10, lastMessage: "hi", archived: false, pinned: false, muted: false },
        { id: "1203630@g.us", name: "Kelas 7A", isGroup: true, kind: "group", unreadCount: 0, timestamp: 11, lastMessage: "ok", archived: true, pinned: true, muted: true },
        { nope: true },
      ]);
    },
  });

  const chats = await client.listChats("sess-1");
  assert.equal(chats.length, 2);
  assert.equal(chats[0].id, "6281555@c.us");
  assert.equal(chats[0].kind, "individual");
  assert.equal(chats[0].name, "Alice");
  assert.equal(chats[1].isGroup, true);
  assert.equal(chats[1].muted, true);
});

test("listChats sends limit/offset paging and derives number from the chat id", async () => {
  let requestedPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      requestedPath = String(input).replace(config.apiBaseUrl, "");
      return jsonResponse([
        {
          id: "6281555123@c.us",
          name: "Ada Lovelace",
          isGroup: false,
          kind: "individual",
          unreadCount: 2,
          timestamp: 1700000010,
          lastMessage: "hi",
          archived: false,
          pinned: true,
          muted: false,
        },
        {
          id: "1203630@g.us",
          name: "Kelas 7A",
          isGroup: true,
          kind: "group",
          unreadCount: 0,
          timestamp: null,
          lastMessage: null,
          archived: false,
          pinned: false,
          muted: false,
        },
        { nope: true },
      ]);
    },
  });

  const chats = await client.listChats("sess-1", { limit: 50, offset: 100 });
  assert.equal(requestedPath, "/api/sessions/sess-1/chats?limit=50&offset=100");
  assert.equal(chats.length, 2);
  assert.equal(chats[0].id, "6281555123@c.us");
  assert.equal(chats[0].number, "6281555123");
  assert.equal(chats[0].name, "Ada Lovelace");
  assert.equal(chats[0].kind, "individual");
  assert.equal(chats[0].unreadCount, 2);
  assert.equal(chats[0].pinned, true);
  assert.equal(chats[0].lastMessage, "hi");
  assert.equal(chats[1].id, "1203630@g.us");
  assert.equal(chats[1].number, "1203630");
  assert.equal(chats[1].isGroup, true);
  assert.equal(chats[1].timestamp, null);
});

test("listChats omits query params when no input is given", async () => {
  let requestedPath = "";
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      requestedPath = String(input).replace(config.apiBaseUrl, "");
      return jsonResponse([]);
    },
  });

  await client.listChats("sess-1");
  assert.equal(requestedPath, "/api/sessions/sess-1/chats");
});

test("listChats maps a 409 not-connected response to a conflict error", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ error: "not connected" }, 409),
  });
  await assert.rejects(
    () => client.listChats("sess-1"),
    (error) => error instanceof OpenWaApiError && error.code === "conflict",
  );
});

test("listMessages filters by chat and parses message rows", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async (input) => {
      const url = String(input).replace(config.apiBaseUrl, "");
      assert.equal(url, "/api/sessions/sess-1/messages?chatId=6281555%40c.us&limit=25");
      return jsonResponse({
        data: {
          messages: [
            { id: "m1", chatId: "6281555@c.us", from: "6281555@c.us", fromMe: false, timestamp: 10, body: "hi", type: "text" },
            { id: "m2", chatId: "6281555@c.us", from: null, fromMe: true, timestamp: 11, body: "ok", type: "text" },
          ],
          total: 2,
        },
      });
    },
  });

  const messages = await client.listMessages("sess-1", { chatId: "6281555@c.us", limit: 25 });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].id, "m1");
  assert.equal(messages[0].fromMe, false);
  assert.equal(messages[0].body, "hi");
  assert.equal(messages[1].fromMe, true);
});

test("listMessages returns an empty array for malformed envelopes", async () => {
  const client = new OpenWaClient({
    config,
    fetch: async () => jsonResponse({ message: "unexpected" }),
  });
  assert.deepEqual(await client.listMessages("sess-1"), []);
});