export type TenantOperationalStatus = "active" | "closed";
export type TenantReconciliationStatus = "not_required" | "needs_reconciliation";

export type TenantOperationalMigrationRow = Readonly<{
  id: string;
  sourceApplicationId: string;
  sourceApplicationStatus: "pending" | "approved" | "rejected" | null;
  approvedTenantId: string | null;
  operationalStatus: TenantOperationalStatus | null;
  reconciliationStatus: TenantReconciliationStatus | null;
  deletionWaitingDays: number | null;
  legacyWaitingDays: number | null;
}>;

type BackfillOperation = Readonly<{
  tenantId: string;
  operationalStatus: "active";
  reconciliationStatus: TenantReconciliationStatus;
  deletionWaitingDays: number;
}>;

function isTrustedUsableTenant(row: TenantOperationalMigrationRow) {
  return row.sourceApplicationStatus === "approved" && row.approvedTenantId === row.id;
}

function waitingDays(row: TenantOperationalMigrationRow) {
  const candidate = row.legacyWaitingDays;
  return candidate !== null && Number.isInteger(candidate) && candidate >= 1 && candidate <= 365
    ? candidate
    : 30;
}

export function planTenantOperationalBackfillBatch(
  rows: readonly TenantOperationalMigrationRow[],
  afterTenantId: string | null,
  batchSize: number,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const remaining = [...rows]
    .filter((row) => afterTenantId === null || row.id > afterTenantId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const batch = remaining.slice(0, batchSize);
  const operations: BackfillOperation[] = [];
  let active = 0;
  let needsReconciliation = 0;
  let alreadyMigrated = 0;

  for (const row of batch) {
    if (
      row.operationalStatus !== null &&
      row.reconciliationStatus !== null &&
      row.deletionWaitingDays !== null
    ) {
      alreadyMigrated += 1;
      continue;
    }
    const reconciliationStatus = isTrustedUsableTenant(row)
      ? "not_required"
      : "needs_reconciliation";
    operations.push({
      tenantId: row.id,
      operationalStatus: "active",
      reconciliationStatus,
      deletionWaitingDays: waitingDays(row),
    });
    active += 1;
    if (reconciliationStatus === "needs_reconciliation") needsReconciliation += 1;
  }

  return {
    operations,
    checkpoint: batch.at(-1)?.id ?? afterTenantId,
    examined: batch.length,
    hasMore: remaining.length > batch.length,
    metrics: { active, needsReconciliation, alreadyMigrated },
  } as const;
}

export function resolveLegacyTenantOperationalAccess(tenantExists: boolean) {
  return tenantExists;
}

export function resolveTenantOperationalAccess(
  operationalStatus: TenantOperationalStatus | null,
) {
  return operationalStatus !== "closed";
}

export function verifyTenantAccessShadow(
  rows: readonly Readonly<{
    tenantId: string;
    legacyAllowed: boolean;
    operationalStatus: TenantOperationalStatus | null;
  }>[],
) {
  const differences = rows.flatMap((row) => {
    const lifecycleAllowed = resolveTenantOperationalAccess(row.operationalStatus);
    return lifecycleAllowed === row.legacyAllowed
      ? []
      : [{ tenantId: row.tenantId, legacyAllowed: row.legacyAllowed, lifecycleAllowed }];
  });
  return { ok: differences.length === 0, compared: rows.length, differences } as const;
}

export function completedBackfillNeedsRestart(
  completedAt: Date | null,
  incompleteTenantCount: number,
) {
  return completedAt !== null && incompleteTenantCount > 0;
}

export function tenantLifecycleMutationsEnabled(
  value = process.env.TENANT_LIFECYCLE_MUTATIONS_ENABLED,
) {
  return value === "true";
}

export function resolveLifecycleMutationAvailability(input: Readonly<{
  featureEnabled: boolean;
  operationalStatus: TenantOperationalStatus | null;
  reconciliationStatus: TenantReconciliationStatus | null;
}>) {
  if (!input.featureEnabled) {
    return { allowed: false, reason: "lifecycle-mutations-disabled" } as const;
  }
  if (input.reconciliationStatus !== "not_required" || input.operationalStatus === null) {
    return { allowed: false, reason: "tenant-needs-reconciliation" } as const;
  }
  return { allowed: true } as const;
}
