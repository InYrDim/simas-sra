import assert from "node:assert/strict";
import test from "node:test";

import {
  createAddSchoolAccreditationCommand,
  createCorrectSchoolAccreditationCommand,
  createListSchoolAccreditationsQuery,
  type SchoolAccreditation,
  type SchoolAccreditationStore,
} from "@/lib/school-accreditation";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = {
  userId: "admin-1", tenantId: "tenant-1", role: "school-admin",
  capabilities: { read: true, write: true, downloadTemplate: true },
};

function fixture() {
  let records: SchoolAccreditation[] = [];
  const store: SchoolAccreditationStore = {
    async list(tenantId) { return records.filter((record) => record.tenantId === tenantId); },
    async transaction(work) {
      const before = records;
      try {
        return await work({
          async list(tenantId) { return records.filter((record) => record.tenantId === tenantId); },
          async append(record) { records = [...records, record]; },
          async invalidate(tenantId, id, correctionId, reason, invalidatedAt) {
            const record = records.find((item) => item.tenantId === tenantId && item.id === id && !item.invalidatedAt);
            if (!record) return false;
            records = records.map((item) => item === record ? { ...item, correctionId, invalidationReason: reason, invalidatedAt } : item);
            return true;
          },
        });
      } catch (error) { records = before; throw error; }
    },
  };
  return { store, records: () => records };
}

const input = {
  rating: "A", certificateNumber: "SK-001", issuingInstitution: "BAN-S/M",
  determinationDate: "2024-01-01", expiryDate: "2028-12-31",
} as const;

test("School Admin appends valid accreditation history and reads only its Tenant", async () => {
  const data = fixture();
  const add = createAddSchoolAccreditationCommand({ store: data.store, id: () => "acc-1", now: () => new Date("2026-07-20T10:00:00Z") });
  assert.equal((await add(principal, input)).ok, true);
  assert.equal(data.records().length, 1);
  assert.deepEqual(await createListSchoolAccreditationsQuery({ store: data.store })(principal), { ok: true, records: data.records() });
  assert.deepEqual(await createListSchoolAccreditationsQuery({ store: data.store })({ ...principal, tenantId: "tenant-2" }), { ok: true, records: [] });
});

test("invalid or overlapping accreditation periods are rejected without mutation", async () => {
  const data = fixture();
  const add = createAddSchoolAccreditationCommand({ store: data.store, id: () => `acc-${data.records().length + 1}` });
  await add(principal, input);
  const invalid = await add(principal, { ...input, determinationDate: "2029-01-01", expiryDate: "2028-01-01" });
  assert.equal(invalid.ok, false);
  const overlap = await add(principal, { ...input, certificateNumber: "SK-002", determinationDate: "2028-01-01", expiryDate: "2030-01-01" });
  assert.equal(overlap.ok, false);
  assert.equal(data.records().length, 1);
});

test("correction invalidates the erroneous entry and appends a replacement", async () => {
  const data = fixture();
  await createAddSchoolAccreditationCommand({ store: data.store, id: () => "acc-1" })(principal, input);
  const correct = createCorrectSchoolAccreditationCommand({ store: data.store, id: () => "acc-2", now: () => new Date("2026-07-20T11:00:00Z") });
  const result = await correct(principal, "acc-1", { ...input, rating: "B", correctionReason: "Nilai pada sertifikat adalah B." });
  assert.equal(result.ok, true);
  assert.equal(data.records().length, 2);
  assert.equal(data.records()[0].correctionId, "acc-2");
  assert.equal(data.records()[1].supersedesId, "acc-1");
});
