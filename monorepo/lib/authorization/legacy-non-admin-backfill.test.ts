import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
  computeLegacyEquivalence,
  defaultFrozenByRole,
  expandLegacyOperationTuples,
  frozenPermissionSet,
  legacyBackfillContractDigest,
  legacyMigrationRoleName,
  normalizeRoleName,
  planLegacyNonAdminBackfill,
  type LegacyBackfillExistingAssignment,
  type LegacyBackfillExistingRole,
  type LegacyBackfillPlan,
  type LegacyBackfillSnapshot,
} from "@/lib/authorization/legacy-non-admin-backfill";
import { LEGACY_NON_ADMIN_ROLES } from "@/lib/authorization/tenant-rbac-contract";

const FROZEN = ["tenant.dashboard.view", "tenant.users.view", "tenant.users.view-contact", "tenant.users.view-sensitive"];

function role(overrides: Partial<LegacyBackfillExistingRole>): LegacyBackfillExistingRole {
  return {
    roleId: "role-1",
    tenantId: "tenant-a",
    legacyRole: null,
    origin: "scratch",
    lifecycle: "draft",
    normalizedName: "name",
    migrationRunId: null,
    migrationVersion: null,
    migrationVerification: null,
    permissionKeys: [],
    ...overrides,
  };
}

function assignment(overrides: Partial<LegacyBackfillExistingAssignment>): LegacyBackfillExistingAssignment {
  return {
    assignmentId: "assignment-1",
    roleId: "role-1",
    tenantId: "tenant-a",
    userId: "user-1",
    state: "active",
    ...overrides,
  };
}

function snapshot(overrides: Partial<LegacyBackfillSnapshot>): LegacyBackfillSnapshot {
  return {
    userId: "user-1",
    tenantId: "tenant-a",
    legacyRole: "guru",
    tenantExists: true,
    providerAdmin: false,
    applicant: false,
    existingRoles: [],
    existingAssignments: [],
    ...overrides,
  };
}

function assertFinding(plan: LegacyBackfillPlan, code: string, userId = "user-1", tenantId: string | null = "tenant-a"): void {
  assert.deepEqual(plan, { kind: "finding", code, tenantId, userId });
}

test("every recognized legacy non-admin role maps to exactly the frozen permission set and nothing else", () => {
  assert.deepEqual([...LEGACY_NON_ADMIN_ROLES].sort(), ["guest", "guru", "pimpinan", "siswa", "staff"]);
  for (const roleName of LEGACY_NON_ADMIN_ROLES) {
    assert.deepEqual(frozenPermissionSet(roleName), FROZEN, roleName);
  }
  assert.deepEqual(frozenPermissionSet("school-admin"), []);
  assert.deepEqual(frozenPermissionSet("future-role"), []);
});

test("frozen display names are stable and normalize deterministically", () => {
  assert.equal(legacyMigrationRoleName("guru"), "Guru (Migrasi)");
  assert.equal(legacyMigrationRoleName("guest"), "Tamu (Migrasi)");
  assert.equal(normalizeRoleName("  Guru   (Migrasi)  "), "guru (migrasi)");
  assert.equal(normalizeRoleName(legacyMigrationRoleName("pimpinan")), "pimpinan (migrasi)");
});

test("plan creates a frozen role for a recognized role with no existing migration role", () => {
  const plan = planLegacyNonAdminBackfill(snapshot({}));
  assert.deepEqual(plan, {
    kind: "backfill-role",
    tenantId: "tenant-a",
    userId: "user-1",
    legacyRole: "guru",
    roleName: "Guru (Migrasi)",
    normalizedName: "guru (migrasi)",
    permissionKeys: FROZEN,
  });
});

test("plan assigns an existing valid frozen role and reports unchanged for an active assignment", () => {
  const existingRole = role({
    roleId: "role-guru",
    legacyRole: "guru",
    origin: "legacy-migration",
    lifecycle: "active",
    normalizedName: "guru (migrasi)",
    migrationRunId: "run-1",
    migrationVersion: "tenant-permissions@1",
    migrationVerification: "pending",
    permissionKeys: FROZEN,
  });
  const noAssignment = planLegacyNonAdminBackfill(snapshot({ existingRoles: [existingRole] }));
  assert.deepEqual(noAssignment, {
    kind: "assign-existing",
    tenantId: "tenant-a",
    userId: "user-1",
    legacyRole: "guru",
    roleId: "role-guru",
  });
  const active = planLegacyNonAdminBackfill(
    snapshot({
      existingRoles: [existingRole],
      existingAssignments: [assignment({ roleId: "role-guru", state: "active" })],
    }),
  );
  assert.deepEqual(active, {
    kind: "unchanged",
    tenantId: "tenant-a",
    userId: "user-1",
    legacyRole: "guru",
    roleId: "role-guru",
  });
});

