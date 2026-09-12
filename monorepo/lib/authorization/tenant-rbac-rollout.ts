import { createHash, timingSafeEqual } from "node:crypto";

import { canonicalJson, SecurityCommandError, type JsonValue } from "@/lib/authorization/security-command";
import { resolveActivePermission, tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";

export const ROLLOUT_POLICY_VERSION = "tenant-rbac-rollout@1";
export const EMERGENCY_OVERLAY_POLICY_VERSION = "emergency@1";
export const ROLLOUT_SURFACES = ["http", "worker"] as const;
export type RolloutSurface = (typeof ROLLOUT_SURFACES)[number];
export type RolloutMode = "legacy" | "intersection" | "rbac" | "rbac-emergency";

export type RolloutState = Readonly<{
  httpMode: RolloutMode;
  workerMode: RolloutMode;
  epoch: bigint;
  version: number;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
  emergencyOverlay: EmergencyOverlay | null;
  multiRoleAcceptedAt: Date | null;
  legacyAuthorityDisabledAt: Date | null;
  rollbackEligible: boolean;
}>;

export type PromotionEvidence = Readonly<{
  cohort: string;
  contractDigest: string;
  sourceWatermark: string;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
  rolloutVersion: number;
  approverIds: readonly string[];
  observedFrom: Date;
  observedUntil: Date;
  checks: Readonly<{
    noUnexplainedWidening: boolean;
    isolationMatch: boolean;
    nextRequestRevocation: boolean;
    workerExecution: boolean;
    auditIntegrity: boolean;
    supportedVersion: boolean;
    schoolAdminCoverage: boolean;
  }>;
}>;

export type EmergencyOverlay = Readonly<{
  overlayHash: string;
  deniedOperationIds: readonly string[];
  deniedPermissionKeys: readonly string[];
  denyMutations: boolean;
  policyVersion: string;
  reviewAt: Date;
  expiresAt: Date;
}>;

export type RolloutTransition = Readonly<{
  surface: RolloutSurface | "both";
  toMode: RolloutMode;
  expectedEpoch: bigint;
  reason: string;
  evidence?: PromotionEvidence;
  emergencyOverlay?: EmergencyOverlay;
  exitEvidence?: Readonly<{ verified: boolean; evidenceDigest: string; reviewedAt: Date }>;
}>;

const HASH = /^[a-f0-9]{64}$/;

const GATES = [
  "noUnexplainedWidening",
  "isolationMatch",
  "nextRequestRevocation",
  "workerExecution",
  "auditIntegrity",
  "supportedVersion",
  "schoolAdminCoverage",
] as const;

function fail(message: string): never {
  const error = new SecurityCommandError("invalid-command");
  error.message = message;
  throw error;
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) fail(`invalid-rollout-date:${field}`);
}

function assertEvidence(evidence: PromotionEvidence, state: RolloutState): void {
  if (!evidence.cohort.trim() || evidence.cohort.length > 128) fail("invalid-rollout-cohort");
  if (!HASH.test(evidence.contractDigest)) fail("invalid-rollout-contract-digest");
  if (!evidence.sourceWatermark.trim() || evidence.sourceWatermark.length > 255) fail("invalid-rollout-watermark");
  if (evidence.resolverVersion !== state.resolverVersion || evidence.registryVersion !== state.registryVersion || evidence.operationMapVersion !== state.operationMapVersion) {
    fail("rollout-evidence-version-mismatch");
  }
  if (evidence.rolloutVersion !== state.version || evidence.approverIds.length === 0 || new Set(evidence.approverIds).size !== evidence.approverIds.length) {
    fail("rollout-evidence-approval-missing");
  }
  assertDate(evidence.observedFrom, "observedFrom");
  assertDate(evidence.observedUntil, "observedUntil");
  if (evidence.observedUntil.getTime() <= evidence.observedFrom.getTime()) fail("rollout-observation-window-invalid");
  for (const gate of GATES) if (!evidence.checks[gate]) fail(`rollout-gate-failed:${gate}`);
}

type EmergencyOverlayBody = Omit<EmergencyOverlay, "overlayHash">;

function canonicalEmergencyOverlayBody(overlay: EmergencyOverlayBody): JsonValue {
  return {
    deniedOperationIds: [...overlay.deniedOperationIds].sort(),
    deniedPermissionKeys: [...overlay.deniedPermissionKeys].sort(),
    denyMutations: overlay.denyMutations,
    policyVersion: overlay.policyVersion,
    reviewAt: overlay.reviewAt.toISOString(),
    expiresAt: overlay.expiresAt.toISOString(),
  };
}

export function emergencyOverlayDigest(overlay: EmergencyOverlayBody): string {
  return createHash("sha256").update(canonicalJson(canonicalEmergencyOverlayBody(overlay)), "utf8").digest("hex");
}

