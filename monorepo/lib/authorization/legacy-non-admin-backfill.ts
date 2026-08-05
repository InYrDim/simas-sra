import { createHash } from "node:crypto";

import { canonicalJson } from "@/lib/authorization/security-command";
import {
  LEGACY_NON_ADMIN_ROLES,
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  resolveActivePermission,
  resolveLegacyPermissionKeys,
  tenantOperationMap,
  type TenantOperationDefinition,
} from "@/lib/authorization/tenant-rbac-contract";

export { LEGACY_NON_ADMIN_ROLES, resolveLegacyPermissionKeys } from "@/lib/authorization/tenant-rbac-contract";

export const LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY = "legacy-non-admin-backfill-v1";
export const LEGACY_NON_ADMIN_BACKFILL_SERVICE = "legacy-non-admin-backfill";

export type LegacyBackfillFindingCode =
  | "legacy-backfill-role-unknown"
  | "legacy-backfill-role-null"
  | "legacy-backfill-tenant-missing"
  | "legacy-backfill-identity-conflict"
  | "legacy-backfill-cross-tenant"
  | "legacy-backfill-role-conflict"
  | "legacy-backfill-assignment-conflict";

const LEGACY_ROLE_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  pimpinan: "Pimpinan (Migrasi)",
  staff: "Staf (Migrasi)",
  guru: "Guru (Migrasi)",
  siswa: "Siswa (Migrasi)",
  guest: "Tamu (Migrasi)",
});

/** Stable display name for the frozen migration role of a legacy role kind. */
export function legacyMigrationRoleName(legacyRole: string): string {
  return LEGACY_ROLE_DISPLAY_NAMES[legacyRole] ?? `Legacy ${legacyRole} (Migrasi)`;
}

/** Deterministic role-name normalization used for per-Tenant uniqueness. */
export function normalizeRoleName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

/**
 * The exact frozen permission set approved by the operation contract for a
 * recognized legacy non-admin role. Every other permission is denied.
 */
export function frozenPermissionSet(legacyRole: string): readonly string[] {
  return resolveLegacyPermissionKeys(legacyRole);
}

export type LegacyBackfillExistingRole = Readonly<{
  roleId: string;
  tenantId: string;
  legacyRole: string | null;
  origin: string;
  lifecycle: string;
  normalizedName: string;
  migrationRunId: string | null;
  migrationVersion: string | null;
  migrationVerification: string | null;
  permissionKeys: readonly string[];
}>;

export type LegacyBackfillExistingAssignment = Readonly<{
  assignmentId: string;
  roleId: string;
  tenantId: string;
  userId: string;
  state: string;
}>;

export type LegacyBackfillSnapshot = Readonly<{
  userId: string;
  tenantId: string | null;
  legacyRole: string | null;
  tenantExists: boolean;
  providerAdmin: boolean;
  applicant: boolean;
  existingRoles: readonly LegacyBackfillExistingRole[];
  existingAssignments: readonly LegacyBackfillExistingAssignment[];
}>;

export type LegacyBackfillPlan =
  | Readonly<{
      kind: "backfill-role";
      tenantId: string;
      userId: string;
      legacyRole: string;
      roleName: string;
      normalizedName: string;
      permissionKeys: readonly string[];
    }>
  | Readonly<{ kind: "assign-existing"; tenantId: string; userId: string; legacyRole: string; roleId: string }>
  | Readonly<{ kind: "unchanged"; tenantId: string; userId: string; legacyRole: string; roleId: string }>
  | Readonly<{ kind: "not-non-admin" }>
  | Readonly<{ kind: "no-legacy-role" }>
  | Readonly<{ kind: "finding"; code: LegacyBackfillFindingCode; tenantId: string | null; userId: string }>;

function finding(snapshot: LegacyBackfillSnapshot, code: LegacyBackfillFindingCode, tenantId: string | null): LegacyBackfillPlan {
  return { kind: "finding", code, tenantId, userId: snapshot.userId };
}

/**
 * Plans only the frozen equivalence for recognized singular legacy non-admin
 * roles. It never guesses through null, unknown, conflicting, malformed, or
 * cross-Tenant state, and never uses profile names or Template Role Tenant
 * provenance as an authority source.
 */
