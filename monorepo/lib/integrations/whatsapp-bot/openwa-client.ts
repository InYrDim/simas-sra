import type { OpenWaConnectionConfig } from "@/lib/integrations/whatsapp-bot/openwa-config";

export type OpenWaSession = {
  id: string;
  name: string;
  status: string | null;
  phone: string | null;
  pushName: string | null;
};

export type OpenWaWebhook = {
  id: string;
  url: string;
  active: boolean;
};

export type OpenWaSentMessage = {
  messageId: string;
  timestamp: number;
};

export type OpenWaChat = {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  kind: string;
  unreadCount: number;
  timestamp: number | null;
  lastMessage: string | null;
  archived: boolean;
  pinned: boolean;
  muted: boolean;
};

export type OpenWaMessageListItem = {
  id: string;
  chatId: string;
  from: string | null;
  fromMe: boolean;
  timestamp: number | null;
  body: string | null;
  type: string | null;
};

export type OpenWaApiErrorCode =
  | "unconfigured"
  | "unreachable"
  | "unauthorized"
  | "not-found"
  | "conflict"
  | "invalid"
  | "http";

export class OpenWaApiError extends Error {
  readonly code: OpenWaApiErrorCode;

  constructor(code: OpenWaApiErrorCode, message: string) {
    super(message);
    this.name = "OpenWaApiError";
    this.code = code;
  }
}

export type OpenWaClientDependencies = {
  config: OpenWaConnectionConfig;
  fetch?: typeof globalThis.fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  return isRecord(value) && "data" in value ? value.data : value;
}

function unwrapList(value: unknown): unknown[] {
  const raw = unwrapData(value);
  return Array.isArray(raw) ? raw : [];
}

function parseSession(value: unknown): OpenWaSession | null {
  const raw = unwrapData(value);
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name : null;
  if (!id || !name) return null;
  const client = isRecord(raw.client) ? raw.client : null;
  return {
    id,
    name,
    status: typeof raw.status === "string" ? raw.status : null,
    phone: typeof raw.phone === "string" ? raw.phone
      : client && typeof client.phone === "string" ? client.phone
      : null,
    pushName: typeof raw.pushName === "string" ? raw.pushName
      : client && typeof client.pushName === "string" ? client.pushName
      : null,
  };
}

function parseWebhook(value: unknown): OpenWaWebhook | null {
  const raw = unwrapData(value);
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  return {
    id,
    url: typeof raw.url === "string" ? raw.url : "",
    active: raw.active === true,
  };
}

function parseSentMessage(value: unknown): OpenWaSentMessage | null {
  const raw = unwrapData(value);
  if (!isRecord(raw)) return null;
  const messageId = typeof raw.messageId === "string" ? raw.messageId : null;
  if (!messageId) return null;
  return {
    messageId,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : 0,
  };
}

function parseSentMessageOrThrow(value: unknown): OpenWaSentMessage {
  const sent = parseSentMessage(value);
  if (!sent) throw new OpenWaApiError("invalid", "OpenWA returned an unrecognized message response");
  return sent;
}

function parseChat(value: unknown): OpenWaChat | null {
  const raw = unwrapData(value);
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : id,
    number: id.split("@")[0] || "",
    isGroup: raw.isGroup === true,
    kind: typeof raw.kind === "string" ? raw.kind : "unknown",
    unreadCount: typeof raw.unreadCount === "number" ? raw.unreadCount : 0,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : null,
    lastMessage: typeof raw.lastMessage === "string" ? raw.lastMessage : null,
    archived: raw.archived === true,
    pinned: raw.pinned === true,
    muted: raw.muted === true,
  };
}

function parseMessageListItem(value: unknown): OpenWaMessageListItem | null {
  const raw = unwrapData(value);
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  return {
    id,
    chatId: typeof raw.chatId === "string" ? raw.chatId : "",
    from: typeof raw.from === "string" ? raw.from : null,
    fromMe: raw.fromMe === true,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : null,
    body: typeof raw.body === "string" ? raw.body : null,
    type: typeof raw.type === "string" ? raw.type : null,
  };
}

function mapHttpError(status: number): OpenWaApiError {
  if (status === 401 || status === 403) return new OpenWaApiError("unauthorized", `OpenWA rejected the API key (HTTP ${status})`);
  if (status === 404) return new OpenWaApiError("not-found", `OpenWA resource not found (HTTP ${status})`);
  if (status === 409) return new OpenWaApiError("conflict", `OpenWA resource conflict (HTTP ${status})`);
  if (status === 400 || status === 422) return new OpenWaApiError("invalid", `OpenWA rejected the request (HTTP ${status})`);
  return new OpenWaApiError("http", `OpenWA request failed (HTTP ${status})`);
}

export class OpenWaClient {
  private readonly config: OpenWaConnectionConfig;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(dependencies: OpenWaClientDependencies) {
    this.config = dependencies.config;
    this.fetchFn = dependencies.fetch ?? globalThis.fetch;
  }

