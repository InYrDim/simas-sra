import assert from "node:assert/strict";
import test from "node:test";

import { projectTenantRbacOperationsRow } from "@/lib/authorization/tenant-rbac-operations-data";

const base = {
  tenantId: "tenant-1",
  tenantName: "Sekolah Satu",
  httpMode: "intersection" as const,
  workerMode: "legacy" as const,
  epoch: BigInt(7),
  resolverVersion: "tenant-authorization@2",
  registryVersion: "tenant-permissions@2",
  operationMapVersion: "tenant-operations@4",
  overlayHash: null,
  multiRoleAcceptedAt: null,
  rolloutVersion: 3,
};

test("projects complete rollout evidence without crossing Tenant findings", () => {
  const projected = projectTenantRbacOperationsRow(base, 2);

  assert.equal(projected.tenantId, "tenant-1");
  assert.equal(projected.epoch, "7");
  assert.equal(projected.emergencyState, "inactive");
  assert.equal(projected.rollbackEligibility, "eligible");
  assert.equal(projected.blockingFindingCount, 2);
  assert.equal(projected.evidenceAvailable, true);
});

test("missing rollout evidence remains unknown rather than healthy", () => {
  const projected = projectTenantRbacOperationsRow({
    ...base,
    httpMode: null,
    workerMode: null,
    epoch: null,
    resolverVersion: null,
    registryVersion: null,
    operationMapVersion: null,
    rolloutVersion: null,
  }, 0);

  assert.equal(projected.httpMode, null);
  assert.equal(projected.emergencyState, "unknown");
  assert.equal(projected.rollbackEligibility, "unknown");
  assert.equal(projected.evidenceAvailable, false);
});

test("inconsistent emergency evidence is unknown and not rollback eligible", () => {
  const projected = projectTenantRbacOperationsRow({
    ...base,
    httpMode: "rbac-emergency",
    workerMode: "rbac",
    overlayHash: "a".repeat(64),
  }, 0);

  assert.equal(projected.emergencyState, "unknown");
  assert.equal(projected.rollbackEligibility, "ineligible");
});
