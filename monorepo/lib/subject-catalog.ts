import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export const SUBJECT_EDUCATION_LEVELS = ["SD", "SMP", "SMA", "SMK"] as const;
export type SubjectEducationLevel = (typeof SUBJECT_EDUCATION_LEVELS)[number];

export type Subject = Readonly<{
  id: string;
  tenantId: string;
  code: string;
  normalizedCode: string;
  name: string;
  normalizedName: string;
  educationLevels: readonly SubjectEducationLevel[];
  description: string | null;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}>;

export type SubjectHistory = Readonly<{
  id: string;
  tenantId: string;
  subjectId: string;
  actorUserId: string;
  operation: "created" | "edited" | "archived" | "reactivated";
  fromVersion: number;
  toVersion: number;
  occurredAt: Date;
}>;

export interface SubjectCatalogTransaction {
  list(): Promise<Subject[]>;
  save(subject: Subject, expectedVersion: number | null): Promise<boolean>;
  appendHistory(event: SubjectHistory): Promise<void>;
}

export interface SubjectCatalogStore {
  list(tenantId: string): Promise<Subject[]>;
  transaction<T>(tenantId: string, work: (transaction: SubjectCatalogTransaction) => Promise<T>): Promise<T>;
}

export type SubjectInput = Readonly<{ code: string; name: string; educationLevels: readonly string[]; description?: string | null }>;
type FailureCode = "invalid-input" | "duplicate-code" | "duplicate-name" | "not-found" | "conflict" | "archived" | "already-archived" | "not-archived" | "read-only";
const failure = (code: FailureCode) => ({ ok: false, code } as const);

function collapseWhitespace(value: string) { return value.trim().replace(/\s+/g, " "); }
function normalizeCode(value: string) { return collapseWhitespace(value).toLocaleUpperCase("id-ID"); }
function normalizeName(value: string) { return collapseWhitespace(value).toLocaleLowerCase("id-ID"); }
function normalizeInput(input: SubjectInput) {
  const code = normalizeCode(input.code);
  const name = collapseWhitespace(input.name);
  const description = collapseWhitespace(input.description ?? "") || null;
  const educationLevels = [...new Set(input.educationLevels)].filter((level): level is SubjectEducationLevel => SUBJECT_EDUCATION_LEVELS.includes(level as SubjectEducationLevel)).sort();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,29}$/.test(code) || !name || name.length > 150 || description && description.length > 1000 || educationLevels.length === 0 || educationLevels.length !== new Set(input.educationLevels).size) return null;
  return { code, normalizedCode: code, name, normalizedName: normalizeName(name), educationLevels, description };
}

export function createSubjectCatalogService(dependencies: { store: SubjectCatalogStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  async function mutate(principal: MasterDataPrincipal, subjectId: string, expectedVersion: number, operation: SubjectHistory["operation"], change: (subject: Subject, all: Subject[]) => Subject | FailureCode) {
    if (!principal.capabilities.write) return failure("read-only");
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return failure("invalid-input");
    return dependencies.store.transaction(principal.tenantId, async (transaction) => {
      const all = await transaction.list();
      const current = all.find((subject) => subject.id === subjectId && subject.tenantId === principal.tenantId);
      if (!current) return failure("not-found");
      if (current.version !== expectedVersion) return failure("conflict");
      const changed = change(current, all);
      if (typeof changed === "string") return failure(changed);
      if (!await transaction.save(changed, expectedVersion)) return failure("conflict");
      await transaction.appendHistory({ id: id(), tenantId: principal.tenantId, subjectId, actorUserId: principal.userId, operation, fromVersion: current.version, toVersion: changed.version, occurredAt: changed.updatedAt });
      return { ok: true, subject: changed } as const;
    });
  }

  return {
    list(principal: MasterDataPrincipal) { return dependencies.store.list(principal.tenantId); },
    create(principal: MasterDataPrincipal, input: SubjectInput) {
      if (!principal.capabilities.write) return Promise.resolve(failure("read-only"));
      const normalized = normalizeInput(input);
      if (!normalized) return Promise.resolve(failure("invalid-input"));
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        if (all.some((subject) => subject.normalizedCode === normalized.normalizedCode)) return failure("duplicate-code");
        if (all.some((subject) => subject.normalizedName === normalized.normalizedName)) return failure("duplicate-name");
        const timestamp = now();
        const subject: Subject = { id: id(), tenantId: principal.tenantId, ...normalized, archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
        if (!await transaction.save(subject, null)) return failure("conflict");
        await transaction.appendHistory({ id: id(), tenantId: principal.tenantId, subjectId: subject.id, actorUserId: principal.userId, operation: "created", fromVersion: 0, toVersion: 1, occurredAt: timestamp });
        return { ok: true, subject } as const;
      });
    },
    edit(principal: MasterDataPrincipal, subjectId: string, input: SubjectInput, expectedVersion: number) {
      const normalized = normalizeInput(input);
      if (!normalized) return Promise.resolve(failure("invalid-input"));
      return mutate(principal, subjectId, expectedVersion, "edited", (subject, all) => {
        if (subject.archived) return "archived";
        if (all.some((item) => item.id !== subject.id && item.normalizedCode === normalized.normalizedCode)) return "duplicate-code";
        if (all.some((item) => item.id !== subject.id && item.normalizedName === normalized.normalizedName)) return "duplicate-name";
        return { ...subject, ...normalized, version: subject.version + 1, updatedAt: now() };
      });
    },
    archive(principal: MasterDataPrincipal, subjectId: string, expectedVersion: number) {
      return mutate(principal, subjectId, expectedVersion, "archived", (subject) => subject.archived ? "already-archived" : { ...subject, archived: true, archivedAt: now(), version: subject.version + 1, updatedAt: now() });
    },
    reactivate(principal: MasterDataPrincipal, subjectId: string, expectedVersion: number) {
      return mutate(principal, subjectId, expectedVersion, "reactivated", (subject, all) => {
        if (!subject.archived) return "not-archived";
        if (all.some((item) => item.id !== subject.id && item.normalizedCode === subject.normalizedCode)) return "duplicate-code";
        if (all.some((item) => item.id !== subject.id && item.normalizedName === subject.normalizedName)) return "duplicate-name";
        return { ...subject, archived: false, archivedAt: null, version: subject.version + 1, updatedAt: now() };
      });
    },
  };
}
