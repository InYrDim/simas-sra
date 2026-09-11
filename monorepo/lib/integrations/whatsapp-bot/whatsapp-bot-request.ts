import { randomUUID } from "node:crypto";

import type { WhatsAppBotConnectionRecord } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type {
  WhatsAppBotRequestChanges,
  WhatsAppBotRequestInsert,
  WhatsAppBotRequestRecord,
  WhatsAppBotRequestResolutionMethod,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";

export function normalizeWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  let number = digits;
  if (number.startsWith("0")) number = `62${number.slice(1)}`;
  else if (number.startsWith("8")) number = `62${number}`;
  if (!number.startsWith("62")) return null;
  if (number.length < 9 || number.length > 15) return null;
  return number;
}

export function normalizeSessionName(raw: string | null): string | null {
  const name = raw?.trim() ?? "";
  if (!name) return null;
  if (!/^[A-Za-z0-9-]+$/.test(name)) return null;
  if (name.length < 3 || name.length > 50) return null;
  return name;
}

export function buildSessionName(domain: string, desired: string | null): string {
  const candidate = normalizeSessionName(desired);
  if (candidate) return candidate;
  const primary = (domain.toLowerCase().split(".")[0] ?? "").replace(/[^a-z0-9-]/g, "");
  const fallback = (primary || "sekolah").slice(0, 40) + "-wa";
  return fallback.slice(0, 50);
}

export type SubmitWhatsAppBotRequestInput = {
  requestedPhone: string;
  desiredSessionName: string | null;
  picName: string;
  note: string | null;
};

export type SubmitWhatsAppBotRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; code: "phone-invalid" | "pic-required" | "session-name-invalid" | "note-too-long" | "connection-exists" | "request-pending" };

export type WhatsAppBotRequestTransitionResult =
  | { ok: true }
  | { ok: false; code: "not-found" | "already-resolved" | "not-approvable" };

export type WhatsAppBotRequestDependencies = {
  readLatestRequest: (tenantId: string) => Promise<WhatsAppBotRequestRecord | null>;
  readConnection: (tenantId: string) => Promise<WhatsAppBotConnectionRecord | null>;
  createRequest: (input: WhatsAppBotRequestInsert) => Promise<void>;
  readRequestById: (id: string) => Promise<WhatsAppBotRequestRecord | null>;
  updateRequest: (id: string, changes: WhatsAppBotRequestChanges) => Promise<void>;
};

const MAX_NOTE_LENGTH = 1000;

export async function submitWhatsAppBotRequest(
  dependencies: WhatsAppBotRequestDependencies,
  tenantId: string,
  input: SubmitWhatsAppBotRequestInput,
): Promise<SubmitWhatsAppBotRequestResult> {
  const requestedPhone = normalizeWhatsAppPhone(input.requestedPhone);
  const desiredSessionName = normalizeSessionName(input.desiredSessionName);
  const picName = input.picName.trim();
  const note = input.note?.trim() ?? null;
  if (!requestedPhone) return { ok: false, code: "phone-invalid" };
  if (!picName) return { ok: false, code: "pic-required" };
  if (input.desiredSessionName && input.desiredSessionName.trim() && !desiredSessionName) {
    return { ok: false, code: "session-name-invalid" };
  }
  if (note && note.length > MAX_NOTE_LENGTH) return { ok: false, code: "note-too-long" };

  const [connection, latest] = await Promise.all([
    dependencies.readConnection(tenantId),
    dependencies.readLatestRequest(tenantId),
  ]);
  if (connection) return { ok: false, code: "connection-exists" };
  if (latest && (latest.status === "pending" || latest.status === "approved")) {
    return { ok: false, code: "request-pending" };
  }

  const requestId = randomUUID();
  await dependencies.createRequest({
    id: requestId,
    tenantId,
    requestedPhone,
    desiredSessionName,
    picName,
    note,
  });
  return { ok: true, requestId };
}

export async function approveWhatsAppBotRequest(
  dependencies: WhatsAppBotRequestDependencies,
  requestId: string,
  actorId: string | null,
): Promise<WhatsAppBotRequestTransitionResult> {
  void actorId;
  const request = await dependencies.readRequestById(requestId);
  if (!request) return { ok: false, code: "not-found" };
  if (request.status !== "pending") return { ok: false, code: "not-approvable" };
  await dependencies.updateRequest(requestId, { status: "approved" });
  return { ok: true };
}

export async function rejectWhatsAppBotRequest(
  dependencies: WhatsAppBotRequestDependencies,
  requestId: string,
  actorId: string,
  note: string | null,
): Promise<WhatsAppBotRequestTransitionResult> {
  const request = await dependencies.readRequestById(requestId);
  if (!request) return { ok: false, code: "not-found" };
  if (request.status !== "pending") return { ok: false, code: "already-resolved" };
  await dependencies.updateRequest(requestId, {
    status: "rejected",
    providerNote: note?.trim() || null,
    resolvedAt: new Date(),
    resolvedBy: actorId,
  });
  return { ok: true };
}

export async function markWhatsAppBotRequestFulfilled(
  dependencies: WhatsAppBotRequestDependencies,
  requestId: string,
  actorId: string,
  method: WhatsAppBotRequestResolutionMethod,
): Promise<WhatsAppBotRequestTransitionResult> {
  const request = await dependencies.readRequestById(requestId);
  if (!request) return { ok: false, code: "not-found" };
  if (request.status === "fulfilled" || request.status === "rejected") {
    return { ok: false, code: "already-resolved" };
  }
  await dependencies.updateRequest(requestId, {
    status: "fulfilled",
    resolutionMethod: method,
    resolvedAt: new Date(),
    resolvedBy: actorId,
  });
  return { ok: true };
}