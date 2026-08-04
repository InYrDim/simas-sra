import assert from "node:assert/strict";
import test from "node:test";

import { createControlledSecurityCommandStore } from "@/lib/authorization/security-command-controlled-store";
import { createSecurityCommandService, SecurityCommandError } from "@/lib/authorization/security-command";
import { createTenantRbacRolloutCommandService, type StoredRolloutState } from "@/lib/authorization/tenant-rbac-rollout-command";
import {
  emergencyOverlayDigest,
  planEmergencyExit,
  planLegacyRollback,
  planRolloutTransition,
  type RolloutState,
} from "@/lib/authorization/tenant-rbac-rollout";

const now = new Date("2026-08-01T00:00:00.000Z");
const base: RolloutState = {
  httpMode: "legacy",
  workerMode: "legacy",
  epoch: BigInt(1),
  version: 1,
  resolverVersion: "tenant-authorization@1",
  registryVersion: "tenant-permissions@2",
  operationMapVersion: "tenant-operations@4",
  overlayHash: null,
  multiRoleAcceptedAt: null,
  legacyAuthorityDisabledAt: null,
  rollbackEligible: true,
};
const evidence = {
  cohort: "internal-test",
  contractDigest: "a".repeat(64),
  sourceWatermark: "audit:100",
  resolverVersion: base.resolverVersion,
  registryVersion: base.registryVersion,
  operationMapVersion: base.operationMapVersion,
  rolloutVersion: 1,
  approverIds: ["provider-1"],
  observedFrom: new Date("2026-07-31T00:00:00.000Z"),
  observedUntil: now,
  checks: {
    noUnexplainedWidening: true,
    isolationMatch: true,
    nextRequestRevocation: true,
    workerExecution: true,
    auditIntegrity: true,
    supportedVersion: true,
    schoolAdminCoverage: true,
  },
} as const;

