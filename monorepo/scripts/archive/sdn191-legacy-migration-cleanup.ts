// Pure helpers for the SDN 191 legacy-migration role cleanup.
//
// The global legacy-non-admin backfill that ran during a crashed worker session
// left legacy-migration roles "Guru (Migrasi)" / "Siswa (Migrasi)" (plus their
// assignments and permission rows) inside the SDN 191 tenant. This feature
// removes exactly those leftovers so the tenant ends up with exactly the two
// scratch roles (guru, siswa) and the two active assignments provisioned by
// `scripts/provision-sdn-191.ts` (VAL-DATA-006 / VAL-DATA-007).
//
// These functions have no I/O so they can be unit-tested in isolation. The
// cleanup script (`scripts/cleanup-sdn191-legacy-migration-roles.ts`) feeds
// them rows read from the dev DB.

export const SDN191_TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
export const SDN191_DOMAIN = "uptd-sdn-191-inpres-batunapara";
export const SDN191_GURU_USER_ID = "sdn19100-0000-4000-8000-000000000011";
export const SDN191_SISWA_USER_ID = "sdn19100-0000-4000-8000-000000000012";

export type Sdn191RoleRow = Readonly<{
  id: string;
  tenantId: string;
  name: string;
  normalizedName: string;
  origin: string;
}>;

export type Sdn191AssignmentRow = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  state: string;
  suspendedAt: string | null;
}>;

export type LegacyMigrationCleanupPlan = Readonly<{
  tenantId: string;
  legacyRoleIds: readonly string[];
  legacyAssignmentIds: readonly string[];
  hasLegacyRoles: boolean;
}>;

/**
 * Select the rows that are leftovers from the legacy backfill: roles with
 * `origin = 'legacy-migration'` inside the given tenant. Strictly scoped to
 * `tenantId`; rows of any other tenant (including legacy-migration roles that
 * legitimately belong elsewhere) are never selected.
 */
export function selectLegacyMigrationRoles(
  roles: readonly Pick<Sdn191RoleRow, "id" | "tenantId" | "origin">[],
  tenantId: string = SDN191_TENANT_ID,
): readonly string[] {
  return roles
    .filter((role) => role.tenantId === tenantId && role.origin === "legacy-migration")
    .map((role) => role.id);
}

/**
 * Build the deletion plan for the SDN 191 cleanup: the legacy-migration role ids
 * plus the ids of every assignment inside the tenant that references one of
 * those roles. Never includes scratch roles, other tenants, or assignments of
 * the scratch guru/siswa roles.
 */
export function buildLegacyMigrationCleanupPlan(
  roles: readonly Pick<Sdn191RoleRow, "id" | "tenantId" | "origin">[],
  assignments: readonly Pick<Sdn191AssignmentRow, "id" | "tenantId" | "roleId">[],
  tenantId: string = SDN191_TENANT_ID,
): LegacyMigrationCleanupPlan {
  const legacyRoleIds = selectLegacyMigrationRoles(roles, tenantId);
  const legacyRoleSet = new Set(legacyRoleIds);
  const legacyAssignmentIds = assignments
    .filter((assignment) => assignment.tenantId === tenantId && legacyRoleSet.has(assignment.roleId))
    .map((assignment) => assignment.id);
  return {
    tenantId,
    legacyRoleIds,
    legacyAssignmentIds,
    hasLegacyRoles: legacyRoleIds.length > 0,
  };
}

export type Sdn191PostCleanupIssue = Readonly<{
  code:
    | "role-count"
    | "legacy-role-remaining"
    | "role-not-scratch"
    | "assignment-count"
    | "assignment-not-active"
    | "assignment-mapping"
    | "cross-tenant-row";
  detail?: string;
}>;

/**
 * Validate the final SDN 191 RBAC state expected by VAL-DATA-006 / VAL-DATA-007:
 * exactly two roles (guru, siswa — origin scratch) and exactly two active
 * assignments (guru user → guru role, siswa user → siswa role), all rows scoped
 * to SDN 191 and no legacy-migration role remaining.
 */
export function validateSdn191PostCleanupState(
  roles: readonly Sdn191RoleRow[],
  assignments: readonly Sdn191AssignmentRow[],
  tenantId: string = SDN191_TENANT_ID,
): Sdn191PostCleanupIssue[] {
  const issues: Sdn191PostCleanupIssue[] = [];
  const tenantRoles = roles.filter((role) => role.tenantId === tenantId);
  if (tenantRoles.length !== 2) {
    issues.push({ code: "role-count", detail: `expected 2 SDN 191 roles, found ${tenantRoles.length}` });
  }
  for (const role of tenantRoles) {
    if (role.origin === "legacy-migration") issues.push({ code: "legacy-role-remaining", detail: role.normalizedName });
    if (role.origin !== "scratch") issues.push({ code: "role-not-scratch", detail: role.normalizedName });
  }

  const tenantAssignments = assignments.filter((assignment) => assignment.tenantId === tenantId);
  if (tenantAssignments.length !== 2) {
    issues.push({ code: "assignment-count", detail: `expected 2 SDN 191 assignments, found ${tenantAssignments.length}` });
  }
  const roleByNormalizedName = new Map(tenantRoles.map((role) => [role.normalizedName, role.id]));
  const expected: Readonly<Array<{ userId: string; roleName: string }>> = [
    { userId: SDN191_GURU_USER_ID, roleName: "guru" },
    { userId: SDN191_SISWA_USER_ID, roleName: "siswa" },
  ];
  for (const assignment of tenantAssignments) {
    if (assignment.state !== "active" || assignment.suspendedAt !== null) {
      issues.push({ code: "assignment-not-active", detail: assignment.id });
    }
    const match = expected.find((item) => item.userId === assignment.userId && roleByNormalizedName.get(item.roleName) === assignment.roleId);
    if (!match) issues.push({ code: "assignment-mapping", detail: `${assignment.userId} -> ${assignment.roleId}` });
  }

  for (const row of [...roles, ...assignments]) {
    if (row.tenantId !== tenantId) issues.push({ code: "cross-tenant-row", detail: row.id });
  }
  return issues;
}