test("plan never uses a Template Role Tenant or profile provenance as an authority source", () => {
  const templateRole = role({
    roleId: "role-template",
    legacyRole: null,
    origin: "template",
    lifecycle: "active",
    normalizedName: "guru (migrasi)",
    permissionKeys: FROZEN,
  });
  assertFinding(planLegacyNonAdminBackfill(snapshot({ existingRoles: [templateRole] })), "legacy-backfill-role-conflict");
});

test("plan fails closed on conflicting, malformed, and foreign-origin frozen roles", () => {
  const duplicate = [
    role({ roleId: "a", legacyRole: "guru", origin: "legacy-migration", lifecycle: "active", normalizedName: "guru (migrasi)", migrationRunId: "r", migrationVersion: "v", migrationVerification: "pending", permissionKeys: FROZEN }),
    role({ roleId: "b", legacyRole: "guru", origin: "legacy-migration", lifecycle: "active", normalizedName: "guru (migrasi)", migrationRunId: "r", migrationVersion: "v", migrationVerification: "pending", permissionKeys: FROZEN }),
  ];
  assertFinding(planLegacyNonAdminBackfill(snapshot({ existingRoles: duplicate })), "legacy-backfill-role-conflict");

  const wrongPermissions = role({
    roleId: "role-wrong",
    legacyRole: "guru",
    origin: "legacy-migration",
    lifecycle: "active",
    normalizedName: "guru (migrasi)",
    migrationRunId: "r",
    migrationVersion: "v",
    migrationVerification: "pending",
    permissionKeys: ["tenant.dashboard.view", "school-profile.profile.view"],
  });
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ existingRoles: [wrongPermissions] })),
    "legacy-backfill-role-conflict",
  );

  const missingProvenance = role({
    roleId: "role-provenance",
    legacyRole: "guru",
    origin: "legacy-migration",
    lifecycle: "active",
    normalizedName: "guru (migrasi)",
    migrationRunId: null,
    migrationVersion: null,
    migrationVerification: null,
    permissionKeys: FROZEN,
  });
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ existingRoles: [missingProvenance] })),
    "legacy-backfill-role-conflict",
  );

  const suspended = role({
    roleId: "role-suspended",
    legacyRole: "guru",
    origin: "legacy-migration",
    lifecycle: "active",
    normalizedName: "guru (migrasi)",
    migrationRunId: "r",
    migrationVersion: "v",
    migrationVerification: "pending",
    permissionKeys: FROZEN,
  });
  assertFinding(
    planLegacyNonAdminBackfill(
      snapshot({
        existingRoles: [suspended],
        existingAssignments: [assignment({ roleId: "role-suspended", state: "suspended" })],
      }),
    ),
    "legacy-backfill-assignment-conflict",
  );
});

test("plan fails closed on null, unknown, identity, tenant-missing, and cross-Tenant states", () => {
  assertFinding(planLegacyNonAdminBackfill(snapshot({ legacyRole: null })), "legacy-backfill-role-null");
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ legacyRole: "future-role" })),
    "legacy-backfill-role-unknown",
  );
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ providerAdmin: true })),
    "legacy-backfill-identity-conflict",
  );
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ applicant: true })),
    "legacy-backfill-identity-conflict",
  );
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ tenantId: null })),
    "legacy-backfill-tenant-missing",
    "user-1",
    null,
  );
  assertFinding(
    planLegacyNonAdminBackfill(snapshot({ tenantExists: false })),
    "legacy-backfill-tenant-missing",
  );
  assertFinding(
    planLegacyNonAdminBackfill(
      snapshot({ existingAssignments: [assignment({ tenantId: "tenant-b" })] }),
    ),
    "legacy-backfill-cross-tenant",
  );
});

test("plan skips school-admin and unattached accounts without granting or finding", () => {
  assert.deepEqual(planLegacyNonAdminBackfill(snapshot({ legacyRole: "school-admin" })), { kind: "not-non-admin" });
  assert.deepEqual(
    planLegacyNonAdminBackfill(snapshot({ legacyRole: null, tenantId: null })),
    { kind: "no-legacy-role" },
  );
});

test("the equivalence matrix proves zero legacy deny / RBAC allow outcomes", () => {
  const result = computeLegacyEquivalence(defaultFrozenByRole());
  assert.equal(result.equivalent, true);
  assert.deepEqual(result.widened, []);
  assert.deepEqual(result.narrowed, []);
  assert.ok(result.tuples.length > 0);
  assert.match(result.contractDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.registryVersion, "tenant-permissions@2");
  assert.equal(result.operationMapVersion, "tenant-operations@2");
  const byRole = new Map(
    [...LEGACY_NON_ADMIN_ROLES].sort().map((roleName) => [roleName, result.tuples.filter((tuple) => tuple.legacyAllowed)]),
  );
  assert.ok(byRole.size === 5);
});

test("the frozen contract digest is deterministic and covers every legacy operation tuple", () => {
  const first = legacyBackfillContractDigest();
  const second = legacyBackfillContractDigest();
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.ok(expandLegacyOperationTuples().length > 0);
  assert.equal(LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY, "legacy-non-admin-backfill-v1");
});