function ids() {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, "0")}`;
}

function stored(state: RolloutState): StoredRolloutState {
  return {
    ...state,
    epoch: state.epoch.toString(),
    multiRoleAcceptedAt: state.multiRoleAcceptedAt?.toISOString() ?? null,
    legacyAuthorityDisabledAt: state.legacyAuthorityDisabledAt?.toISOString() ?? null,
  };
}

test("promotion requires every cohort gate and advances HTTP independently", () => {
  const intersection = planRolloutTransition(base, { surface: "http", toMode: "intersection", expectedEpoch: BigInt(1), reason: "internal canary" }, now);
  assert.equal(intersection.httpMode, "intersection");
  assert.equal(intersection.workerMode, "legacy");
  assert.throws(() => planRolloutTransition(intersection, { surface: "http", toMode: "rbac", expectedEpoch: intersection.epoch, reason: "promote", evidence: { ...evidence, rolloutVersion: 2, registryVersion: "unsupported@99" } }, now), /rollout-evidence-version-mismatch/);
  const promoted = planRolloutTransition(intersection, { surface: "http", toMode: "rbac", expectedEpoch: intersection.epoch, reason: "promote", evidence: { ...evidence, rolloutVersion: 2 } }, now);
  assert.equal(promoted.httpMode, "rbac");
  assert.equal(promoted.workerMode, "legacy");
  assert.equal(promoted.rollbackEligible, false);
  assert.equal(promoted.multiRoleAcceptedAt?.toISOString(), now.toISOString());
});

test("unsupported or failed gates block promotion without widening", () => {
  const intersection = planRolloutTransition(base, { surface: "both", toMode: "intersection", expectedEpoch: base.epoch, reason: "canary" }, now);
  assert.throws(() => planRolloutTransition(intersection, { surface: "both", toMode: "rbac", expectedEpoch: intersection.epoch, reason: "failed canary", evidence: { ...evidence, rolloutVersion: 2, checks: { ...evidence.checks, workerExecution: false } } }, now), /rollout-gate-failed:workerExecution/);
  assert.throws(() => planRolloutTransition(base, { surface: "http", toMode: "rbac", expectedEpoch: BigInt(9), reason: "stale" }, now), /rollout-epoch-stale/);
});

test("emergency overlay is hash-bound, deny-only, and uses one shared epoch", () => {
  const rbac: RolloutState = { ...base, httpMode: "rbac", workerMode: "rbac", rollbackEligible: false, multiRoleAcceptedAt: now, legacyAuthorityDisabledAt: now, epoch: BigInt(4), version: 4 };
  const body = { deniedOperationIds: ["tenant-settings.landing-page.update"], deniedPermissionKeys: [], denyMutations: true, policyVersion: "emergency@1" } as const;
  const overlay = { ...body, overlayHash: emergencyOverlayDigest(body) };
  const emergency = planRolloutTransition(rbac, { surface: "both", toMode: "rbac-emergency", expectedEpoch: rbac.epoch, reason: "incident narrowing", emergencyOverlay: overlay }, now);
  assert.equal(emergency.httpMode, "rbac-emergency");
  assert.equal(emergency.workerMode, "rbac-emergency");
  assert.equal(emergency.epoch, BigInt(5));
  assert.throws(() => planRolloutTransition(rbac, { surface: "both", toMode: "rbac-emergency", expectedEpoch: rbac.epoch, reason: "tampered", emergencyOverlay: { ...overlay, deniedOperationIds: [] } }, now), /emergency-overlay-integrity-failure/);
  const exited = planEmergencyExit(emergency, { surface: "both", toMode: "rbac", expectedEpoch: emergency.epoch, reason: "verified recovery", exitEvidence: { verified: true, evidenceDigest: "b".repeat(64), reviewedAt: now } });
  assert.equal(exited.httpMode, "rbac");
  assert.equal(exited.workerMode, "rbac");
});

test("legacy rollback is forbidden after multi-role acceptance", () => {
  assert.throws(() => planLegacyRollback({ ...base, rollbackEligible: false }, base.epoch), /legacy-rollback-forbidden/);
  assert.throws(() => planLegacyRollback({ ...base, multiRoleAcceptedAt: now }, base.epoch), /legacy-rollback-forbidden/);
});

test("rollout command derives Provider context, reauthenticates, and commits through security audit CAS", async () => {
  const provider = { kind: "provider-admin" as const, userId: "provider-1", displayName: "Provider", email: "provider@example.test" };
  const controlled = createControlledSecurityCommandStore({ actors: { [provider.userId]: provider }, initialState: [{ id: "tenant-1", version: 1, value: stored(base) }] });
  const executeSecurityCommand = createSecurityCommandService({ store: controlled.store, createId: ids(), now: () => now, reportSecuritySignal() {} });
  const service = createTenantRbacRolloutCommandService({
    executeSecurityCommand,
    now: () => now,
    async reauthenticateProvider(input) { return { providerUserId: input.actorUserId, proofId: input.proofId, verifiedAt: now }; },
  });
  const result = await service.execute({
    principal: { kind: "authenticated-user", userId: provider.userId },
    idempotencyKey: "rollout-command-1",
    tenantId: "tenant-1",
    expectedVersion: 1,
    expectedEpoch: BigInt(1),
    proofId: "reauth-proof-1",
    correlationId: "correlation-1",
    transition: { surface: "http", toMode: "intersection", expectedEpoch: BigInt(1), reason: "internal canary" },
  });
  assert.equal(result.result.httpMode, "intersection");
  assert.equal(controlled.snapshot().auditEvents[0]?.eventType, "tenant_rbac_rollout.transitioned");
  assert.equal(controlled.snapshot().state[0]?.version, 2);
});

test("rollout command rejects non-Provider actors before state mutation", async () => {
  const tenantActor = { kind: "tenant-user" as const, userId: "tenant-user", tenantId: "tenant-1", displayName: "Tenant", email: "tenant@example.test" };
  const controlled = createControlledSecurityCommandStore({ actors: { [tenantActor.userId]: tenantActor }, initialState: [{ id: "tenant-1", version: 1, value: stored(base) }] });
  const executeSecurityCommand = createSecurityCommandService({ store: controlled.store, createId: ids(), now: () => now, reportSecuritySignal() {} });
  const service = createTenantRbacRolloutCommandService({ executeSecurityCommand, now: () => now, async reauthenticateProvider() { throw new Error("must not call"); } });
  await assert.rejects(service.execute({ principal: { kind: "authenticated-user", userId: tenantActor.userId }, idempotencyKey: "rollout-command-2", tenantId: "tenant-1", expectedVersion: 1, expectedEpoch: BigInt(1), proofId: "proof", correlationId: "correlation-2", transition: { surface: "http", toMode: "intersection", expectedEpoch: BigInt(1), reason: "no" } }), (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied");
  assert.equal(controlled.snapshot().state[0]?.version, 1);
});