  private async request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiBaseUrl}${path}`, {
        method,
        headers: {
          "x-api-key": this.config.apiKey,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new OpenWaApiError("unreachable", `OpenWA is unreachable at ${this.config.apiBaseUrl}`);
    }
    if (response.ok) {
      if (response.status === 204 || response.status === 202) return undefined as T;
      return (await response.json()) as T;
    }
    throw mapHttpError(response.status);
  }

  async getSession(input: string): Promise<OpenWaSession | null> {
    try {
      const raw = await this.request<unknown>("GET", `/api/sessions/${encodeURIComponent(input)}`);
      return parseSession(raw);
    } catch (error) {
      // A 404 means no such session. OpenWA also answers 400 ("uuid is expected")
      // when the input is a session *name* — the by-id route only accepts UUIDs.
      // Both mean "not resolvable by id", so fall back to the name lookup.
      if (error instanceof OpenWaApiError && (error.code === "not-found" || error.code === "invalid")) return null;
      throw error;
    }
  }

  async listSessions(): Promise<OpenWaSession[]> {
    const raw = await this.request<unknown>("GET", "/api/sessions");
    return unwrapList(raw)
      .map((entry) => parseSession(entry))
      .filter((session): session is OpenWaSession => session !== null);
  }

  /**
   * OpenWA REST routes address sessions by their UUID, while delivery payloads
   * may carry either the UUID or the session name. Accept both: try a direct
   * lookup first, then a case-insensitive name match against the session list.
   */
  async resolveSession(input: string): Promise<OpenWaSession> {
    const trimmed = input.trim();
    if (!trimmed) throw new OpenWaApiError("invalid", "Session identifier must not be empty");
    const byId = await this.getSession(trimmed);
    if (byId) return byId;
    const normalized = trimmed.toLowerCase();
    const byName = (await this.listSessions()).find(
      (session) => session.name === trimmed || session.name.toLowerCase() === normalized,
    );
    if (byName) return byName;
    throw new OpenWaApiError("not-found", `OpenWA session "${trimmed}" was not found`);
  }

  async createWebhook(
    sessionId: string,
    input: { url: string; secret: string },
  ): Promise<OpenWaWebhook> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/webhooks`,
      {
        url: input.url,
        events: ["message.received"],
        secret: input.secret,
        retryCount: 3,
      },
    );
    const webhook = parseWebhook(raw);
    if (!webhook) throw new OpenWaApiError("invalid", "OpenWA returned an unrecognized webhook payload");
    return webhook;
  }

  async deleteWebhook(sessionId: string, webhookId: string): Promise<void> {
    await this.request(
      "DELETE",
      `/api/sessions/${encodeURIComponent(sessionId)}/webhooks/${encodeURIComponent(webhookId)}`,
    );
  }

  async sendText(
    sessionId: string,
    input: { chatId: string; text: string; mentions?: string[]; linkPreview?: boolean },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
      {
        chatId: input.chatId,
        text: input.text,
        ...(input.mentions ? { mentions: input.mentions } : {}),
        ...(input.linkPreview !== undefined ? { linkPreview: input.linkPreview } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async sendTemplate(
    sessionId: string,
    input: { chatId: string; templateId?: string; templateName?: string; vars?: Record<string, string> },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-template`,
      {
        chatId: input.chatId,
        ...(input.templateId ? { templateId: input.templateId } : {}),
        ...(input.templateName ? { templateName: input.templateName } : {}),
        ...(input.vars ? { vars: input.vars } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async sendImage(
    sessionId: string,
    input: { chatId: string; url?: string; base64?: string; mimetype?: string; caption?: string },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-image`,
      {
        chatId: input.chatId,
        ...(input.url ? { url: input.url } : {}),
        ...(input.base64 ? { base64: input.base64, mimetype: input.mimetype } : {}),
        ...(input.caption ? { caption: input.caption } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async sendDocument(
    sessionId: string,
    input: { chatId: string; url?: string; base64?: string; mimetype?: string; filename?: string; caption?: string },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-document`,
      {
        chatId: input.chatId,
        ...(input.url ? { url: input.url } : {}),
        ...(input.base64 ? { base64: input.base64, mimetype: input.mimetype } : {}),
        ...(input.filename ? { filename: input.filename } : {}),
        ...(input.caption ? { caption: input.caption } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async sendLocation(
    sessionId: string,
    input: { chatId: string; latitude: number; longitude: number; description?: string; address?: string },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-location`,
      {
        chatId: input.chatId,
        latitude: input.latitude,
        longitude: input.longitude,
        ...(input.description ? { description: input.description } : {}),
        ...(input.address ? { address: input.address } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async sendContact(
    sessionId: string,
    input: { chatId: string; contactName: string; contactNumber: string },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-contact`,
      {
        chatId: input.chatId,
        contactName: input.contactName,
        contactNumber: input.contactNumber,
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async reply(
    sessionId: string,
    input: { chatId: string; quotedMessageId: string; text: string; mentions?: string[] },
  ): Promise<OpenWaSentMessage> {
    const raw = await this.request<unknown>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/reply`,
      {
        chatId: input.chatId,
        quotedMessageId: input.quotedMessageId,
        text: input.text,
        ...(input.mentions ? { mentions: input.mentions } : {}),
      },
    );
    return parseSentMessageOrThrow(raw);
  }

  async listChats(
    sessionId: string,
    input?: { limit?: number; offset?: number },
  ): Promise<OpenWaChat[]> {
    const params = new URLSearchParams();
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.offset) params.set("offset", String(input.offset));
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const raw = await this.request<unknown>(
      "GET",
      `/api/sessions/${encodeURIComponent(sessionId)}/chats${query}`,
    );
    return unwrapList(raw)
      .map((entry) => parseChat(entry))
      .filter((chat): chat is OpenWaChat => chat !== null);
  }

  async listMessages(sessionId: string, input?: { chatId?: string; limit?: number }): Promise<OpenWaMessageListItem[]> {
    const params = new URLSearchParams();
    if (input?.chatId) params.set("chatId", input.chatId);
    if (input?.limit) params.set("limit", String(input.limit));
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const raw = await this.request<unknown>(
      "GET",
      `/api/sessions/${encodeURIComponent(sessionId)}/messages${query}`,
    );
    const body = unwrapData(raw);
    if (!isRecord(body) || !Array.isArray(body.messages)) return [];
    return body.messages
      .map((entry) => parseMessageListItem(entry))
      .filter((message): message is OpenWaMessageListItem => message !== null);
  }
}