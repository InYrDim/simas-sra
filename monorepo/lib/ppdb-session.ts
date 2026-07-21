import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type PpdbSessionStatus = "draft" | "published" | "ended";
export type PpdbFieldType = "text" | "number" | "file" | "select";
export type PpdbFormField = Readonly<{
  id: string;
  label: string;
  type: PpdbFieldType;
  required: boolean;
  options?: readonly string[];
}>;
export type PpdbSession = Readonly<{
  id: string;
  tenantId: string;
  academicYearId: string;
  endDate: string;
  status: PpdbSessionStatus;
  fields: readonly PpdbFormField[];
  version: number;
  publishedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;
export interface PpdbSessionTransaction {
  list(): Promise<PpdbSession[]>;
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
  | "locked";
const failure = (code: FailureCode) => ({ ok: false, code } as const);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validFields(fields: readonly PpdbFormField[]) {
  return fields.every((field) => field.label.trim().length > 0 && (field.type !== "select" || (field.options?.length ?? 0) > 0));
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
        version: 1,
        publishedAt: null,
        endedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        await transaction.save(session);
        return { ok: true, session } as const;
      });
    },

    // Struktur Form (fields) hanya bisa diubah selagi Sesi masih "draft" — terkunci begitu dipublikasikan.
    updateFields(principal: MasterDataPrincipal, sessionId: string, fields: readonly PpdbFormField[]) {
      return mutate(principal, sessionId, (session) => {
        if (session.status !== "draft") return "locked";
        if (!validFields(fields)) return "invalid-input";
        return { ...session, fields, version: session.version + 1, updatedAt: now() };
      });
    },

    // Hanya satu Sesi boleh "published" per Tenant pada satu waktu; Form harus punya minimal satu field.
    publish(principal: MasterDataPrincipal, sessionId: string) {
      return mutate(principal, sessionId, (session, all) => {
        if (session.status !== "draft") return "invalid-transition";
        if (!session.fields.length) return "empty-fields";
        if (all.some((item) => item.id !== session.id && item.status === "published")) return "published-conflict";
        const timestamp = now();
        return { ...session, status: "published", publishedAt: timestamp, version: session.version + 1, updatedAt: timestamp };
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
