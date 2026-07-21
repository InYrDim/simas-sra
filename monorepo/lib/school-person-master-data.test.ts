import assert from "node:assert/strict";
import test from "node:test";

import { createSchoolPersonMasterDataService, type SchoolPersonAggregate, type SchoolPersonAudit, type SchoolPersonMasterDataStore } from "@/lib/school-person-master-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-a", tenantId: "tenant-a", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const person = (overrides: Partial<SchoolPersonAggregate["person"]> = {}): SchoolPersonAggregate["person"] => ({ id: "person-a", tenantId: "tenant-a", fullName: "Aisyah Putri", nik: "0012345678901234", nip: "001234567890123456", accountUserId: "account-a", archived: false, version: 3, updatedAt: new Date("2026-07-20T00:00:00Z"), ...overrides });
const profile = (kind: "student" | "teacher" | "staff", archived: boolean) => ({ id: `${kind}-a`, kind, archived });

function fixture(aggregate: SchoolPersonAggregate) {
  let current = structuredClone(aggregate); const audits: SchoolPersonAudit[] = [];
  const store: SchoolPersonMasterDataStore = {
    async get(tenantId, personId) { return current.person.tenantId === tenantId && current.person.id === personId ? structuredClone(current) : null; },
    async transaction(tenantId, work) { return work({
      async get(personId) { return current.person.tenantId === tenantId && current.person.id === personId ? structuredClone(current) : null; },
      async savePerson(value, expectedVersion) { if (value.tenantId !== tenantId || current.person.version !== expectedVersion) return false; current = { ...current, person: structuredClone(value) }; return true; },
      async appendAudit(value) { audits.push(structuredClone(value)); },
    }); },
  };
  return { store, audits, current: () => current };
}

test("archives Warga Sekolah only after every profile is archived without changing the account link", async () => {
  const data = fixture({ person: person(), profiles: [profile("student", true), profile("teacher", true), profile("staff", true)] });
  const result = await createSchoolPersonMasterDataService({ store: data.store, id: () => "audit-a", now: () => new Date("2026-07-20T09:00:00Z") }).archive(principal, "person-a", { expectedVersion: 3, reason: "Tidak lagi terdaftar" });
  assert.equal(result.ok, true); assert.equal(data.current().person.archived, true); assert.equal(data.current().person.accountUserId, "account-a");
  assert.deepEqual(data.audits.map((item) => item.operation), ["archived"]);
});

test("rejects aggregate archive while any profile is active and reports every blocker", async () => {
  const data = fixture({ person: person(), profiles: [profile("student", true), profile("teacher", false), profile("staff", false)] });
  const result = await createSchoolPersonMasterDataService({ store: data.store }).archive(principal, "person-a", { expectedVersion: 3, reason: "Selesai" });
  assert.equal(result.ok, false); if (result.ok) return; assert.equal(result.code, "profile-active"); assert.deepEqual(result.activeProfiles, ["teacher", "staff"]); assert.equal(data.current().person.archived, false);
});

test("tenant isolation makes another Tenant person indistinguishable from missing", async () => {
  const data = fixture({ person: person(), profiles: [profile("student", true)] });
  const result = await createSchoolPersonMasterDataService({ store: data.store }).archive({ ...principal, tenantId: "tenant-b" }, "person-a", { expectedVersion: 3, reason: "Selesai" });
  assert.deepEqual(result, { ok: false, code: "not-found" }); assert.equal(data.audits.length, 0);
});
