import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type SchoolProfileKind = "student" | "teacher" | "staff";
export type SchoolPersonSummary = Readonly<{ id: string; tenantId: string; fullName: string; nik: string | null; nip: string | null; accountUserId: string | null; archived: boolean; version: number; updatedAt: Date }>;
export type SchoolPersonProfile = Readonly<{ id: string; kind: SchoolProfileKind; archived: boolean }>;
export type SchoolPersonAggregate = Readonly<{ person: SchoolPersonSummary; profiles: readonly SchoolPersonProfile[] }>;
export type SchoolPersonAudit = Readonly<{ id: string; tenantId: string; personId: string; actorUserId: string; operation: "archived"; affectedProfiles: readonly SchoolProfileKind[]; fromVersion: number; toVersion: number; sensitiveBefore: { nip: string | null } | null; sensitiveAfter: { nip: string | null } | null; reason: string | null; occurredAt: Date }>;
export interface SchoolPersonTransaction { get(personId: string): Promise<SchoolPersonAggregate | null>; savePerson(value: SchoolPersonSummary, expectedVersion: number): Promise<boolean>; appendAudit(value: SchoolPersonAudit): Promise<void> }
export interface SchoolPersonMasterDataStore { get(tenantId: string, personId: string): Promise<SchoolPersonAggregate | null>; transaction<T>(tenantId: string, work: (transaction: SchoolPersonTransaction) => Promise<T>): Promise<T> }

const failure = (code: "read-only" | "invalid-input" | "not-found" | "conflict" | "archived" | "not-archived", extra?: object) => ({ ok: false, code, ...extra } as const);
const profileKinds = (aggregate: SchoolPersonAggregate) => aggregate.profiles.map((profile) => profile.kind);

export function createSchoolPersonMasterDataService(dependencies: { store: SchoolPersonMasterDataStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID()), now = dependencies.now ?? (() => new Date());
  return {
    get(principal: MasterDataPrincipal, personId: string) { return dependencies.store.get(principal.tenantId, personId); },
    async archive(principal: MasterDataPrincipal, personId: string, input: { expectedVersion: number; reason: string }) {
      if (!principal.capabilities.write) return failure("read-only"); const reason = input.reason.trim(); if (!reason || input.expectedVersion < 1) return failure("invalid-input");
      return dependencies.store.transaction(principal.tenantId, async (tx) => { const aggregate = await tx.get(personId); if (!aggregate) return failure("not-found"); if (aggregate.person.version !== input.expectedVersion) return failure("conflict"); if (aggregate.person.archived) return failure("archived"); const activeProfiles = aggregate.profiles.filter((profile) => !profile.archived).map((profile) => profile.kind); if (activeProfiles.length) return { ok: false, code: "profile-active", activeProfiles } as const; const timestamp = now(), updated = { ...aggregate.person, archived: true, version: aggregate.person.version + 1, updatedAt: timestamp }; if (!await tx.savePerson(updated, aggregate.person.version)) return failure("conflict"); await tx.appendAudit({ id: id(), tenantId: principal.tenantId, personId, actorUserId: principal.userId, operation: "archived", affectedProfiles: profileKinds(aggregate), fromVersion: aggregate.person.version, toVersion: updated.version, sensitiveBefore: null, sensitiveAfter: null, reason, occurredAt: timestamp }); return { ok: true, aggregate: { ...aggregate, person: updated } } as const; });
    },
  };
}