export function validateEmergencyOverlay(overlay: EmergencyOverlay, now?: Date): EmergencyOverlay {
  if (!Array.isArray(overlay.deniedOperationIds) || !Array.isArray(overlay.deniedPermissionKeys) || typeof overlay.denyMutations !== "boolean") fail("emergency-overlay-invalid");
  if (overlay.policyVersion !== EMERGENCY_OVERLAY_POLICY_VERSION) fail("emergency-overlay-invalid");
  assertDate(overlay.reviewAt, "reviewAt");
  assertDate(overlay.expiresAt, "expiresAt");
  if (overlay.reviewAt.getTime() > overlay.expiresAt.getTime() || (now && overlay.expiresAt.getTime() <= now.getTime())) fail("emergency-overlay-expired");

  const deniedOperationIds = [...overlay.deniedOperationIds].sort();
  const deniedPermissionKeys = [...overlay.deniedPermissionKeys].sort();
  if (
    new Set(deniedOperationIds).size !== deniedOperationIds.length
    || new Set(deniedPermissionKeys).size !== deniedPermissionKeys.length
    || deniedOperationIds.some((id) => !tenantOperationMap.some((operation) => operation.id === id && operation.lifecycle === "active"))
    || deniedPermissionKeys.some((key) => !resolveActivePermission(key))
  ) fail("emergency-overlay-invalid");

  const canonical: EmergencyOverlay = {
    overlayHash: overlay.overlayHash,
    deniedOperationIds,
    deniedPermissionKeys,
    denyMutations: overlay.denyMutations,
    policyVersion: overlay.policyVersion,
    reviewAt: new Date(overlay.reviewAt),
    expiresAt: new Date(overlay.expiresAt),
  };
  const digest = emergencyOverlayDigest(canonical);
  if (!HASH.test(overlay.overlayHash) || !timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(overlay.overlayHash, "hex"))) {
    fail("emergency-overlay-integrity-failure");
  }
  return Object.freeze(canonical);
}

export function assertNarrowingEmergencyOverlay(overlay: EmergencyOverlay): void {
  validateEmergencyOverlay(overlay);
}

function nextMode(current: RolloutMode, target: RolloutMode): boolean {
  return (current === "legacy" && target === "intersection") || (current === "intersection" && target === "rbac");
}

function transitionSurface(state: RolloutState, surface: RolloutSurface): RolloutMode {
  return surface === "http" ? state.httpMode : state.workerMode;
}

export function planRolloutTransition(state: RolloutState, transition: RolloutTransition, now: Date): RolloutState {
  assertDate(now, "now");
  if (transition.expectedEpoch !== state.epoch) fail("rollout-epoch-stale");
  if (!transition.reason.trim() || transition.reason.length > 1000) fail("rollout-reason-invalid");
  if (!Number.isSafeInteger(state.version) || state.version < 1 || state.epoch < BigInt(1)) fail("rollout-state-invalid");

  if (transition.toMode === "rbac-emergency") {
    if (transition.surface !== "both" || (state.httpMode !== "rbac" && state.httpMode !== "rbac-emergency") || (state.workerMode !== "rbac" && state.workerMode !== "rbac-emergency")) fail("emergency-requires-rbac-both-surfaces");
    if (!transition.emergencyOverlay) fail("emergency-overlay-required");
    const emergencyOverlay = validateEmergencyOverlay(transition.emergencyOverlay, now);
    return { ...state, httpMode: "rbac-emergency", workerMode: "rbac-emergency", epoch: state.epoch + BigInt(1), version: state.version + 1, emergencyOverlay };
  }


  const surfaces = transition.surface === "both" ? ROLLOUT_SURFACES : [transition.surface];
  for (const surface of surfaces) {
    const current = transitionSurface(state, surface);
    if (current === "rbac-emergency") fail("emergency-exit-requires-exit-command");
    if (!nextMode(current, transition.toMode)) fail("rollout-transition-not-monotonic");
  }
  if (transition.toMode === "rbac" && !transition.evidence) fail("promotion-evidence-required");
  if (transition.evidence) assertEvidence(transition.evidence, state);

  const next: RolloutState = {
    ...state,
    httpMode: surfaces.includes("http") ? transition.toMode : state.httpMode,
    workerMode: surfaces.includes("worker") ? transition.toMode : state.workerMode,
    epoch: state.epoch + BigInt(1),
    version: state.version + 1,
    emergencyOverlay: null,
    multiRoleAcceptedAt: transition.toMode === "rbac" && state.multiRoleAcceptedAt === null ? now : state.multiRoleAcceptedAt,
    legacyAuthorityDisabledAt: transition.toMode === "rbac" && state.legacyAuthorityDisabledAt === null ? now : state.legacyAuthorityDisabledAt,
    rollbackEligible: transition.toMode === "rbac" ? false : state.rollbackEligible,
  };
  if (next.multiRoleAcceptedAt !== null && next.rollbackEligible) fail("rollback-invariant-violated");
  return next;
}

export function planEmergencyExit(state: RolloutState, transition: RolloutTransition): RolloutState {
  if (transition.surface !== "both" || transition.toMode !== "rbac" || state.httpMode !== "rbac-emergency" || state.workerMode !== "rbac-emergency") fail("invalid-emergency-exit");
  if (!transition.exitEvidence?.verified || !HASH.test(transition.exitEvidence.evidenceDigest)) fail("emergency-exit-evidence-required");
  if (transition.expectedEpoch !== state.epoch) fail("rollout-epoch-stale");
  assertDate(transition.exitEvidence.reviewedAt, "exitEvidence.reviewedAt");
  return { ...state, httpMode: "rbac", workerMode: "rbac", epoch: state.epoch + BigInt(1), version: state.version + 1, emergencyOverlay: null };
}

export function planLegacyRollback(state: RolloutState, expectedEpoch: bigint): RolloutState {
  if (expectedEpoch !== state.epoch) fail("rollout-epoch-stale");
  if (!state.rollbackEligible || state.multiRoleAcceptedAt !== null || state.legacyAuthorityDisabledAt !== null) fail("legacy-rollback-forbidden");
  if (state.httpMode === "rbac-emergency" || state.workerMode === "rbac-emergency") fail("legacy-rollback-forbidden");
  return { ...state, httpMode: "legacy", workerMode: "legacy", epoch: state.epoch + BigInt(1), version: state.version + 1 };
}
