import { createHash } from "node:crypto";

export type MigrationUser = Readonly<{
  id: string;
  tenantId: string | null;
  tenantRole: string | null;
}>;

export type MigrationBinding = Readonly<{
  id: string;
  userId: string;
  canonicalNpsn: string;
}>;

export type MigrationApplication = Readonly<{
  id: string;
  npsn: string;
  status: "pending" | "approved" | "rejected";
  ownerUserId: string | null;
  bindingId: string | null;
  attemptNumber: number | null;
  idempotencyKey: string | null;
  payloadHash: string | null;
  approvedTenantId: string | null;
  submittedAt: Date;
}>;

export type MigrationTenant = Readonly<{
  id: string;
  npsn: string;
  sourceApplicationId: string;
}>;

export type MigrationActivation = Readonly<{
  userId: string;
  tenantId: string;
  temporaryCredentialIssuedAt: Date;
  firstAuthenticatedAt: Date | null;
  passwordChangedAt: Date | null;
}>;

export type ApplicantIdentityMigrationSnapshot = Readonly<{
  users: readonly MigrationUser[];
  providerAdminUserIds: readonly string[];
  applicantUserIds: readonly string[];
  bindings: readonly MigrationBinding[];
  applications: readonly MigrationApplication[];
  tenants: readonly MigrationTenant[];
  activations: readonly MigrationActivation[];
}>;

export type MigrationFindingCode =
  | "applications-without-owner"
  | "noncanonical-application-npsn"
  | "noncanonical-binding-npsn"
  | "noncanonical-tenant-npsn"
  | "duplicate-canonical-npsn"
  | "incomplete-expanded-application"
  | "inconsistent-application-binding"
  | "multiple-pending-applications"
  | "invalid-identity-path-count"
  | "school-admin-without-valid-tenant"
  | "inconsistent-approval-tenant-link"
  | "invalid-temporary-credential-activation";

export type MigrationFinding = Readonly<{
  code: MigrationFindingCode;
  identifiers: readonly string[];
}>;

const canonicalNpsnPattern = /^\d{8}$/;

