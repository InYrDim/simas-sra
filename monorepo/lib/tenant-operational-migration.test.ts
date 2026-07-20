import assert from "node:assert/strict";
import test from "node:test";

import {
  completedBackfillNeedsRestart,
  planTenantOperationalBackfillBatch,
  resolveLifecycleMutationAvailability,
  verifyTenantAccessShadow,
  type TenantOperationalMigrationRow,
} from "@/lib/tenant-operational-migration";

const usableTenant: TenantOperationalMigrationRow = {
  id: "tenant-1",
  sourceApplicationId: "application-1",
  sourceApplicationStatus: "approved",
  approvedTenantId: "tenant-1",
  operationalStatus: null,
  reconciliationStatus: null,
  deletionWaitingDays: null,
  legacyWaitingDays: null,
};

test("usable legacy Tenants are backfilled active without lifecycle work", () => {
  assert.deepEqual(planTenantOperationalBackfillBatch([usableTenant], null, 100), {
    operations: [{
      tenantId: "tenant-1",
      operationalStatus: "active",
      reconciliationStatus: "not_required",
      deletionWaitingDays: 30,
    }],
    checkpoint: "tenant-1",
    examined: 1,
    hasMore: false,
    metrics: { active: 1, needsReconciliation: 0, alreadyMigrated: 0 },
  });
});

test("ambiguous legacy Tenants remain active but require reconciliation", () => {
  const ambiguous = {
    ...usableTenant,
    id: "tenant-ambiguous",
    sourceApplicationStatus: "rejected" as const,
  };

  const plan = planTenantOperationalBackfillBatch([ambiguous], null, 100);
  assert.equal(plan.operations[0]?.operationalStatus, "active");
  assert.equal(plan.operations[0]?.reconciliationStatus, "needs_reconciliation");
  assert.deepEqual(resolveLifecycleMutationAvailability({
    featureEnabled: true,
    operationalStatus: "active",
    reconciliationStatus: "needs_reconciliation",
  }), { allowed: false, reason: "tenant-needs-reconciliation" });
});

test("backfill is bounded, resumable, idempotent, and preserves valid overrides", () => {
  const rows: TenantOperationalMigrationRow[] = [
    { ...usableTenant, id: "tenant-1", legacyWaitingDays: 45 },
    { ...usableTenant, id: "tenant-2" },
    {
      ...usableTenant,
      id: "tenant-3",
      operationalStatus: "active",
      reconciliationStatus: "not_required",
      deletionWaitingDays: 30,
    },
  ];

  const first = planTenantOperationalBackfillBatch(rows, null, 2);
  assert.equal(first.checkpoint, "tenant-2");
  assert.equal(first.hasMore, true);
  assert.deepEqual(first.operations.map((operation) => operation.deletionWaitingDays), [45, 30]);

  const resumed = planTenantOperationalBackfillBatch(rows, first.checkpoint, 2);
  assert.deepEqual(resumed.operations, []);
  assert.equal(resumed.metrics.alreadyMigrated, 1);
  assert.equal(resumed.hasMore, false);

  const rerun = planTenantOperationalBackfillBatch(rows.map((row) => ({
    ...row,
    operationalStatus: "active",
    reconciliationStatus: "not_required",
    deletionWaitingDays: row.legacyWaitingDays ?? 30,
  })), null, 10);
  assert.deepEqual(rerun.operations, []);
  assert.equal(rerun.metrics.alreadyMigrated, 3);
});

test("a completed checkpoint reopens when an old writer adds an incomplete Tenant", () => {
  assert.equal(completedBackfillNeedsRestart(new Date("2026-07-20T00:00:00Z"), 1), true);
  assert.equal(completedBackfillNeedsRestart(new Date("2026-07-20T00:00:00Z"), 0), false);
  assert.equal(completedBackfillNeedsRestart(null, 1), false);
});

test("shadow verification reports access differences before activation", () => {
  assert.deepEqual(verifyTenantAccessShadow([
    { tenantId: "tenant-1", legacyAllowed: true, operationalStatus: "active" },
    { tenantId: "tenant-2", legacyAllowed: true, operationalStatus: "closed" },
    { tenantId: "tenant-3", legacyAllowed: false, operationalStatus: null },
  ]), {
    ok: false,
    compared: 3,
    differences: [
      { tenantId: "tenant-2", legacyAllowed: true, lifecycleAllowed: false },
      { tenantId: "tenant-3", legacyAllowed: false, lifecycleAllowed: true },
    ],
  });
});

test("feature rollback stops only new lifecycle mutations", () => {
  assert.deepEqual(resolveLifecycleMutationAvailability({
    featureEnabled: false,
    operationalStatus: "active",
    reconciliationStatus: "not_required",
  }), { allowed: false, reason: "lifecycle-mutations-disabled" });
  assert.deepEqual(resolveLifecycleMutationAvailability({
    featureEnabled: true,
    operationalStatus: "active",
    reconciliationStatus: "not_required",
  }), { allowed: true });
});
