import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SDN191_GURU_USER_ID,
  SDN191_SISWA_USER_ID,
  SDN191_TENANT_ID,
  buildLegacyMigrationCleanupPlan,
  validateSdn191PostCleanupState,
  type Sdn191AssignmentRow,
  type Sdn191RoleRow,
} from "./sdn191-legacy-migration-cleanup";

const SCRATCH_GURU_ID = "sdn19100-0000-4000-8000-000000000041";
const SCRATCH_SISWA_ID = "sdn19100-0000-4000-8000-000000000042";
const LEGACY_GURU_ID = "5007c7c4-ff7d-4d8a-b0dd-95d56cc32b41";
const LEGACY_SISWA_ID = "c01fa3f1-37af-45f6-bb35-bbf43fe93d5c";
const OTHER_TENANT_ID = "99999999-0000-4000-8000-000000000099";

function role(
  id: string,
  tenantId: string,
  normalizedName: string,
  origin: string,
): Sdn191RoleRow {
  return { id, tenantId, name: normalizedName, normalizedName, origin };
}

function assignment(
  id: string,
  tenantId: string,
  userId: string,
  roleId: string,
  state: string,
  suspendedAt: string | null = null,
): Sdn191AssignmentRow {
  return { id, tenantId, userId, roleId, state, suspendedAt };
}

function sdn191RoleFixture() {
  return [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(LEGACY_GURU_ID, SDN191_TENANT_ID, "guru (migrasi)", "legacy-migration"),
    role(SCRATCH_SISWA_ID, SDN191_TENANT_ID, "siswa", "scratch"),
    role(LEGACY_SISWA_ID, SDN191_TENANT_ID, "siswa (migrasi)", "legacy-migration"),
  ];
}

function sdn191AssignmentFixture() {
  return [
    assignment("legacy-guru-assignment", SDN191_TENANT_ID, SDN191_GURU_USER_ID, LEGACY_GURU_ID, "active"),
    assignment("legacy-siswa-assignment", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, LEGACY_SISWA_ID, "active"),
    assignment("scratch-guru-assignment", SDN191_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_GURU_ID, "active"),
    assignment("scratch-siswa-assignment", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, SCRATCH_SISWA_ID, "active"),
  ];
}

test("plan selects only SDN 191 legacy-migration roles (never other tenants)", () => {
  const roles = [
    ...sdn191RoleFixture(),
    role("other-tenant-legacy", OTHER_TENANT_ID, "guru (migrasi)", "legacy-migration"),
  ];
  const plan = buildLegacyMigrationCleanupPlan(roles, [], SDN191_TENANT_ID);
  assert.equal(plan.hasLegacyRoles, true);
  assert.deepEqual([...plan.legacyRoleIds].sort(), [LEGACY_GURU_ID, LEGACY_SISWA_ID].sort());
});

test("plan never includes the scratch guru/siswa roles or school-admin data", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(LEGACY_GURU_ID, SDN191_TENANT_ID, "guru (migrasi)", "legacy-migration"),
  ];
  const plan = buildLegacyMigrationCleanupPlan(roles, [], SDN191_TENANT_ID);
  assert.deepEqual(plan.legacyRoleIds, [LEGACY_GURU_ID]);
  assert.ok(!plan.legacyRoleIds.includes(SCRATCH_GURU_ID), "scratch guru must survive");
});

test("plan gathers assignments only for the legacy roles inside SDN 191", () => {
  const assignments = [
    ...sdn191AssignmentFixture(),
    assignment("other-tenant-assignment", OTHER_TENANT_ID, "u-other", "other-role", "active"),
  ];
  const plan = buildLegacyMigrationCleanupPlan(sdn191RoleFixture(), assignments, SDN191_TENANT_ID);
  assert.deepEqual(
    [...plan.legacyAssignmentIds].sort(),
    ["legacy-guru-assignment", "legacy-siswa-assignment"].sort(),
  );
});

