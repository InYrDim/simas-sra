import type {
  InboundMessageRecord,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";

export type OpenWaDeliveryMessage = {
  id?: string;
  from?: string;
  to?: string;
  chatId?: string;
  body?: string;
  type?: string;
  timestamp?: number;
  isGroup?: boolean;
  kind?: string;
  hasMedia?: boolean;
  fromMe?: boolean;
  contact?: { name?: string; pushName?: string } | null;
  media?: Record<string, unknown> | null;
};

export type OpenWaDeliveryPayload = {
  event?: string;
  timestamp?: number;
  sessionId?: string;
  idempotencyKey?: string;
  data?: OpenWaDeliveryMessage | unknown;
};

export type OpenWaWebhookHeaders = {
  signature: string | null;
  event: string | null;
  idempotencyKey: string | null;
};

export type OpenWaConnectionLookup = {
  tenantId: string;
};

export type OpenWaIngestResult =
  | { status: "ok"; httpStatus: 200 }
  | { status: "ignored-event"; httpStatus: 200 }
  | { status: "bad-request"; httpStatus: 400 }
  | { status: "unauthorized"; httpStatus: 401 };

export type OpenWaIngestDependencies = {
  readConnectionBySessionKey: (sessionKey: string) => Promise<OpenWaConnectionLookup | null>;
  deriveSecret: (tenantId: string) => string;
  verifySignature: (rawBody: string, signature: string | null, secret: string) => boolean;
  recordInboundMessage: (message: InboundMessageRecord) => Promise<void>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDeliveryPayload(rawBody: string): OpenWaDeliveryPayload | null {
  if (!rawBody) return null;
  try {
    const value: unknown = JSON.parse(rawBody);
    if (!isRecord(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function buildInboundMessageRecord(input: {
  tenantId: string;
  payload: OpenWaDeliveryPayload;
  idempotencyKey: string;
  receivedAt: Date;
}): InboundMessageRecord {
  const event = typeof input.payload.event === "string" ? input.payload.event : "message.received";
  const data = isRecord(input.payload.data) ? (input.payload.data as OpenWaDeliveryMessage) : {};
  const contact = isRecord(data.contact) ? data.contact : null;
  const media = isRecord(data.media) ? data.media : null;

  const mediaMetadata: Record<string, unknown> | null = media ? { ...media } : null;
  if (mediaMetadata) delete mediaMetadata.data;

  const metadata: Record<string, unknown> = {};
  if (contact && (typeof contact.name === "string" || typeof contact.pushName === "string")) {
    metadata.contact = {
      ...(typeof contact.name === "string" ? { name: contact.name } : {}),
      ...(typeof contact.pushName === "string" ? { pushName: contact.pushName } : {}),
    };
  }
  if (mediaMetadata && Object.keys(mediaMetadata).length > 0) metadata.media = mediaMetadata;

  const messageTimestamp =
    typeof data.timestamp === "number" ? data.timestamp
    : typeof input.payload.timestamp === "number" ? input.payload.timestamp
    : null;

  return {
    tenantId: input.tenantId,
    openwaMessageId: typeof data.id === "string" ? data.id : input.idempotencyKey,
    idempotencyKey: input.idempotencyKey,
    event,
    direction: "inbound",
    chatId: typeof data.chatId === "string" && data.chatId ? data.chatId
      : typeof data.from === "string" ? data.from
      : "",
    fromWa: typeof data.from === "string" ? data.from : "",
    toWa: typeof data.to === "string" ? data.to : null,
    body: typeof data.body === "string" ? data.body : null,
    messageType: typeof data.type === "string" ? data.type : null,
    hasMedia: data.hasMedia === true,
    isGroup: data.isGroup === true,
    kind: typeof data.kind === "string" ? data.kind : null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    messageTimestamp,
    receivedAt: input.receivedAt,
  } satisfies InboundMessageRecord;
}

export async function processOpenWaDelivery(
  input: {
    rawBody: string;
    headers: OpenWaWebhookHeaders;
    receivedAt?: Date;
  },
  dependencies: OpenWaIngestDependencies,
): Promise<OpenWaIngestResult> {
  const receivedAt = input.receivedAt ?? new Date();

  const payload = parseDeliveryPayload(input.rawBody);
  if (!payload) return { status: "bad-request", httpStatus: 400 };

  const event = typeof payload.event === "string" ? payload.event : input.headers.event;
  if (event !== "message.received") return { status: "ignored-event", httpStatus: 200 };

  const sessionKey = typeof payload.sessionId === "string" ? payload.sessionId : "";
  if (!sessionKey) return { status: "bad-request", httpStatus: 400 };

  const connection = await dependencies.readConnectionBySessionKey(sessionKey);
  if (!connection) return { status: "unauthorized", httpStatus: 401 };

  const secret = dependencies.deriveSecret(connection.tenantId);
  if (!dependencies.verifySignature(input.rawBody, input.headers.signature, secret)) {
    return { status: "unauthorized", httpStatus: 401 };
  }

  const message = isRecord(payload.data) ? (payload.data as OpenWaDeliveryMessage) : {};
  if (message.fromMe === true) {
    return { status: "ignored-event", httpStatus: 200 };
  }

  const idempotencyKey =
    typeof payload.idempotencyKey === "string" && payload.idempotencyKey
      ? payload.idempotencyKey
      : input.headers.idempotencyKey;
  if (!idempotencyKey) return { status: "bad-request", httpStatus: 400 };

  await dependencies.recordInboundMessage(
    buildInboundMessageRecord({ tenantId: connection.tenantId, payload, idempotencyKey, receivedAt }),
  );

  return { status: "ok", httpStatus: 200 };
}