import assert from "node:assert/strict";
import test from "node:test";

import type { InboundMessageRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { OpenWaIngestDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-webhook";
import {
  buildInboundMessageRecord,
  processOpenWaDelivery,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-webhook";

const EMPTY_HEADERS = { signature: null, event: null, idempotencyKey: null } as const;

function dependencies(overrides?: Partial<OpenWaIngestDependencies>): OpenWaIngestDependencies {
  return {
    readConnectionBySessionKey: async () => ({ tenantId: "tenant-a" }),
    deriveSecret: () => "tenant-secret",
    verifySignature: () => true,
    recordInboundMessage: async () => {},
    ...overrides,
  };
}

const VALID_BODY = JSON.stringify({
  event: "message.received",
  timestamp: 1728000000000,
  sessionId: "HadirBot",
  idempotencyKey: "delivery-1",
  data: {
    id: "msg-1",
    from: "6281234567890",
    to: "628111",
    body: "Halo",
    type: "text",
    timestamp: 1728000000000,
    hasMedia: false,
    isGroup: true,
    contact: { name: "Budi" },
    kind: "inbound",
  },
});

test("processOpenWaDelivery records a valid message delivery", async () => {
  const recorded: InboundMessageRecord[] = [];
  const deps = dependencies({
    recordInboundMessage: async (message) => {
      recorded.push(message);
    },
  });

  const result = await processOpenWaDelivery(
    {
      rawBody: VALID_BODY,
      headers: { signature: "sha256=x", event: null, idempotencyKey: "delivery-1" },
      receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    deps,
  );

  assert.deepEqual(result, { status: "ok", httpStatus: 200 });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].tenantId, "tenant-a");
  assert.equal(recorded[0].openwaMessageId, "msg-1");
  assert.equal(recorded[0].idempotencyKey, "delivery-1");
  assert.equal(recorded[0].event, "message.received");
  assert.equal(recorded[0].direction, "inbound");
  assert.equal(recorded[0].chatId, "6281234567890");
  assert.equal(recorded[0].body, "Halo");
  assert.equal(recorded[0].isGroup, true);
});

test("malformed or empty bodies are rejected as bad requests", async () => {
  assert.deepEqual(
    await processOpenWaDelivery({ rawBody: "", headers: EMPTY_HEADERS }, dependencies()),
    { status: "bad-request", httpStatus: 400 },
  );
  assert.deepEqual(
    await processOpenWaDelivery({ rawBody: "not-json", headers: EMPTY_HEADERS }, dependencies()),
    { status: "bad-request", httpStatus: 400 },
  );
  assert.deepEqual(
    await processOpenWaDelivery({ rawBody: '"a-string"', headers: EMPTY_HEADERS }, dependencies()),
    { status: "bad-request", httpStatus: 400 },
  );
});

test("non message.received events are ignored without recording", async () => {
  let recorded = false;
  const deps = dependencies({
    recordInboundMessage: async () => {
      recorded = true;
    },
  });

  const result = await processOpenWaDelivery(
    { rawBody: JSON.stringify({ event: "chat.reset", sessionId: "HadirBot" }), headers: EMPTY_HEADERS },
    deps,
  );

  assert.deepEqual(result, { status: "ignored-event", httpStatus: 200 });
  assert.equal(recorded, false);
});

test("a missing session key is a bad request", async () => {
  const result = await processOpenWaDelivery(
    { rawBody: JSON.stringify({ event: "message.received", data: {} }), headers: EMPTY_HEADERS },
    dependencies(),
  );
  assert.deepEqual(result, { status: "bad-request", httpStatus: 400 });
});

test("unknown sessions and bad signatures are rejected as unauthorized", async () => {
  const unknownSession = await processOpenWaDelivery(
    { rawBody: VALID_BODY, headers: EMPTY_HEADERS },
    dependencies({ readConnectionBySessionKey: async () => null }),
  );
  assert.deepEqual(unknownSession, { status: "unauthorized", httpStatus: 401 });

  const badSignature = await processOpenWaDelivery(
    { rawBody: VALID_BODY, headers: EMPTY_HEADERS },
    dependencies({ verifySignature: () => false }),
  );
  assert.deepEqual(badSignature, { status: "unauthorized", httpStatus: 401 });
});

test("a missing idempotency key is a bad request", async () => {
  const result = await processOpenWaDelivery(
    { rawBody: JSON.stringify({ event: "message.received", sessionId: "HadirBot", data: {} }), headers: EMPTY_HEADERS },
    dependencies(),
  );
  assert.deepEqual(result, { status: "bad-request", httpStatus: 400 });
});

test("the idempotency key may come from the header when the payload omits it", async () => {
  const recorded: InboundMessageRecord[] = [];
  const deps = dependencies({
    recordInboundMessage: async (message) => {
      recorded.push(message);
    },
  });

  const result = await processOpenWaDelivery(
    {
      rawBody: JSON.stringify({ event: "message.received", sessionId: "HadirBot", data: { from: "6281" } }),
      headers: { signature: "sha256=x", event: null, idempotencyKey: "header-key" },
      receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    deps,
  );

  assert.deepEqual(result, { status: "ok", httpStatus: 200 });
  assert.equal(recorded[0].idempotencyKey, "header-key");
});

test("buildInboundMessageRecord captures contact, media, and message timestamps", () => {
  const record = buildInboundMessageRecord({
    tenantId: "tenant-a",
    idempotencyKey: "delivery-1",
    receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    payload: {
      event: "message.received",
      timestamp: 1728000000000,
      sessionId: "HadirBot",
      idempotencyKey: "delivery-1",
      data: {
        id: "msg-1",
        from: "6281",
        to: "6282",
        body: "Foto",
        type: "image",
        hasMedia: true,
        media: { mime: "image/jpeg" },
        contact: { name: "Budi", pushName: "budi" },
      },
    },
  });

  assert.equal(record.openwaMessageId, "msg-1");
  assert.equal(record.messageTimestamp, 1728000000000);
  assert.equal(record.hasMedia, true);
  assert.equal(record.toWa, "6282");
  assert.deepEqual(record.metadata, {
    contact: { name: "Budi", pushName: "budi" },
    media: { mime: "image/jpeg" },
  });
});

test("buildInboundMessageRecord falls back to the payload timestamp and message id", () => {
  const record = buildInboundMessageRecord({
    tenantId: "tenant-a",
    idempotencyKey: "delivery-1",
    receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    payload: { event: "message.received", timestamp: 1728000000000, data: {} },
  });

  assert.equal(record.openwaMessageId, "delivery-1");
  assert.equal(record.messageTimestamp, 1728000000000);
  assert.equal(record.body, null);
  assert.equal(record.toWa, null);
  assert.equal(record.metadata, null);
});

test("buildInboundMessageRecord prefers data.chatId over data.from for the chat id", () => {
  const record = buildInboundMessageRecord({
    tenantId: "tenant-a",
    idempotencyKey: "delivery-1",
    receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    payload: {
      event: "message.received",
      data: { id: "msg-1", from: "6281234567890", chatId: "6281234567890@c.us", to: "628111" },
    },
  });

  assert.equal(record.chatId, "6281234567890@c.us");
  assert.equal(record.fromWa, "6281234567890");
});

test("buildInboundMessageRecord strips raw media data from the persisted metadata", () => {
  const record = buildInboundMessageRecord({
    tenantId: "tenant-a",
    idempotencyKey: "delivery-1",
    receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    payload: {
      event: "message.received",
      data: {
        id: "msg-1",
        from: "6281",
        body: "Foto",
        type: "image",
        hasMedia: true,
        media: { mime: "image/jpeg", ext: "jpg", data: "raw-bytes-should-not-be-kept" },
      },
    },
  });

  assert.equal(record.hasMedia, true);
  assert.deepEqual(record.metadata?.media, { mime: "image/jpeg", ext: "jpg" });
});

test("self-sent messages (fromMe) are ignored without recording", async () => {
  let recorded = 0;
  const deps = dependencies({
    recordInboundMessage: async () => {
      recorded += 1;
    },
  });

  const result = await processOpenWaDelivery(
    {
      rawBody: JSON.stringify({
        event: "message.received",
        sessionId: "HadirBot",
        idempotencyKey: "delivery-1",
        data: { id: "msg-1", fromMe: true, from: "628111" },
      }),
      headers: { signature: "sha256=x", event: null, idempotencyKey: "delivery-1" },
      receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    deps,
  );

  assert.deepEqual(result, { status: "ignored-event", httpStatus: 200 });
  assert.equal(recorded, 0);
});

test("fromMe messages from unknown sessions are still rejected as unauthorized", async () => {
  const deps = dependencies({ readConnectionBySessionKey: async () => null });

  const result = await processOpenWaDelivery(
    {
      rawBody: JSON.stringify({
        event: "message.received",
        sessionId: "Ghost",
        idempotencyKey: "delivery-1",
        data: { id: "msg-1", fromMe: true, from: "628111" },
      }),
      headers: EMPTY_HEADERS,
    },
    deps,
  );

  assert.deepEqual(result, { status: "unauthorized", httpStatus: 401 });
});