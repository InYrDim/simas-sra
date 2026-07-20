import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type SchoolAddress = Readonly<{
  street: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}>;

export type SchoolProviderIdentity = Readonly<{
  tenantId: string;
  npsn: string;
  officialName: string;
  educationLevel: string;
  domain: string;
}>;

export type SchoolProfile = Readonly<{
  id: string;
  tenantId: string;
  provider: SchoolProviderIdentity;
  displayName: string;
  address: SchoolAddress;
  institutionalEmail: string | null;
  institutionalPhone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type SchoolProfileAudit = Readonly<{
  id: string;
  tenantId: string;
  actorUserId: string;
  profileId: string;
  operation: "school-profile.updated";
  fromVersion: number;
  toVersion: number;
  occurredAt: Date;
}>;

export interface SchoolProfileTransaction {
  findProfile(tenantId: string): Promise<SchoolProfile | null>;
  createProfile(profile: SchoolProfile): Promise<SchoolProfile>;
  updateProfile(
    tenantId: string,
    expectedVersion: number,
    values: Pick<SchoolProfile, "displayName" | "address" | "institutionalEmail" | "institutionalPhone" | "website" | "latitude" | "longitude" | "description" | "updatedAt">,
  ): Promise<SchoolProfile | null>;
  appendAudit(event: SchoolProfileAudit): Promise<void>;
}

export interface SchoolProfileStore {
  findProviderIdentity(tenantId: string): Promise<SchoolProviderIdentity | null>;
  transaction<T>(work: (transaction: SchoolProfileTransaction) => Promise<T>): Promise<T>;
}

export type SchoolProfileView = SchoolProfile & Readonly<{
  completeness: Readonly<{ requiredMissing: readonly string[]; recommendedMissing: readonly string[] }>;
}>;

const emptyAddress: SchoolAddress = { street: "", village: "", district: "", city: "", province: "", postalCode: "" };
const managedKeys = new Set(["version", "displayName", "address", "institutionalEmail", "institutionalPhone", "website", "latitude", "longitude", "description"]);
const providerMessages: Record<string, string> = {
  npsn: "NPSN dikelola oleh Provider dan tidak dapat diubah di sini.",
  officialName: "Nama resmi sekolah dikelola oleh Provider dan tidak dapat diubah di sini.",
  schoolName: "Nama resmi sekolah dikelola oleh Provider dan tidak dapat diubah di sini.",
  educationLevel: "Jenjang pendidikan dikelola oleh Provider dan tidak dapat diubah di sini.",
  domain: "Domain dikelola oleh Provider dan tidak dapat diubah di sini.",
  tenantId: "Tenant ditentukan dari sesi dan tidak dapat diubah.",
};

function completeness(profile: SchoolProfile) {
  const required: [string, string][] = [
    ["displayName", profile.displayName],
    ["address.street", profile.address.street],
    ["address.city", profile.address.city],
    ["address.province", profile.address.province],
  ];
  const recommended: [string, unknown][] = [
    ["address.village", profile.address.village], ["address.district", profile.address.district],
    ["address.postalCode", profile.address.postalCode], ["institutionalEmail", profile.institutionalEmail],
    ["institutionalPhone", profile.institutionalPhone], ["website", profile.website],
    ["coordinates", profile.latitude !== null && profile.longitude !== null], ["description", profile.description],
  ];
  return {
    requiredMissing: required.filter(([, value]) => !value).map(([field]) => field),
    recommendedMissing: recommended.filter(([, value]) => !value).map(([field]) => field),
  };
}

function view(profile: SchoolProfile): SchoolProfileView {
  return { ...profile, completeness: completeness(profile) };
}

export function createGetSchoolProfileQuery(dependencies: {
  store: SchoolProfileStore;
  id?: () => string;
  now?: () => Date;
}) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return async (principal: MasterDataPrincipal) => {
    const provider = await dependencies.store.findProviderIdentity(principal.tenantId);
    if (!provider || provider.tenantId !== principal.tenantId) return { ok: false, code: "not-found" } as const;
    return dependencies.store.transaction(async (transaction) => {
      const existing = await transaction.findProfile(principal.tenantId);
      if (existing) return { ok: true, profile: view({ ...existing, provider }) } as const;
      const timestamp = now();
      const created = await transaction.createProfile({
        id: id(), tenantId: principal.tenantId, provider,
        displayName: provider.officialName,
        address: emptyAddress,
        institutionalEmail: null, institutionalPhone: null, website: null,
        latitude: null, longitude: null, description: null,
        version: 1, createdAt: timestamp, updatedAt: timestamp,
      });
      return { ok: true, profile: view(created) } as const;
    });
  };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function validate(input: unknown): { value?: Omit<Parameters<SchoolProfileTransaction["updateProfile"]>[2], "updatedAt">; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: { form: "Data profil tidak valid." } };
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!managedKeys.has(key)) errors[key] = providerMessages[key] ?? `Field ${key} tidak dikenali.`;
  }
  const version = record.version;
  if (!Number.isInteger(version) || (version as number) < 1) errors.version = "Versi profil tidak valid.";
  const displayName = optionalString(record.displayName) ?? "";
  if (!displayName) errors.displayName = "Nama tampilan wajib diisi.";
  if (displayName.length > 255) errors.displayName = "Nama tampilan maksimal 255 karakter.";

  const sourceAddress = record.address && typeof record.address === "object" && !Array.isArray(record.address) ? record.address as Record<string, unknown> : {};
  const address: SchoolAddress = {
    street: optionalString(sourceAddress.street) ?? "", village: optionalString(sourceAddress.village) ?? "",
    district: optionalString(sourceAddress.district) ?? "", city: optionalString(sourceAddress.city) ?? "",
    province: optionalString(sourceAddress.province) ?? "", postalCode: optionalString(sourceAddress.postalCode) ?? "",
  };
  for (const key of Object.keys(sourceAddress)) if (!(key in address)) errors[`address.${key}`] = `Field alamat ${key} tidak dikenali.`;
  for (const field of ["street", "city", "province"] as const) if (!address[field]) errors[`address.${field}`] = "Field alamat ini wajib diisi.";
  if (address.postalCode && !/^\d{5}$/.test(address.postalCode)) errors["address.postalCode"] = "Kode pos harus terdiri dari 5 digit.";

  const institutionalEmail = optionalString(record.institutionalEmail)?.toLowerCase() ?? null;
  if (institutionalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(institutionalEmail)) errors.institutionalEmail = "Email institusi tidak valid.";
  const institutionalPhone = optionalString(record.institutionalPhone);
  if (institutionalPhone && !/^\+?[0-9 ()-]{7,32}$/.test(institutionalPhone)) errors.institutionalPhone = "Telepon institusi tidak valid.";
  const website = optionalString(record.website);
  if (website) {
    try { if (new URL(website).protocol !== "https:") errors.website = "Website harus menggunakan HTTPS."; }
    catch { errors.website = "Website tidak valid."; }
  }
  const latitude = record.latitude === null || record.latitude === "" || record.latitude === undefined ? null : Number(record.latitude);
  const longitude = record.longitude === null || record.longitude === "" || record.longitude === undefined ? null : Number(record.longitude);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) errors.latitude = "Latitude harus antara -90 dan 90.";
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) errors.longitude = "Longitude harus antara -180 dan 180.";
  if ((latitude === null) !== (longitude === null)) errors.coordinates = "Latitude dan longitude harus diisi bersama.";
  const description = optionalString(record.description);
  if (description && /<[^>]*>/.test(description)) errors.description = "Deskripsi harus berupa teks biasa tanpa HTML.";
  if (description && description.length > 2000) errors.description = "Deskripsi maksimal 2000 karakter.";

  return Object.keys(errors).length ? { errors } : {
    errors,
    value: { displayName, address, institutionalEmail, institutionalPhone, website, latitude, longitude, description },
  };
}

export function createUpdateSchoolProfileCommand(dependencies: { store: SchoolProfileStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return async (principal: MasterDataPrincipal, input: unknown) => {
    const parsed = validate(input);
    if (!parsed.value) return { ok: false, code: "invalid-input", errors: parsed.errors, input } as const;
    const expectedVersion = (input as { version: number }).version;
    return dependencies.store.transaction(async (transaction) => {
      const current = await transaction.findProfile(principal.tenantId);
      if (!current) return { ok: false, code: "not-found" } as const;
      const occurredAt = now();
      const updated = await transaction.updateProfile(principal.tenantId, expectedVersion, { ...parsed.value!, updatedAt: occurredAt });
      if (!updated) return { ok: false, code: "conflict", input } as const;
      await transaction.appendAudit({
        id: id(), tenantId: principal.tenantId, actorUserId: principal.userId,
        profileId: updated.id, operation: "school-profile.updated",
        fromVersion: expectedVersion, toVersion: updated.version, occurredAt,
      });
      return { ok: true, profile: view(updated) } as const;
    });
  };
}
