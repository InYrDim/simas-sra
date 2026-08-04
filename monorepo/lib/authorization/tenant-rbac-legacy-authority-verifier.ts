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
  /school-admin-authority/,
  /tenant-rbac-legacy-authority-verifier/,
];

export function findForbiddenLegacyAuthorityReferences(
  files: readonly Readonly<{ path: string; content: string }>[],
): readonly LegacyAuthorityReference[] {
  const findings: LegacyAuthorityReference[] = [];
  for (const file of files) {
    if (ALLOWED_PATHS.some((pattern) => pattern.test(file.path))) continue;
    file.content.split(/\r?\n/).forEach((line, index) => {
      for (const pattern of FORBIDDEN_RUNTIME_REFERENCES) {
        if (pattern.test(line)) {
          findings.push({ file: file.path, line: index + 1, reference: pattern.source });
          break;
        }
      }
    });
  }
  return findings;
}
