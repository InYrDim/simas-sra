import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeMasterDataAccess,
  authorizeMasterDataRecordAccess,
  type MasterDataAccessSnapshot,
} from "@/lib/tenant-master-data-access";

const now = new Date("2026-07-20T12:00:00.000Z");

function snapshot(overrides: Partial<MasterDataAccessSnapshot> = {}): MasterDataAccessSnapshot {
  return {
    session: {
      userId: "admin-1",
      tenantId: "tenant-1",
      tenantRole: "school-admin",
    },
    requestedDomain: "sekolah",
    tenant: {
      id: "tenant-1",
      domain: "sekolah",
      operationalStatus: "active",
      trialEndsAt: null,
      featurePolicy: { read: true, write: true },
    },
    operation: "read",
    now,
    ...overrides,
  };
}

test("School Admin receives a canonical principal from the matching session and domain", () => {
  assert.deepEqual(authorizeMasterDataAccess(snapshot()), {
    kind: "authorized",
    principal: {
      userId: "admin-1",
      tenantId: "tenant-1",
      role: "school-admin",
      capabilities: { read: true, write: true, downloadTemplate: true },
    },
  });
});

test("access distinguishes role denial from tenant and domain non-disclosure", () => {
  assert.deepEqual(authorizeMasterDataAccess(snapshot({
    session: { userId: "staff-1", tenantId: "tenant-1", tenantRole: "staff" },
  })), { kind: "forbidden", reason: "role" });

  assert.deepEqual(authorizeMasterDataAccess(snapshot({
    session: { userId: "admin-2", tenantId: "tenant-2", tenantRole: "school-admin" },
  })), { kind: "not-found" });

  assert.deepEqual(authorizeMasterDataAccess(snapshot({ requestedDomain: "lain" })), { kind: "not-found" });
  assert.deepEqual(authorizeMasterDataAccess(snapshot({ tenant: null })), { kind: "not-found" });
});

test("read and write feature policy is enforced independently on the server", () => {
  assert.deepEqual(authorizeMasterDataAccess(snapshot({
    tenant: { ...snapshot().tenant!, featurePolicy: { read: false, write: true } },
  })), { kind: "forbidden", reason: "feature-disabled" });

  assert.deepEqual(authorizeMasterDataAccess(snapshot({
    operation: "write",
    tenant: { ...snapshot().tenant!, featurePolicy: { read: true, write: false } },
  })), { kind: "forbidden", reason: "feature-disabled" });
});

test("Tenant lifecycle grants full, read-only, or no capabilities", () => {
  const activeTrial = snapshot({ tenant: { ...snapshot().tenant!, trialEndsAt: new Date("2026-07-21T12:00:00.000Z") } });
  assert.equal(authorizeMasterDataAccess(activeTrial).kind, "authorized");
  assert.equal(authorizeMasterDataAccess({ ...activeTrial, operation: "write" }).kind, "authorized");

  const expired = snapshot({ tenant: { ...snapshot().tenant!, trialEndsAt: now } });
  assert.deepEqual(authorizeMasterDataAccess(expired), {
    kind: "authorized",
    principal: {
      userId: "admin-1",
      tenantId: "tenant-1",
      role: "school-admin",
      capabilities: { read: true, write: false, downloadTemplate: true },
    },
  });
  assert.deepEqual(authorizeMasterDataAccess({ ...expired, operation: "write" }), {
    kind: "forbidden", reason: "read-only",
  });
  assert.equal(authorizeMasterDataAccess({
    ...expired,
    operation: "download-template",
    tenant: { ...expired.tenant!, featurePolicy: { read: true, write: false, importDownload: true } },
  }).kind, "authorized");

  const suspended = snapshot({ tenant: { ...snapshot().tenant!, operationalStatus: "suspended" } });
  assert.deepEqual(authorizeMasterDataAccess(suspended), {
    kind: "authorized",
    principal: {
      userId: "admin-1",
      tenantId: "tenant-1",
      role: "school-admin",
      capabilities: { read: true, write: false, downloadTemplate: false },
    },
  });
  assert.deepEqual(authorizeMasterDataAccess({ ...suspended, operation: "download-template", tenant: { ...suspended.tenant!, featurePolicy: { ...suspended.tenant!.featurePolicy, importDownload: true } } }), {
    kind: "forbidden", reason: "read-only",
  });

  for (const operationalStatus of ["closed", null] as const) {
    assert.deepEqual(authorizeMasterDataAccess(snapshot({
      tenant: { ...snapshot().tenant!, operationalStatus },
    })), { kind: "not-found" });
  }
});

test("record access scopes ownership to the principal without disclosing cross-Tenant records", () => {
  const access = authorizeMasterDataAccess(snapshot());
  assert.equal(access.kind, "authorized");
  if (access.kind !== "authorized") return;

  assert.deepEqual(authorizeMasterDataRecordAccess(access.principal, { id: "record-1", tenantId: "tenant-1" }), {
    kind: "authorized", principal: access.principal, recordId: "record-1",
  });
  assert.deepEqual(authorizeMasterDataRecordAccess(access.principal, { id: "record-1", tenantId: "tenant-2" }), {
    kind: "not-found",
  });
  assert.deepEqual(authorizeMasterDataRecordAccess(access.principal, null), { kind: "not-found" });
});