export function planLegacyNonAdminBackfill(snapshot: LegacyBackfillSnapshot): LegacyBackfillPlan {
  const { userId, legacyRole } = snapshot;

  if (!legacyRole) {
    if (!snapshot.tenantId) return { kind: "no-legacy-role" };
    if (!snapshot.tenantExists) return finding(snapshot, "legacy-backfill-tenant-missing", null);
    return finding(snapshot, "legacy-backfill-role-null", snapshot.tenantId);
  }
  if (legacyRole === "school-admin") return { kind: "not-non-admin" };
  if (!(LEGACY_NON_ADMIN_ROLES as readonly string[]).includes(legacyRole)) {
    return finding(snapshot, "legacy-backfill-role-unknown", snapshot.tenantId);
  }
  if (snapshot.providerAdmin || snapshot.applicant) {
    return finding(snapshot, "legacy-backfill-identity-conflict", snapshot.tenantId);
  }
  if (!snapshot.tenantId || !snapshot.tenantExists) {
    return finding(snapshot, "legacy-backfill-tenant-missing", snapshot.tenantId);
  }
  if (snapshot.existingAssignments.some((assignment) => assignment.tenantId !== snapshot.tenantId)) {
    return finding(snapshot, "legacy-backfill-cross-tenant", snapshot.tenantId);
  }

  const frozenName = normalizeRoleName(legacyMigrationRoleName(legacyRole));
  const nameCollision = snapshot.existingRoles.find(
    (role) => role.normalizedName === frozenName && role.origin !== "legacy-migration",
  );
  if (nameCollision) return finding(snapshot, "legacy-backfill-role-conflict", snapshot.tenantId);

  const candidates = snapshot.existingRoles.filter(
    (role) => role.legacyRole === legacyRole && role.origin === "legacy-migration",
  );
  const sameLegacyRoleForeignOrigin = snapshot.existingRoles.find(
    (role) => role.legacyRole === legacyRole && role.origin !== "legacy-migration",
  );
  if (candidates.length === 0) {
    if (sameLegacyRoleForeignOrigin) return finding(snapshot, "legacy-backfill-role-conflict", snapshot.tenantId);
    return {
      kind: "backfill-role",
      tenantId: snapshot.tenantId,
      userId,
      legacyRole,
      roleName: legacyMigrationRoleName(legacyRole),
      normalizedName: frozenName,
      permissionKeys: resolveLegacyPermissionKeys(legacyRole),
    };
  }
  if (candidates.length > 1) return finding(snapshot, "legacy-backfill-role-conflict", snapshot.tenantId);

  const role = candidates[0]!;
  const frozen = resolveLegacyPermissionKeys(legacyRole);
  const permissionsMatch =
    role.permissionKeys.length === frozen.length && frozen.every((key) => role.permissionKeys.includes(key));
  if (
    role.lifecycle !== "active" ||
    !permissionsMatch ||
    role.migrationRunId === null ||
    role.migrationVersion === null ||
    role.migrationVerification === null
  ) {
    return finding(snapshot, "legacy-backfill-role-conflict", snapshot.tenantId);
  }

  const assignment = snapshot.existingAssignments.find((candidateAssignment) => candidateAssignment.roleId === role.roleId);
  if (assignment) {
    return assignment.state === "active"
      ? { kind: "unchanged", tenantId: snapshot.tenantId, userId, legacyRole, roleId: role.roleId }
      : finding(snapshot, "legacy-backfill-assignment-conflict", snapshot.tenantId);
  }
  return { kind: "assign-existing", tenantId: snapshot.tenantId, userId, legacyRole, roleId: role.roleId };
}

export type LegacyEquivalenceTuple = Readonly<{
  operationId: string;
  requested: readonly string[];
  legacyAllowed: boolean;
  rbacAllowed: boolean;
}>;

export function expandLegacyOperationTuples(): readonly {
  operationId: string;
  requested: readonly string[];
  legacyAllowed: boolean;
}[] {
  const tuples: { operationId: string; requested: readonly string[]; legacyAllowed: boolean }[] = [];
  for (const operation of tenantOperationMap) {
    if (operation.lifecycle !== "active") continue;
    // Mirrors legacyRoleAllows: placeholders are legacy-visible to every
    // recognized Tenant role, and tenantRole-marked operations cover the rest.
    const legacyAllowed =
      operation.classification === "placeholder" || operation.legacyAuthority.includes("tenantRole");
    if (operation.permissionMode === "conditional") {
      for (const key of operation.requiredPermissions) {
        tuples.push({ operationId: operation.id, requested: [key], legacyAllowed });
      }
    } else {
      tuples.push({
        operationId: operation.id,
        requested: [...operation.requiredPermissions],
        legacyAllowed,
      });
    }
  }
  return tuples.sort(
    (left, right) =>
      left.operationId.localeCompare(right.operationId) ||
      left.requested.join(",").localeCompare(right.requested.join(",")),
  );
}

