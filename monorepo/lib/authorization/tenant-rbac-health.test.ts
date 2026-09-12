import assert from "node:assert/strict";
import test from "node:test";

import { evaluateTenantRbacHealth, summarizeTenantRbacHealth, tenantRbacHealthExitCode, type TenantRbacHealthSnapshot } from "@/lib/authorization/tenant-rbac-health";

const now = new Date("2026-08-05T12:00:00.000Z");
const healthy: TenantRbacHealthSnapshot = {
  tenantId: "tenant-1", httpMode: "rbac", workerMode: "rbac", httpEpoch: "7", workerEpoch: "7",
  resolverVersion: "tenant-authorization@2", registryVersion: "tenant-permissions@2", operationMapVersion: "tenant-operations@4",
  expectedVersions: { resolver: "tenant-authorization@2", registry: "tenant-permissions@2", operationMap: "tenant-operations@4" },
  emergencyReviewAt: null,
  gates: { noUnexplainedWidening: "passed", isolationMatch: "passed", nextRequestRevocation: "passed", workerExecution: "passed", auditIntegrity: "passed", supportedVersion: "passed", schoolAdminCoverage: "passed" },
};

test("healthy supported RBAC state emits no operational signals", () => {
  const signals = evaluateTenantRbacHealth(healthy, now);
  assert.deepEqual(signals, []);
  assert.deepEqual(summarizeTenantRbacHealth(signals), { status: "healthy", blocking: 0, warnings: 0 });
});

test("every failed Issue 32 gate emits a stable blocking signal", () => {
  const cases = [
    ["noUnexplainedWidening", "unexplained-widening"], ["isolationMatch", "isolation-mismatch"],
    ["nextRequestRevocation", "next-request-revocation-failure"], ["workerExecution", "worker-execution-authorization-failure"],
    ["auditIntegrity", "audit-integrity-failure"], ["supportedVersion", "unsupported-version"],
    ["schoolAdminCoverage", "school-admin-coverage-violation"],
  ] as const;
  for (const [gate, code] of cases) {
    const signals = evaluateTenantRbacHealth({ ...healthy, gates: { ...healthy.gates, [gate]: "failed" } }, now);
    assert.equal(signals[0]?.code, code);
    assert.equal(signals[0]?.severity, "blocking");
    assert.equal(signals[0]?.deduplicationKey, `tenant-rbac-health@1:tenant-1:${signals[0]?.surface}:${code}`);
  }
});

test("version, epoch, and overdue emergency failures are blocking without inventing evidence", () => {
  const signals = evaluateTenantRbacHealth({ ...healthy, httpMode: "rbac-emergency", workerMode: "rbac-emergency", workerEpoch: "8", resolverVersion: "unsupported@9", emergencyReviewAt: now.toISOString() }, now);
  assert.deepEqual(signals.map((item) => item.code).sort(), ["emergency-review-overdue", "http-worker-epoch-mismatch", "unsupported-version"]);
  assert.equal(summarizeTenantRbacHealth(signals).status, "blocking");
  assert.equal(tenantRbacHealthExitCode(signals), 1);
  assert.equal(tenantRbacHealthExitCode([]), 0);
});

test("unknown canary gates remain warnings rather than fabricated passing evidence", () => {
  const signals = evaluateTenantRbacHealth({ ...healthy, httpMode: "intersection", gates: { ...healthy.gates, auditIntegrity: "unknown" } }, now);
  assert.equal(signals[0]?.code, "promotion-evidence-unknown");
  assert.equal(signals[0]?.safeDetails.gate, "auditIntegrity");
  assert.equal(summarizeTenantRbacHealth(signals).status, "warning");
});
