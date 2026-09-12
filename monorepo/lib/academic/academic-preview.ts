import { createHmac, randomBytes } from "node:crypto";

export type AcademicPreviewState = "pending" | "committed" | "invalidated" | "expired" | "cancelled";

export type AcademicPreviewIntent = Readonly<{
  tenantId: string;
  actorUserId: string;
  operationId: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type AcademicPreviewRecord = Readonly<{
  id: string;
  tokenDigest: string;
  intentDigest: string;
  tenantId: string;
  actorUserId: string;
  operationId: string;
  normalizedIntent: Readonly<Record<string, unknown>>;
  state: AcademicPreviewState;
  expiresAt: number;
  idempotencyKey: string | null;
  outcome: unknown;
  version: number;
}>;

export type AcademicPreviewStore = {
  insert(record: AcademicPreviewRecord): Promise<void>;
  findByTokenDigest(tokenDigest: string): Promise<AcademicPreviewRecord | null>;
  update(id: string, expectedVersion: number, patch: Partial<AcademicPreviewRecord>): Promise<boolean>;
};

export type AcademicPreviewDependencies = Readonly<{
  store: AcademicPreviewStore;
  secret: string;
  now?: () => number;
  id?: () => string;
}>;

export type AcademicPreviewResult =
  | { ok: true; token: string; preview: AcademicPreviewRecord }
  | { ok: false; code: "invalid-input" | "preview-unavailable" };

export type AcademicCommitResult =
  | { ok: true; outcome: unknown }
  | { ok: false; code: "academic-preview-no-longer-valid" };

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function digest(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function createAcademicPreviewService(dependencies: AcademicPreviewDependencies) {
  const now = dependencies.now ?? Date.now;
  const id = dependencies.id ?? (() => randomBytes(16).toString("hex"));
  const committing = new Set<string>();

  async function create(intent: AcademicPreviewIntent, ttlMs = 10 * 60 * 1000): Promise<AcademicPreviewResult> {
    if (!intent.tenantId || !intent.actorUserId || !intent.operationId || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      return { ok: false, code: "invalid-input" };
    }
    const normalized = canonical(intent);
    const token = opaqueToken();
    const preview: AcademicPreviewRecord = {
      id: id(),
      tokenDigest: digest(dependencies.secret, token),
      intentDigest: digest(dependencies.secret, normalized),
      tenantId: intent.tenantId,
      actorUserId: intent.actorUserId,
      operationId: intent.operationId,
      normalizedIntent: intent.payload,
      state: "pending",
      expiresAt: now() + ttlMs,
      idempotencyKey: null,
      outcome: null,
      version: 1,
    };
    try {
      await dependencies.store.insert(preview);
    } catch {
      return { ok: false, code: "preview-unavailable" };
    }
    return { ok: true, token, preview };
  }

  async function commit(input: {
    token: string;
    intent: AcademicPreviewIntent;
    idempotencyKey: string;
    reauthorize: () => Promise<boolean>;
    mutate: () => Promise<unknown>;
  }): Promise<AcademicCommitResult> {
    if (!input.token || !input.idempotencyKey || !input.intent.tenantId || !input.intent.actorUserId || !input.intent.operationId) {
      return { ok: false, code: "academic-preview-no-longer-valid" };
    }
    const record = await dependencies.store.findByTokenDigest(digest(dependencies.secret, input.token));
    if (!record || committing.has(record.id)) return { ok: false, code: "academic-preview-no-longer-valid" };
    if (record.tenantId !== input.intent.tenantId || record.actorUserId !== input.intent.actorUserId || record.operationId !== input.intent.operationId) {
      return { ok: false, code: "academic-preview-no-longer-valid" };
    }
    if (record.state === "committed" && record.idempotencyKey === input.idempotencyKey) return { ok: true, outcome: record.outcome };
    if (record.state !== "pending") return { ok: false, code: "academic-preview-no-longer-valid" };
    if (record.expiresAt <= now() || record.intentDigest !== digest(dependencies.secret, canonical(input.intent))) {
      await dependencies.store.update(record.id, record.version, { state: record.expiresAt <= now() ? "expired" : "invalidated", version: record.version + 1 });
      return { ok: false, code: "academic-preview-no-longer-valid" };
    }
    if (record.idempotencyKey !== null) return { ok: false, code: "academic-preview-no-longer-valid" };
    const claimedVersion = record.version + 1;
    if (!await dependencies.store.update(record.id, record.version, { idempotencyKey: input.idempotencyKey, version: claimedVersion })) {
      return { ok: false, code: "academic-preview-no-longer-valid" };
    }
    committing.add(record.id);
    try {
      if (!await input.reauthorize()) {
        await dependencies.store.update(record.id, claimedVersion, { state: "invalidated", version: claimedVersion + 1 });
        return { ok: false, code: "academic-preview-no-longer-valid" };
      }
      const outcome = await input.mutate();
      if (!await dependencies.store.update(record.id, claimedVersion, { state: "committed", outcome, version: claimedVersion + 1 })) {
        return { ok: false, code: "academic-preview-no-longer-valid" };
      }
      return { ok: true, outcome };
    } catch {
      await dependencies.store.update(record.id, claimedVersion, { state: "invalidated", version: claimedVersion + 1 });
      return { ok: false, code: "academic-preview-no-longer-valid" };
    } finally {
      committing.delete(record.id);
    }
  }

  return { create, commit };
}
