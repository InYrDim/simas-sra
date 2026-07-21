import assert from "node:assert/strict";
import test from "node:test";

import {
  createGetSchoolProfileQuery,
  createUpdateSchoolProfileCommand,
  type SchoolProfile,
  type SchoolProfileStore,
} from "@/lib/school-profile";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = {
  userId: "admin-1",
  tenantId: "tenant-1",
  role: "school-admin",
  capabilities: { read: true, write: true, downloadTemplate: true },
};

const providerIdentity = {
  tenantId: "tenant-1",
  npsn: "20100001",
  officialName: "SMA Negeri 1 Batunapara",
  educationLevel: "SMA",
  domain: "batunapara",
};

function createStore(options: { tenantId?: string; failAudit?: boolean } = {}) {
  let profile: SchoolProfile | null = null;
  const audits: unknown[] = [];
  const store: SchoolProfileStore = {
    async findProviderIdentity(tenantId) {
      return tenantId === (options.tenantId ?? "tenant-1") ? { ...providerIdentity, tenantId } : null;
    },
    async transaction(work) {
      const before = profile ? { ...profile, address: { ...profile.address } } : null;
      const auditCount = audits.length;
      try {
        return await work({
          async findProfile(tenantId) { return profile?.tenantId === tenantId ? profile : null; },
          async createProfile(value) { profile = value; return value; },
          async updateProfile(tenantId, expectedVersion, value) {
            if (!profile || profile.tenantId !== tenantId || profile.version !== expectedVersion) return null;
            profile = { ...profile, ...value, address: { ...value.address }, version: expectedVersion + 1 };
            return profile;
          },
          async appendAudit(event) {
            if (options.failAudit) throw new Error("audit unavailable");
            audits.push(event);
          },
        });
      } catch (error) {
        profile = before;
        audits.splice(auditCount);
        throw error;
      }
    },
  };
  return { store, profile: () => profile, audits };
}

const validInput = {
  version: 1,
  displayName: "SMA Batunapara",
  address: {
    street: "Jl. Pendidikan 1",
    village: "Batunapara",
    district: "Kota",
    city: "Bandung",
    province: "Jawa Barat",
    postalCode: "40111",
  },
  institutionalEmail: "INFO@BATUNAPARA.SCH.ID",
  institutionalPhone: "+62 22 123456",
  website: "https://batunapara.sch.id",
  latitude: -6.9175,
  longitude: 107.6191,
  description: "Sekolah yang berfokus pada pembelajaran inklusif.",
};

test("profile query lazily creates one Tenant profile from known Provider provenance", async () => {
  const fixture = createStore();
  const query = createGetSchoolProfileQuery({ store: fixture.store, id: () => "profile-1", now: () => new Date("2026-07-20T10:00:00Z") });

  const first = await query(principal);
  const second = await query(principal);

  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  if (!first.ok) return;
  assert.deepEqual(first.profile.provider, providerIdentity);
  assert.equal(first.profile.displayName, providerIdentity.officialName);
  assert.deepEqual(first.profile.address, { street: "", village: "", district: "", city: "", province: "", postalCode: "" });
  assert.equal(first.profile.institutionalEmail, null);
  assert.deepEqual(first.profile.completeness.requiredMissing, ["address.street", "address.city", "address.province"]);
  assert.ok(first.profile.completeness.recommendedMissing.includes("institutionalEmail"));
});

test("profile read and write do not disclose or mutate another Tenant", async () => {
  const fixture = createStore({ tenantId: "tenant-2" });
  const query = createGetSchoolProfileQuery({ store: fixture.store });
  assert.deepEqual(await query(principal), { ok: false, code: "not-found" });
  assert.deepEqual(await createUpdateSchoolProfileCommand({ store: fixture.store })(principal, validInput), { ok: false, code: "not-found" });
  assert.equal(fixture.profile(), null);
});

test("update rejects Provider-owned fields instead of ignoring them", async () => {
  const fixture = createStore();
  const query = createGetSchoolProfileQuery({ store: fixture.store });
  await query(principal);
  const update = createUpdateSchoolProfileCommand({ store: fixture.store });

  const input = { ...validInput, npsn: "99999999" };
  const result = await update(principal, input);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid-input");
  assert.deepEqual(result.input, input);
  assert.equal(result.errors.npsn, "NPSN dikelola oleh Provider dan tidak dapat diubah di sini.");
  assert.equal(fixture.profile()?.version, 1);
});

test("update validates HTTPS, coordinates, contacts, and plain text", async () => {
  const fixture = createStore();
  await createGetSchoolProfileQuery({ store: fixture.store })(principal);
  const update = createUpdateSchoolProfileCommand({ store: fixture.store });
  const input = { ...validInput, website: "http://example.test", latitude: 91, institutionalEmail: "invalid", description: "Halo <b>dunia</b>" };

  const result = await update(principal, input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid-input");
  assert.deepEqual(result.input, input);
  assert.ok(result.errors.website);
  assert.ok(result.errors.latitude);
  assert.ok(result.errors.institutionalEmail);
  assert.ok(result.errors.description);
});

test("stale update is rejected and preserves submitted input", async () => {
  const fixture = createStore();
  await createGetSchoolProfileQuery({ store: fixture.store })(principal);
  const update = createUpdateSchoolProfileCommand({ store: fixture.store });
  assert.equal((await update(principal, validInput)).ok, true);

  const stale = { ...validInput, displayName: "Nama dari tab lama" };
  assert.deepEqual(await update(principal, stale), { ok: false, code: "conflict", input: stale });
  assert.equal(fixture.profile()?.displayName, "SMA Batunapara");
});

test("successful update normalizes values and stores audit in the same transaction", async () => {
  const fixture = createStore();
  await createGetSchoolProfileQuery({ store: fixture.store })(principal);
  const update = createUpdateSchoolProfileCommand({ store: fixture.store, now: () => new Date("2026-07-20T11:00:00Z"), id: () => "audit-1" });

  const result = await update(principal, validInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.profile.version, 2);
  assert.equal(result.profile.institutionalEmail, "info@batunapara.sch.id");
  assert.equal(fixture.audits.length, 1);

  const failing = createStore({ failAudit: true });
  await createGetSchoolProfileQuery({ store: failing.store })(principal);
  await assert.rejects(createUpdateSchoolProfileCommand({ store: failing.store })(principal, validInput), /audit unavailable/);
  assert.equal(failing.profile()?.version, 1);
  assert.equal(failing.audits.length, 0);
});
