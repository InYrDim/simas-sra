import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type PpdbSessionStatus = "draft" | "published" | "ended";
export type PpdbFieldType = "text" | "number" | "file" | "select";
export type PpdbFieldPurpose = "studentName" | "nisn";
export type PpdbFormField = Readonly<{
  id: string;
  label: string;
  type: PpdbFieldType;
  required: boolean;
  purpose?: PpdbFieldPurpose;
  options?: readonly string[];
}>;

export function findPpdbIdentityField(fields: readonly PpdbFormField[], purpose: PpdbFieldPurpose) {
  return fields.find((field) => field.purpose === purpose)
    ?? fields.find((field) => purpose === "studentName" ? field.id === "t1" : field.id === "t2")
    ?? fields.find((field) => {
      const label = field.label.trim().toLocaleLowerCase("id-ID");
      return purpose === "studentName" ? label.includes("nama lengkap") : label === "nisn";
    });
}
export type PpdbResultSettings = Readonly<{
  acceptedFeedback: string;
  acceptedNextSteps: string;
  rejectedFeedback: string;
  rejectedNextSteps: string;
  whatsappGroupUrl: string | null;
}>;
export type PpdbResultSettingsInput = Readonly<Omit<PpdbResultSettings, "whatsappGroupUrl"> & { whatsappGroupUrl: string | null }>;

