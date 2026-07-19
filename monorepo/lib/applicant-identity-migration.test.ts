import assert from "node:assert/strict";
import test from "node:test";

import {
  auditApplicantIdentityMigration,
  planApplicantOwnershipBackfill,
  type ApplicantIdentityMigrationSnapshot,
} from "@/lib/applicant-identity-migration";

const cleanSnapshot: ApplicantIdentityMigrationSnapshot = {
  users: [
    { id: "provider-1", tenantId: null, tenantRole: null },
    { id: "school-admin-1", tenantId: "tenant-1", tenantRole: "school-admin" },
    { id: "applicant-1", tenantId: null, tenantRole: null },
  ],
  providerAdminUserIds: ["provider-1"],
  applicantUserIds: ["applicant-1"],
  bindings: [
    { id: "binding-1", userId: "applicant-1", canonicalNpsn: "20100001" },
    { id: "binding-approved", userId: "school-admin-1", canonicalNpsn: "30100001" },
  ],
  applications: [
    {
      id: "application-1",
      npsn: "20100001",
      status: "rejected",
      ownerUserId: "applicant-1",
      bindingId: "binding-1",
      attemptNumber: 1,
      idempotencyKey: "legacy:application-1",
      payloadHash: "legacy:application-1",
      approvedTenantId: null,
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "approved-1",
      npsn: "30100001",
      status: "approved",
      ownerUserId: "school-admin-1",
      bindingId: "binding-approved",
      attemptNumber: 1,
      idempotencyKey: "legacy:approved-1",
      payloadHash: "legacy:approved-1",
      approvedTenantId: "tenant-1",
      submittedAt: new Date("2025-12-01T00:00:00.000Z"),
    },
  ],
  tenants: [
    { id: "tenant-1", npsn: "30100001", sourceApplicationId: "approved-1" },
  ],
  activations: [
    {
      userId: "school-admin-1",
      tenantId: "tenant-1",
      temporaryCredentialIssuedAt: new Date("2026-01-02T00:00:00.000Z"),
      firstAuthenticatedAt: new Date("2026-01-03T00:00:00.000Z"),
      passwordChangedAt: new Date("2026-01-03T00:05:00.000Z"),
    },
  ],
};

test("clean expanded data passes with an activation timestamp baseline", () => {
  const report = auditApplicantIdentityMigration(cleanSnapshot);

  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.activationBaseline, {
    count: 1,
    records: [
      {
        userId: "school-admin-1",
        tenantId: "tenant-1",
        temporaryCredentialIssuedAt: "2026-01-02T00:00:00.000Z",
        firstAuthenticatedAt: "2026-01-03T00:00:00.000Z",
        passwordChangedAt: "2026-01-03T00:05:00.000Z",
      },
    ],
  });
});

