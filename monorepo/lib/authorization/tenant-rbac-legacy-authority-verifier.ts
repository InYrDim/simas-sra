export type LegacyAuthorityReference = Readonly<{
  file: string;
  line: number;
  reference: string;
}>;

/**
 * Runtime authority must not read the singular legacy role after RBAC cutover.
 * Compatibility projections and migration tooling are explicitly allowed to
 * reference it until the later contract release.
 */
const FORBIDDEN_RUNTIME_REFERENCES = [
  /user\.tenantRole\b/,
  /account\.legacyRole\b/,
  /legacyRoleAllows\(/,
  /tenant_role\s*=/,
];

const ALLOWED_PATHS = [
  /legacy-non-admin-backfill/,
  /applicant-identity-migration/,
  /school-admin-authority\.ts$/,
  /tenant-rbac-legacy-authority-verifier/,
];

const ALLOWED_COMPATIBILITY_REFERENCES = [
  { path: /school-admin-authority-data\.ts$/, reference: /legacyRole: user\.tenantRole/ },
  { path: /school-admin-authority-data\.ts$/, reference: /legacyRole: account\.legacyRole/ },
  { path: /school-admin-authority-data\.ts$/, reference: /eq\(user\.tenantRole, "school-admin"\)/ },
  { path: /school-admin-lifecycle-data\.ts$/, reference: /eq\(user\.tenantRole, "school-admin"\)/ },
  { path: /provider-application-data\.ts$/, reference: /isNull\(user\.tenantRole\)/ },
  { path: /clean-legacy-backfill-test-data\.ts$/, reference: /SET tenant_id=NULL, tenant_role=NULL/ },
];

export function findForbiddenLegacyAuthorityReferences(
  files: readonly Readonly<{ path: string; content: string }>[],
): readonly LegacyAuthorityReference[] {
  const findings: LegacyAuthorityReference[] = [];
  for (const file of files) {
    if (ALLOWED_PATHS.some((pattern) => pattern.test(file.path))) continue;
    file.content.split(/\r?\n/).forEach((line, index) => {
      const compatibilityReference = ALLOWED_COMPATIBILITY_REFERENCES.find((allowed) =>
        allowed.path.test(file.path) && allowed.reference.test(line)
      );
      const inspectedLine = compatibilityReference
        ? line.replace(compatibilityReference.reference, "")
        : line;
      for (const pattern of FORBIDDEN_RUNTIME_REFERENCES) {
        if (pattern.test(inspectedLine)) {
          findings.push({ file: file.path, line: index + 1, reference: pattern.source });
          break;
        }
      }
    });
  }
  return findings;
}