export type PpdbSession = Readonly<{
  id: string;
  tenantId: string;
  academicYearId: string;
  endDate: string;
  status: PpdbSessionStatus;
  fields: readonly PpdbFormField[];
  draftFields: readonly PpdbFormField[];
  version: number;
  publishedAt: Date | null;
  endedAt: Date | null;
  resultSettings: PpdbResultSettings;
  resultsPublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;
export interface PpdbSessionTransaction {
  list(): Promise<PpdbSession[]>;
  hasPendingSubmissions(sessionId: string): Promise<boolean>;
  save(session: PpdbSession): Promise<void>;
}
export interface PpdbSessionStore {
  list(tenantId: string): Promise<PpdbSession[]>;
  transaction<T>(tenantId: string, work: (transaction: PpdbSessionTransaction) => Promise<T>): Promise<T>;
}
export type PpdbSessionInput = Readonly<{ academicYearId: string; endDate: string }>;

type FailureCode =
  | "invalid-input"
  | "not-found"
  | "invalid-transition"
  | "published-conflict"
  | "empty-fields"
  | "locked"
  | "invalid-result-settings"
  | "session-not-ended"
  | "result-feedback-required"
  | "pending-submissions"
  | "results-already-published"
  | "result-settings-locked";
const failure = (code: FailureCode) => ({ ok: false, code } as const);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validFields(fields: readonly PpdbFormField[]) {
  return fields.every((field) => field.label.trim().length > 0 && (field.type !== "select" || (field.options?.length ?? 0) > 0));
}

const emptyResultSettings: PpdbResultSettings = {
  acceptedFeedback: "",
  acceptedNextSteps: "",
  rejectedFeedback: "",
  rejectedNextSteps: "",
  whatsappGroupUrl: null,
};

function normalizeResultSettings(input: PpdbResultSettingsInput): PpdbResultSettings | null {
  const settings = {
    acceptedFeedback: input.acceptedFeedback.trim(),
    acceptedNextSteps: input.acceptedNextSteps.trim(),
    rejectedFeedback: input.rejectedFeedback.trim(),
    rejectedNextSteps: input.rejectedNextSteps.trim(),
    whatsappGroupUrl: input.whatsappGroupUrl?.trim() || null,
  };
  if ([settings.acceptedFeedback, settings.acceptedNextSteps, settings.rejectedFeedback, settings.rejectedNextSteps].some((value) => value.length > 2000)) return null;
  if (settings.whatsappGroupUrl) {
    if (settings.whatsappGroupUrl.length > 2000) return null;
    try {
      const url = new URL(settings.whatsappGroupUrl);
      if (url.protocol !== "https:" || url.hostname !== "chat.whatsapp.com") return null;
    } catch {
      return null;
    }
  }
  return settings;
}

export function createPpdbSessionService(dependencies: { store: PpdbSessionStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  async function mutate(principal: MasterDataPrincipal, sessionId: string, change: (session: PpdbSession, all: PpdbSession[]) => PpdbSession | FailureCode) {
    return dependencies.store.transaction(principal.tenantId, async (transaction) => {
      const all = await transaction.list();
      const current = all.find((session) => session.id === sessionId && session.tenantId === principal.tenantId);
      if (!current) return failure("not-found");
      const result = change(current, all);
      if (typeof result === "string") return failure(result);
      await transaction.save(result);
      return { ok: true, session: result } as const;
    });
  }

  return {
    list(principal: MasterDataPrincipal) {
      return dependencies.store.list(principal.tenantId);
    },

    create(principal: MasterDataPrincipal, input: PpdbSessionInput) {
      if (!input.academicYearId.trim() || !datePattern.test(input.endDate) || Number.isNaN(Date.parse(`${input.endDate}T00:00:00Z`))) {
        return Promise.resolve(failure("invalid-input"));
      }
      const timestamp = now();
      const session: PpdbSession = {
        id: id(),
        tenantId: principal.tenantId,
        academicYearId: input.academicYearId,
        endDate: input.endDate,
        status: "draft",
        fields: [],
        draftFields: [],
        version: 1,
        publishedAt: null,
        endedAt: null,
        resultSettings: emptyResultSettings,
        resultsPublishedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        await transaction.save(session);
        return { ok: true, session } as const;
      });
    },

    // Edit selalu masuk ke draft; snapshot publik tidak berubah sampai draft dipublikasikan.
    updateFields(principal: MasterDataPrincipal, sessionId: string, fields: readonly PpdbFormField[]) {
      return mutate(principal, sessionId, (session) => {
        if (session.status === "ended") return "locked";
        if (!validFields(fields)) return "invalid-input";
        return { ...session, draftFields: fields, version: session.version + 1, updatedAt: now() };
      });
    },

    updateResultSettings(principal: MasterDataPrincipal, sessionId: string, input: PpdbResultSettingsInput) {
      if (!principal.capabilities.write) return Promise.resolve(failure("locked"));
      return mutate(principal, sessionId, (session) => {
        if (session.resultsPublishedAt) return "result-settings-locked";
        const resultSettings = normalizeResultSettings(input);
        if (!resultSettings) return "invalid-result-settings";
        return { ...session, resultSettings, version: session.version + 1, updatedAt: now() };
      });
    },

    publishResults(principal: MasterDataPrincipal, sessionId: string) {
      if (!principal.capabilities.write) return Promise.resolve(failure("locked"));
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sessions = await transaction.list();
        const session = sessions.find((item) => item.id === sessionId && item.tenantId === principal.tenantId);
        if (!session) return failure("not-found");
        if (session.resultsPublishedAt) return failure("results-already-published");
        if (session.status !== "ended") return failure("session-not-ended");
        if (!session.resultSettings.acceptedFeedback || !session.resultSettings.rejectedFeedback) return failure("result-feedback-required");
        if (await transaction.hasPendingSubmissions(sessionId)) return failure("pending-submissions");
        const timestamp = now();
        const published = { ...session, resultsPublishedAt: timestamp, version: session.version + 1, updatedAt: timestamp };
        await transaction.save(published);
        return { ok: true, session: published } as const;
      });
    },

    // Hanya satu Sesi boleh "published" per Tenant pada satu waktu; Form harus punya minimal satu field.
    publish(principal: MasterDataPrincipal, sessionId: string, fields?: readonly PpdbFormField[]) {
      return mutate(principal, sessionId, (session, all) => {
        if (session.status === "ended") return "invalid-transition";
        const publishedFields = fields ?? session.draftFields;
        if (!publishedFields.length) return "empty-fields";
        if (!validFields(publishedFields)) return "invalid-input";
        if (all.some((item) => item.id !== session.id && item.status === "published")) return "published-conflict";
        const timestamp = now();
        return {
          ...session,
          fields: publishedFields,
          draftFields: publishedFields,
          status: "published",
          publishedAt: session.publishedAt ?? timestamp,
          version: session.version + 1,
          updatedAt: timestamp,
        };
      });
    },

    // Penutupan selalu manual (bukan otomatis berbasis endDate) dan maju-saja — tidak bisa dibuka kembali.
    end(principal: MasterDataPrincipal, sessionId: string) {
      return mutate(principal, sessionId, (session) => {
        if (session.status !== "published") return "invalid-transition";
        const timestamp = now();
        return { ...session, status: "ended", endedAt: timestamp, version: session.version + 1, updatedAt: timestamp };
      });
    },
  };
}
