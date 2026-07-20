import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export const accreditationRatings = ["A", "B", "C", "Terakreditasi", "Tidak Terakreditasi"] as const;
export type AccreditationRating = typeof accreditationRatings[number];

export type SchoolAccreditation = Readonly<{
  id: string;
  tenantId: string;
  rating: AccreditationRating;
  certificateNumber: string;
  issuingInstitution: string;
  determinationDate: string;
  expiryDate: string | null;
  supersedesId: string | null;
  correctionId: string | null;
  invalidationReason: string | null;
  invalidatedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
}>;

export interface SchoolAccreditationTransaction {
  list(tenantId: string): Promise<readonly SchoolAccreditation[]>;
  append(record: SchoolAccreditation): Promise<void>;
  invalidate(tenantId: string, id: string, correctionId: string, reason: string, invalidatedAt: Date): Promise<boolean>;
}

export interface SchoolAccreditationStore {
  list(tenantId: string): Promise<readonly SchoolAccreditation[]>;
  transaction<T>(work: (transaction: SchoolAccreditationTransaction) => Promise<T>): Promise<T>;
}

type Input = Readonly<{ rating: string; certificateNumber: string; issuingInstitution: string; determinationDate: string; expiryDate?: string | null }>;

function parse(input: Input) {
  const errors: Record<string, string> = {};
  const rating = input.rating.trim() as AccreditationRating;
  const certificateNumber = input.certificateNumber.trim();
  const issuingInstitution = input.issuingInstitution.trim();
  const determinationDate = input.determinationDate.trim();
  const expiryDate = input.expiryDate?.trim() || null;
  if (!accreditationRatings.includes(rating)) errors.rating = "Nilai akreditasi tidak valid.";
  if (!certificateNumber || certificateNumber.length > 100) errors.certificateNumber = "Nomor keputusan wajib diisi dan maksimal 100 karakter.";
  if (!issuingInstitution || issuingInstitution.length > 150) errors.issuingInstitution = "Lembaga penerbit wajib diisi dan maksimal 150 karakter.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(determinationDate) || Number.isNaN(Date.parse(`${determinationDate}T00:00:00Z`))) errors.determinationDate = "Tanggal penetapan tidak valid.";
  if (expiryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || Number.isNaN(Date.parse(`${expiryDate}T00:00:00Z`)))) errors.expiryDate = "Tanggal kedaluwarsa tidak valid.";
  if (!errors.determinationDate && !errors.expiryDate && expiryDate && expiryDate < determinationDate) errors.expiryDate = "Tanggal kedaluwarsa tidak boleh sebelum tanggal penetapan.";
  return Object.keys(errors).length ? { errors } : { errors, value: { rating, certificateNumber, issuingInstitution, determinationDate, expiryDate } };
}

function overlaps(a: { determinationDate: string; expiryDate: string | null }, b: { determinationDate: string; expiryDate: string | null }) {
  return a.determinationDate <= (b.expiryDate ?? "9999-12-31") && b.determinationDate <= (a.expiryDate ?? "9999-12-31");
}

export function createListSchoolAccreditationsQuery({ store }: { store: SchoolAccreditationStore }) {
  return async (principal: MasterDataPrincipal) => ({ ok: true, records: await store.list(principal.tenantId) } as const);
}

export function createAddSchoolAccreditationCommand(dependencies: { store: SchoolAccreditationStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return async (principal: MasterDataPrincipal, input: Input) => {
    const parsed = parse(input);
    if (!parsed.value) return { ok: false, code: "invalid-input", errors: parsed.errors } as const;
    return dependencies.store.transaction(async (transaction) => {
      const records = await transaction.list(principal.tenantId);
      if (records.some((record) => !record.invalidatedAt && overlaps(record, parsed.value!))) return { ok: false, code: "overlap" } as const;
      const record: SchoolAccreditation = { id: id(), tenantId: principal.tenantId, ...parsed.value!, supersedesId: null, correctionId: null, invalidationReason: null, invalidatedAt: null, createdByUserId: principal.userId, createdAt: now() };
      await transaction.append(record);
      return { ok: true, record } as const;
    });
  };
}

export function createCorrectSchoolAccreditationCommand(dependencies: { store: SchoolAccreditationStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return async (principal: MasterDataPrincipal, recordId: string, input: Input & { correctionReason: string }) => {
    const parsed = parse(input);
    const correctionReason = input.correctionReason.trim();
    if (!parsed.value || !correctionReason) return { ok: false, code: "invalid-input", errors: { ...parsed.errors, ...(!correctionReason ? { correctionReason: "Alasan koreksi wajib diisi." } : {}) } } as const;
    return dependencies.store.transaction(async (transaction) => {
      const records = await transaction.list(principal.tenantId);
      const original = records.find((record) => record.id === recordId && !record.invalidatedAt);
      if (!original) return { ok: false, code: "not-found" } as const;
      if (records.some((record) => record.id !== recordId && !record.invalidatedAt && overlaps(record, parsed.value!))) return { ok: false, code: "overlap" } as const;
      const correctionId = id();
      const timestamp = now();
      const replacement: SchoolAccreditation = { id: correctionId, tenantId: principal.tenantId, ...parsed.value!, supersedesId: original.id, correctionId: null, invalidationReason: null, invalidatedAt: null, createdByUserId: principal.userId, createdAt: timestamp };
      await transaction.append(replacement);
      if (!await transaction.invalidate(principal.tenantId, original.id, correctionId, correctionReason, timestamp)) throw new Error("Accreditation correction conflict");
      return { ok: true, record: replacement } as const;
    });
  };
}