/**
 * Mirrors the centralized evaluator's permission-level RBAC decision for one
 * concrete requested permission list against a frozen effective set. Contextual
 * gates that require assigned context or School Admin are not satisfiable by a
 * frozen non-admin role. Self context is treated as satisfied because each
 * equivalence tuple models the same-user path proven by the live evaluator.
 */
export function rbacAllowsForFrozenPermissions(
  operation: TenantOperationDefinition,
  requested: readonly string[],
  effective: ReadonlySet<string>,
): boolean {
  if (operation.permissionMode === "conditional" && requested.length === 0) return false;
  if (requested.some((key) => !resolveActivePermission(key))) return false;
  const has = operation.permissionMode === "any"
    ? requested.some((key) => effective.has(key))
    : requested.every((key) => effective.has(key));
  if (!has) return false;
  if (operation.contextualPolicy === "school-admin-only") return false;
  if (
    operation.contextualPolicy !== "tenant-wide"
    && operation.contextualPolicy !== "none"
    && operation.contextualPolicy !== "self"
  ) return false;
  return true;
}

export type LegacyEquivalenceResult = Readonly<{
  contractDigest: string;
  registryVersion: string;
  operationMapVersion: string;
  roles: readonly string[];
  tuples: readonly LegacyEquivalenceTuple[];
  widened: readonly LegacyEquivalenceTuple[];
  narrowed: readonly LegacyEquivalenceTuple[];
  equivalent: boolean;
}>;

/** Proves that each frozen set is exactly equivalent to legacy non-admin authority for every expanded operation tuple. */
export function computeLegacyEquivalence(
  frozenByRole: Readonly<Record<string, readonly string[]>>,
): LegacyEquivalenceResult {
  const roles = [...LEGACY_NON_ADMIN_ROLES].sort();
  const byOperation = new Map(tenantOperationMap.map((operation) => [operation.id, operation]));
  const tuples: LegacyEquivalenceTuple[] = [];
  const widened: LegacyEquivalenceTuple[] = [];
  const narrowed: LegacyEquivalenceTuple[] = [];

  for (const role of roles) {
    const effective = new Set(frozenByRole[role] ?? []);
    for (const tuple of expandLegacyOperationTuples()) {
      const operation = byOperation.get(tuple.operationId);
      if (!operation) continue;
      const rbacAllowed = rbacAllowsForFrozenPermissions(operation, tuple.requested, effective);
      const entry: LegacyEquivalenceTuple = {
        operationId: tuple.operationId,
        requested: tuple.requested,
        legacyAllowed: tuple.legacyAllowed,
        rbacAllowed,
      };
      tuples.push(entry);
      if (!tuple.legacyAllowed && rbacAllowed) widened.push(entry);
      if (tuple.legacyAllowed && !rbacAllowed) narrowed.push(entry);
    }
  }

  const contractDigest = sha256(
    canonicalJson({
      migrationKey: LEGACY_NON_ADMIN_BACKFILL_MIGRATION_KEY,
      registryVersion: PERMISSION_REGISTRY_VERSION,
      operationMapVersion: OPERATION_MAP_VERSION,
      frozenByRole: Object.fromEntries(roles.map((role) => [role, [...(frozenByRole[role] ?? [])].sort()])),
      tuples: tuples.map((tuple) => ({
        operationId: tuple.operationId,
        requested: tuple.requested,
        legacyAllowed: tuple.legacyAllowed,
        rbacAllowed: tuple.rbacAllowed,
      })),
    }),
  );

  return {
    contractDigest,
    registryVersion: PERMISSION_REGISTRY_VERSION,
    operationMapVersion: OPERATION_MAP_VERSION,
    roles,
    tuples,
    widened,
    narrowed,
    equivalent: widened.length === 0 && narrowed.length === 0,
  };
}

export function defaultFrozenByRole(): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    LEGACY_NON_ADMIN_ROLES.map((role) => [role, resolveLegacyPermissionKeys(role)]),
  );
}

export function legacyBackfillContractDigest(): string {
  return computeLegacyEquivalence(defaultFrozenByRole()).contractDigest;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