test("plan is a no-op when no legacy-migration roles remain", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(SCRATCH_SISWA_ID, SDN191_TENANT_ID, "siswa", "scratch"),
  ];
  const plan = buildLegacyMigrationCleanupPlan(roles, [], SDN191_TENANT_ID);
  assert.equal(plan.hasLegacyRoles, false);
  assert.deepEqual(plan.legacyRoleIds, []);
  assert.deepEqual(plan.legacyAssignmentIds, []);
});

test("post-cleanup state with exactly 2 scratch roles + 2 active assignments passes", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(SCRATCH_SISWA_ID, SDN191_TENANT_ID, "siswa", "scratch"),
  ];
  const assignments = sdn191AssignmentFixture().filter((item) => item.roleId === SCRATCH_GURU_ID || item.roleId === SCRATCH_SISWA_ID);
  assert.deepEqual(validateSdn191PostCleanupState(roles, assignments, SDN191_TENANT_ID), []);
});

test("post-cleanup state rejects a remaining legacy-migration role", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(LEGACY_GURU_ID, SDN191_TENANT_ID, "guru (migrasi)", "legacy-migration"),
  ];
  const assignments = [
    assignment("a1", SDN191_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_GURU_ID, "active"),
  ];
  const issues = validateSdn191PostCleanupState(roles, assignments, SDN191_TENANT_ID);
  assert.ok(issues.some((issue) => issue.code === "legacy-role-remaining"));
});

test("post-cleanup state rejects a non-scratch role", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role("copied-siswa", SDN191_TENANT_ID, "siswa", "copy"),
  ];
  const assignments = [
    assignment("a1", SDN191_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_GURU_ID, "active"),
    assignment("a2", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, "copied-siswa", "active"),
  ];
  const issues = validateSdn191PostCleanupState(roles, assignments, SDN191_TENANT_ID);
  assert.ok(issues.some((issue) => issue.code === "role-not-scratch"));
});

test("post-cleanup state rejects wrong role count", () => {
  const roles = [role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch")];
  const issues = validateSdn191PostCleanupState(roles, [], SDN191_TENANT_ID);
  assert.ok(issues.some((issue) => issue.code === "role-count"));
});

test("post-cleanup state rejects an inactive or mismapped assignment", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(SCRATCH_SISWA_ID, SDN191_TENANT_ID, "siswa", "scratch"),
  ];
  const suspended = validateSdn191PostCleanupState(roles, [
    assignment("a1", SDN191_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_GURU_ID, "suspended", "2026-08-01T00:00:00.000Z"),
    assignment("a2", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, SCRATCH_SISWA_ID, "active"),
  ], SDN191_TENANT_ID);
  assert.ok(suspended.some((issue) => issue.code === "assignment-not-active"));

  const mismapped = validateSdn191PostCleanupState(roles, [
    assignment("a1", SDN191_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_SISWA_ID, "active"),
    assignment("a2", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, SCRATCH_GURU_ID, "active"),
  ], SDN191_TENANT_ID);
  assert.ok(mismapped.some((issue) => issue.code === "assignment-mapping"));
});

test("post-cleanup state rejects cross-tenant rows", () => {
  const roles = [
    role(SCRATCH_GURU_ID, SDN191_TENANT_ID, "guru", "scratch"),
    role(SCRATCH_SISWA_ID, SDN191_TENANT_ID, "siswa", "scratch"),
  ];
  const assignments = [
    assignment("a1", OTHER_TENANT_ID, SDN191_GURU_USER_ID, SCRATCH_GURU_ID, "active"),
    assignment("a2", SDN191_TENANT_ID, SDN191_SISWA_USER_ID, SCRATCH_SISWA_ID, "active"),
  ];
  const issues = validateSdn191PostCleanupState(roles, assignments, SDN191_TENANT_ID);
  assert.ok(issues.some((issue) => issue.code === "cross-tenant-row"));
});