test("unsafe legacy data is blocked with deterministic actionable identifiers", () => {
  const report = auditApplicantIdentityMigration({
    users: [
      { id: "orphan-user", tenantId: null, tenantRole: null },
      { id: "multi-user", tenantId: "missing-tenant", tenantRole: "school-admin" },
      { id: "role-without-tenant", tenantId: null, tenantRole: "school-admin" },
    ],
    providerAdminUserIds: ["multi-user"],
    applicantUserIds: [],
    bindings: [],
    applications: [
      {
        id: "ownerless-b",
        npsn: "20-100-001",
        status: "pending",
        ownerUserId: null,
        bindingId: null,
        attemptNumber: null,
        idempotencyKey: null,
        payloadHash: null,
        approvedTenantId: null,
        submittedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        id: "ownerless-a",
        npsn: "20100001",
        status: "pending",
        ownerUserId: null,
        bindingId: null,
        attemptNumber: null,
        idempotencyKey: null,
        payloadHash: null,
        approvedTenantId: "missing-tenant",
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    tenants: [
      { id: "tenant-duplicate-a", npsn: "20100001", sourceApplicationId: "ownerless-a" },
      { id: "tenant-duplicate-b", npsn: "20100001", sourceApplicationId: "ownerless-b" },
    ],
    activations: [
      {
        userId: "multi-user",
        tenantId: "tenant-duplicate-a",
        temporaryCredentialIssuedAt: new Date("2026-01-04T00:00:00.000Z"),
        firstAuthenticatedAt: null,
        passwordChangedAt: null,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map(({ code, identifiers }) => ({ code, identifiers })),
    [
      { code: "applications-without-owner", identifiers: ["ownerless-a", "ownerless-b"] },
      { code: "noncanonical-application-npsn", identifiers: ["ownerless-b"] },
      { code: "duplicate-canonical-npsn", identifiers: ["20100001"] },
      { code: "multiple-pending-applications", identifiers: ["20100001"] },
      { code: "invalid-identity-path-count", identifiers: ["multi-user", "orphan-user", "role-without-tenant"] },
      { code: "school-admin-without-valid-tenant", identifiers: ["multi-user", "role-without-tenant"] },
      { code: "inconsistent-approval-tenant-link", identifiers: ["ownerless-a", "tenant-duplicate-a", "tenant-duplicate-b"] },
      { code: "invalid-temporary-credential-activation", identifiers: ["multi-user"] },
    ],
  );
  assert.equal(JSON.stringify(report).includes("contact"), false);
});

test("explicit ownership mappings produce a validated rerunnable backfill plan", () => {
  const legacy: ApplicantIdentityMigrationSnapshot = {
    ...cleanSnapshot,
    users: [{ id: "applicant-1", tenantId: null, tenantRole: null }],
    providerAdminUserIds: [],
    applicantUserIds: [],
    bindings: [],
    tenants: [],
    activations: [],
    applications: [
      {
        id: "application-1",
        npsn: "20100001",
        status: "rejected" as const,
        ownerUserId: null,
        bindingId: null,
        attemptNumber: null,
        idempotencyKey: null,
        payloadHash: null,
        approvedTenantId: null,
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "application-2",
        npsn: "20100001",
        status: "pending" as const,
        ownerUserId: null,
        bindingId: null,
        attemptNumber: null,
        idempotencyKey: null,
        payloadHash: null,
        approvedTenantId: null,
        submittedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
  };
  const mappings = [
    { applicationId: "application-2", ownerUserId: "applicant-1" },
    { applicationId: "application-1", ownerUserId: "applicant-1" },
  ];

  const firstPlan = planApplicantOwnershipBackfill(legacy, mappings);
  assert.deepEqual(firstPlan, {
    ok: true,
    operations: [
      { type: "ensure-applicant", userId: "applicant-1" },
      {
        type: "ensure-binding",
        id: "legacy:45fc50a156614081a82198fb26502",
        userId: "applicant-1",
        canonicalNpsn: "20100001",
      },
      {
        type: "assign-application",
        applicationId: "application-1",
        ownerUserId: "applicant-1",
        bindingId: "legacy:45fc50a156614081a82198fb26502",
        attemptNumber: 1,
        idempotencyKey: "legacy:application-1",
        payloadHash: "legacy:application-1",
      },
      {
        type: "assign-application",
        applicationId: "application-2",
        ownerUserId: "applicant-1",
        bindingId: "legacy:45fc50a156614081a82198fb26502",
        attemptNumber: 2,
        idempotencyKey: "legacy:application-2",
        payloadHash: "legacy:application-2",
      },
    ],
  });

  const assignments = new Map(
    (firstPlan.ok ? firstPlan.operations : [])
      .filter((operation) => operation.type === "assign-application")
      .map((operation) => [operation.applicationId, operation]),
  );
  const expanded: ApplicantIdentityMigrationSnapshot = {
    ...legacy,
    applicantUserIds: ["applicant-1"],
    bindings: [
      {
        id: "legacy:45fc50a156614081a82198fb26502",
        userId: "applicant-1",
        canonicalNpsn: "20100001",
      },
    ],
    applications: legacy.applications.map((application) => ({
      ...application,
      ...assignments.get(application.id),
    })),
  };

  assert.deepEqual(planApplicantOwnershipBackfill(expanded, mappings), {
    ok: true,
    operations: [],
  });
});

test("backfill rejects incomplete, conflicting, or invalid explicit mappings", () => {
  const snapshot: ApplicantIdentityMigrationSnapshot = {
    ...cleanSnapshot,
    users: [{ id: "user-1", tenantId: null, tenantRole: null }],
    providerAdminUserIds: [],
    applicantUserIds: [],
    bindings: [],
    tenants: [],
    activations: [],
    applications: [
      {
        id: "application-1",
        npsn: "20100001",
        status: "pending",
        ownerUserId: null,
        bindingId: null,
        attemptNumber: null,
        idempotencyKey: null,
        payloadHash: null,
        approvedTenantId: null,
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
  };

  assert.deepEqual(planApplicantOwnershipBackfill(snapshot, []), {
    ok: false,
    errors: [{ code: "missing-explicit-mapping", identifier: "application-1" }],
  });
  assert.deepEqual(
    planApplicantOwnershipBackfill(snapshot, [
      { applicationId: "application-1", ownerUserId: "missing-user" },
    ]),
    { ok: false, errors: [{ code: "unknown-owner", identifier: "missing-user" }] },
  );

  assert.deepEqual(
    planApplicantOwnershipBackfill(
      {
        ...snapshot,
        users: [
          ...snapshot.users,
          { id: "user-2", tenantId: null, tenantRole: null },
        ],
        bindings: [
          { id: "binding-2", userId: "user-2", canonicalNpsn: "20100001" },
        ],
      },
      [{ applicationId: "application-1", ownerUserId: "user-1" }],
    ),
    {
      ok: false,
      errors: [
        { code: "conflicting-existing-ownership", identifier: "20100001" },
      ],
    },
  );
});