function sortedUnique(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function finding(
  code: MigrationFindingCode,
  identifiers: Iterable<string>,
): MigrationFinding | null {
  const normalized = sortedUnique(identifiers);
  return normalized.length === 0 ? null : { code, identifiers: normalized };
}

export function auditApplicantIdentityMigration(
  snapshot: ApplicantIdentityMigrationSnapshot,
) {
  const usersById = new Map(snapshot.users.map((user) => [user.id, user]));
  const tenantsById = new Map(snapshot.tenants.map((tenant) => [tenant.id, tenant]));
  const applicationsById = new Map(
    snapshot.applications.map((application) => [application.id, application]),
  );
  const providerAdmins = new Set(snapshot.providerAdminUserIds);
  const applicants = new Set(snapshot.applicantUserIds);

  const duplicateNpsn = new Set<string>();
  for (const values of [
    snapshot.tenants.map((tenant) => tenant.npsn),
    snapshot.bindings.map((binding) => binding.canonicalNpsn),
  ]) {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    for (const [value, count] of counts) {
      if (count > 1) duplicateNpsn.add(value);
    }
  }

  const pendingByNpsn = new Map<string, number>();
  for (const application of snapshot.applications) {
    if (application.status !== "pending") continue;
    const digits = application.npsn.replace(/\D/g, "");
    const auditNpsn = canonicalNpsnPattern.test(digits) ? digits : application.npsn;
    pendingByNpsn.set(auditNpsn, (pendingByNpsn.get(auditNpsn) ?? 0) + 1);
  }

  const inconsistentApprovalLinks = new Set<string>();
  for (const application of snapshot.applications) {
    if (application.status === "approved") {
      const linkedTenant = application.approvedTenantId
        ? tenantsById.get(application.approvedTenantId)
        : undefined;
      if (!linkedTenant || linkedTenant.sourceApplicationId !== application.id) {
        inconsistentApprovalLinks.add(application.id);
      }
    } else if (application.approvedTenantId !== null) {
      inconsistentApprovalLinks.add(application.id);
    }
  }
  for (const tenant of snapshot.tenants) {
    const source = applicationsById.get(tenant.sourceApplicationId);
    if (
      !source ||
      source.status !== "approved" ||
      source.approvedTenantId !== tenant.id
    ) {
      inconsistentApprovalLinks.add(tenant.id);
    }
  }

  const findings = [
    finding(
      "applications-without-owner",
      snapshot.applications
        .filter((application) => application.ownerUserId === null)
        .map((application) => application.id),
    ),
    finding(
      "noncanonical-application-npsn",
      snapshot.applications
        .filter((application) => !canonicalNpsnPattern.test(application.npsn))
        .map((application) => application.id),
    ),
    finding(
      "noncanonical-binding-npsn",
      snapshot.bindings
        .filter((binding) => !canonicalNpsnPattern.test(binding.canonicalNpsn))
        .map((binding) => binding.id),
    ),
    finding(
      "noncanonical-tenant-npsn",
      snapshot.tenants
        .filter((tenant) => !canonicalNpsnPattern.test(tenant.npsn))
        .map((tenant) => tenant.id),
    ),
    finding(
      "duplicate-canonical-npsn",
      duplicateNpsn,
    ),
    finding(
      "incomplete-expanded-application",
      snapshot.applications
        .filter((application) => {
          const values = [
            application.ownerUserId,
            application.bindingId,
            application.attemptNumber,
            application.idempotencyKey,
            application.payloadHash,
          ];
          const presentCount = values.filter((value) => value !== null).length;
          return presentCount !== 0 && presentCount !== values.length;
        })
        .map((application) => application.id),
    ),
    finding(
      "inconsistent-application-binding",
      snapshot.applications
        .filter((application) => {
          if (application.ownerUserId === null || application.bindingId === null) {
            return false;
          }
          const binding = snapshot.bindings.find(
            (candidate) => candidate.id === application.bindingId,
          );
          return !binding || binding.userId !== application.ownerUserId;
        })
        .map((application) => application.id),
    ),
    finding(
      "multiple-pending-applications",
      [...pendingByNpsn.entries()]
        .filter(([, count]) => count > 1)
        .map(([npsn]) => npsn),
    ),
    finding(
      "invalid-identity-path-count",
      snapshot.users
        .filter((user) => {
          const pathCount =
            Number(providerAdmins.has(user.id)) +
            Number(applicants.has(user.id)) +
            Number(user.tenantId !== null && user.tenantRole !== null);
          return pathCount !== 1;
        })
        .map((user) => user.id),
    ),
    finding(
      "school-admin-without-valid-tenant",
      snapshot.users
        .filter(
          (user) =>
            user.tenantRole === "school-admin" &&
            (user.tenantId === null || !tenantsById.has(user.tenantId)),
        )
        .map((user) => user.id),
    ),
    finding("inconsistent-approval-tenant-link", inconsistentApprovalLinks),
    finding(
      "invalid-temporary-credential-activation",
      snapshot.activations
        .filter((activation) => {
          const user = usersById.get(activation.userId);
          return (
            !user ||
            user.tenantRole !== "school-admin" ||
            user.tenantId !== activation.tenantId ||
            !tenantsById.has(activation.tenantId)
          );
        })
        .map((activation) => activation.userId),
    ),
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const records = [...snapshot.activations]
    .sort((left, right) => left.userId.localeCompare(right.userId))
    .map((activation) => ({
      userId: activation.userId,
      tenantId: activation.tenantId,
      temporaryCredentialIssuedAt:
        activation.temporaryCredentialIssuedAt.toISOString(),
      firstAuthenticatedAt: activation.firstAuthenticatedAt?.toISOString() ?? null,
      passwordChangedAt: activation.passwordChangedAt?.toISOString() ?? null,
    }));

  return {
    ok: findings.length === 0,
    findings,
    activationBaseline: { count: records.length, records },
  } as const;
}

export type OwnershipMapping = Readonly<{
  applicationId: string;
  ownerUserId: string;
}>;

type BackfillOperation =
  | Readonly<{ type: "ensure-applicant"; userId: string }>
  | Readonly<{
      type: "ensure-binding";
      id: string;
      userId: string;
      canonicalNpsn: string;
    }>
  | Readonly<{
      type: "assign-application";
      applicationId: string;
      ownerUserId: string;
      bindingId: string;
      attemptNumber: number;
      idempotencyKey: string;
      payloadHash: string;
    }>;

type BackfillErrorCode =
  | "missing-explicit-mapping"
  | "duplicate-explicit-mapping"
  | "unknown-application"
  | "unknown-owner"
  | "noncanonical-npsn"
  | "owner-mapped-to-multiple-npsn"
  | "npsn-mapped-to-multiple-owners"
  | "conflicting-existing-ownership";

type BackfillError = Readonly<{ code: BackfillErrorCode; identifier: string }>;

export function legacyApplicantBindingId(userId: string) {
  const digest = createHash("sha256").update(userId).digest("hex");
  return `legacy:${digest.slice(0, 29)}`;
}

export function planApplicantOwnershipBackfill(
  snapshot: ApplicantIdentityMigrationSnapshot,
  mappings: readonly OwnershipMapping[],
):
  | Readonly<{ ok: true; operations: readonly BackfillOperation[] }>
  | Readonly<{ ok: false; errors: readonly BackfillError[] }> {
  const usersById = new Map(snapshot.users.map((user) => [user.id, user]));
  const users = new Set(usersById.keys());
  const providerAdmins = new Set(snapshot.providerAdminUserIds);
  const applications = new Map(
    snapshot.applications.map((application) => [application.id, application]),
  );
  const mappingByApplication = new Map<string, OwnershipMapping>();
  const errors: BackfillError[] = [];

  for (const mapping of mappings) {
    if (mappingByApplication.has(mapping.applicationId)) {
      errors.push({ code: "duplicate-explicit-mapping", identifier: mapping.applicationId });
      continue;
    }
    mappingByApplication.set(mapping.applicationId, mapping);
    if (!applications.has(mapping.applicationId)) {
      errors.push({ code: "unknown-application", identifier: mapping.applicationId });
    }
    if (!users.has(mapping.ownerUserId)) {
      errors.push({ code: "unknown-owner", identifier: mapping.ownerUserId });
    }
  }

  for (const application of snapshot.applications) {
    if (application.ownerUserId === null && !mappingByApplication.has(application.id)) {
      errors.push({ code: "missing-explicit-mapping", identifier: application.id });
    }
  }

  const mappedNpsnByOwner = new Map<string, string>();
  const mappedOwnerByNpsn = new Map<string, string>();
  for (const mapping of mappings) {
    const application = applications.get(mapping.applicationId);
    if (!application || !users.has(mapping.ownerUserId)) continue;
    if (!canonicalNpsnPattern.test(application.npsn)) {
      errors.push({ code: "noncanonical-npsn", identifier: application.id });
      continue;
    }
    const previousNpsn = mappedNpsnByOwner.get(mapping.ownerUserId);
    if (previousNpsn && previousNpsn !== application.npsn) {
      errors.push({ code: "owner-mapped-to-multiple-npsn", identifier: mapping.ownerUserId });
    }
    const previousOwner = mappedOwnerByNpsn.get(application.npsn);
    if (previousOwner && previousOwner !== mapping.ownerUserId) {
      errors.push({ code: "npsn-mapped-to-multiple-owners", identifier: application.npsn });
    }
    mappedNpsnByOwner.set(mapping.ownerUserId, application.npsn);
    mappedOwnerByNpsn.set(application.npsn, mapping.ownerUserId);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: [...errors].sort(
        (left, right) =>
          left.code.localeCompare(right.code) ||
          left.identifier.localeCompare(right.identifier),
      ),
    };
  }

  const operations: BackfillOperation[] = [];
  const existingApplicants = new Set(snapshot.applicantUserIds);
  const bindingsByUser = new Map(
    snapshot.bindings.map((binding) => [binding.userId, binding]),
  );
  const bindingsByNpsn = new Map(
    snapshot.bindings.map((binding) => [binding.canonicalNpsn, binding]),
  );

  for (const [ownerUserId, canonicalNpsn] of [...mappedNpsnByOwner.entries()].sort()) {
    const owner = usersById.get(ownerUserId)!;
    const mappedApplications = mappings
      .filter((mapping) => mapping.ownerUserId === ownerUserId)
      .map((mapping) => applications.get(mapping.applicationId)!);
    const hasTenantIdentity = owner.tenantId !== null && owner.tenantRole !== null;
    if (providerAdmins.has(ownerUserId)) {
      return {
        ok: false,
        errors: [{ code: "conflicting-existing-ownership", identifier: ownerUserId }],
      };
    }
    if (
      hasTenantIdentity &&
      mappedApplications.some((application) => application.status !== "approved")
    ) {
      return {
        ok: false,
        errors: [{ code: "conflicting-existing-ownership", identifier: ownerUserId }],
      };
    }
    if (!existingApplicants.has(ownerUserId) && !hasTenantIdentity) {
      operations.push({ type: "ensure-applicant", userId: ownerUserId });
    }
    const existingBinding = bindingsByUser.get(ownerUserId);
    const existingNpsnBinding = bindingsByNpsn.get(canonicalNpsn);
    if (
      existingNpsnBinding &&
      existingNpsnBinding.userId !== ownerUserId
    ) {
      return {
        ok: false,
        errors: [
          { code: "conflicting-existing-ownership", identifier: canonicalNpsn },
        ],
      };
    }
    if (existingBinding && existingBinding.canonicalNpsn !== canonicalNpsn) {
      return {
        ok: false,
        errors: [{ code: "conflicting-existing-ownership", identifier: ownerUserId }],
      };
    }
    if (!existingBinding) {
      operations.push({
        type: "ensure-binding",
        id: legacyApplicantBindingId(ownerUserId),
        userId: ownerUserId,
        canonicalNpsn,
      });
    }

    const bindingId = existingBinding?.id ?? legacyApplicantBindingId(ownerUserId);
    const ownerApplications = mappedApplications.sort(
        (left, right) =>
          left.submittedAt.getTime() - right.submittedAt.getTime() ||
          left.id.localeCompare(right.id),
      );

    ownerApplications.forEach((application, index) => {
      const expected = {
        ownerUserId,
        bindingId,
        attemptNumber: index + 1,
        idempotencyKey: `legacy:${application.id}`,
        payloadHash: `legacy:${application.id}`,
      };
      if (
        application.ownerUserId === expected.ownerUserId &&
        application.bindingId === expected.bindingId &&
        application.attemptNumber === expected.attemptNumber &&
        application.idempotencyKey === expected.idempotencyKey &&
        application.payloadHash === expected.payloadHash
      ) {
        return;
      }
      if (application.ownerUserId !== null) {
        errors.push({
          code: "conflicting-existing-ownership",
          identifier: application.id,
        });
        return;
      }
      operations.push({
        type: "assign-application",
        applicationId: application.id,
        ...expected,
      });
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, operations };
}
