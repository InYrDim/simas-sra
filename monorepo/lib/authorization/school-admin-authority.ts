export const SCHOOL_ADMIN_PROJECTION_MIGRATION_KEY = "school-admin-compatibility-v1";

export type SchoolAdminAuthorityRow = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  authorityState: string;
}>;

export type SchoolAdminCompatibilitySnapshot = Readonly<{
  userId: string;
  tenantId: string | null;
  legacyRole: string | null;
  tenantExists: boolean;
  providerAdmin: boolean;
  applicant: boolean;
  authorities: readonly SchoolAdminAuthorityRow[];
}>;

export type SchoolAdminProjectionFindingCode =
  | "school-admin-tenant-missing"
  | "school-admin-identity-conflict"
  | "school-admin-authority-cross-tenant"
  | "school-admin-authority-duplicate"
  | "school-admin-authority-malformed"
  | "school-admin-projection-conflict";

export type SchoolAdminProjectionPlan =
  | Readonly<{ kind: "project"; tenantId: string; userId: string }>
  | Readonly<{ kind: "unchanged"; authorityId: string; tenantId: string; userId: string }>
  | Readonly<{ kind: "not-school-admin" }>
  | Readonly<{ kind: "finding"; code: SchoolAdminProjectionFindingCode; tenantId: string | null; userId: string }>;

function finding(
  snapshot: SchoolAdminCompatibilitySnapshot,
  code: SchoolAdminProjectionFindingCode,
): SchoolAdminProjectionPlan {
  return { kind: "finding", code, tenantId: snapshot.tenantId, userId: snapshot.userId };
}

/**
 * Plans only the compatibility projection. It never guesses through malformed,
 * conflicting, duplicate, or cross-Tenant state.
 */
export function planSchoolAdminCompatibilityProjection(
  snapshot: SchoolAdminCompatibilitySnapshot,
): SchoolAdminProjectionPlan {
  if (snapshot.legacyRole !== "school-admin") {
    return snapshot.authorities.length === 0
      ? { kind: "not-school-admin" }
      : finding(snapshot, "school-admin-projection-conflict");
  }
  if (!snapshot.tenantId || !snapshot.tenantExists) {
    return finding(snapshot, "school-admin-tenant-missing");
  }
  if (snapshot.providerAdmin || snapshot.applicant) {
    return finding(snapshot, "school-admin-identity-conflict");
  }
  if (snapshot.authorities.some((authority) =>
    authority.userId !== snapshot.userId || authority.tenantId !== snapshot.tenantId)) {
    return finding(snapshot, "school-admin-authority-cross-tenant");
  }
  if (snapshot.authorities.length > 1) {
    return finding(snapshot, "school-admin-authority-duplicate");
  }
  if (snapshot.authorities.length === 0) {
    return { kind: "project", tenantId: snapshot.tenantId, userId: snapshot.userId };
  }
  const [authority] = snapshot.authorities;
  if (!authority || authority.authorityState !== "active") {
    return finding(snapshot, "school-admin-authority-malformed");
  }
  return {
    kind: "unchanged",
    authorityId: authority.id,
    tenantId: snapshot.tenantId,
    userId: snapshot.userId,
  };
}

export type SchoolAdminAuthorityResolution = Readonly<{
  legacyActive: boolean;
  dedicatedActive: boolean;
  compatible: boolean;
  ambiguous: boolean;
}>;

/** Resolves authority without treating a custom role or role name as School Admin. */
export function resolveSchoolAdminAuthority(
  snapshot: SchoolAdminCompatibilitySnapshot,
): SchoolAdminAuthorityResolution {
  const sameTenantAuthorities = snapshot.tenantId
    ? snapshot.authorities.filter((authority) =>
        authority.userId === snapshot.userId && authority.tenantId === snapshot.tenantId)
    : [];
  const crossTenant = sameTenantAuthorities.length !== snapshot.authorities.length;
  const dedicatedActive = !crossTenant
    && sameTenantAuthorities.length === 1
    && sameTenantAuthorities[0]?.authorityState === "active";
  const legacyActive = Boolean(
    snapshot.tenantId
    && snapshot.tenantExists
    && snapshot.legacyRole === "school-admin"
    && !snapshot.providerAdmin
    && !snapshot.applicant,
  );
  const conflictingLegacy = dedicatedActive
    && snapshot.legacyRole !== null
    && snapshot.legacyRole !== "school-admin";
  const ambiguous = crossTenant
    || sameTenantAuthorities.length > 1
    || sameTenantAuthorities.some((authority) => !["none", "active", "disabled"].includes(authority.authorityState))
    || snapshot.providerAdmin
    || snapshot.applicant
    || conflictingLegacy;

  return {
    legacyActive: legacyActive && !ambiguous,
    dedicatedActive: dedicatedActive && !ambiguous,
    compatible: legacyActive && dedicatedActive && !ambiguous,
    ambiguous,
  };
}

export function schoolAdminAllowedForMode(
  resolution: SchoolAdminAuthorityResolution,
  mode: "legacy" | "intersection" | "rbac" | "rbac-emergency",
): boolean {
  if (resolution.ambiguous) return false;
  if (mode === "legacy") return resolution.legacyActive;
  if (mode === "intersection") return resolution.compatible;
  return resolution.dedicatedActive;
}
