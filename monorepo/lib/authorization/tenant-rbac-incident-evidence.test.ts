import assert from "node:assert/strict";
import test from "node:test";

import { TENANT_RBAC_INCIDENT_EVIDENCE_VERSION, validateTenantRbacIncidentEvidence } from "@/lib/authorization/tenant-rbac-incident-evidence";

const evidence = {
  evidenceVersion: TENANT_RBAC_INCIDENT_EVIDENCE_VERSION, evidenceKind: "tenant-rbac-incident", synthetic: false,
  incidentId: "INC-32-001", tenantId: "tenant-1", correlationIds: ["corr-1"], detectedAt: "2026-08-05T10:00:00.000Z", recordedAt: "2026-08-05T10:02:00.000Z",
  trigger: "isolation-mismatch", actorIds: ["provider-1"], providerReauthentication: { proofId: "proof-reference-1", verifiedAt: "2026-08-05T10:03:00.000Z" },
  reason: "Narrow mutations while investigating", expectedEpoch: "7", observedEpochBefore: "7", impactPreviewDigest: "a".repeat(64), policyHash: "b".repeat(64), emergencyReviewAt: "2026-08-05T11:00:00.000Z",
  convergence: { httpMode: "rbac-emergency", workerMode: "rbac-emergency", httpEpoch: "8", workerEpoch: "8", verifiedAt: "2026-08-05T10:04:00.000Z" },
  exit: { evidenceDigest: "c".repeat(64), reviewedAt: "2026-08-05T10:40:00.000Z", observedEpochAfter: "9", httpMode: "rbac", workerMode: "rbac" }, remainingBlockers: [],
} as const;

test("complete real incident evidence validates including converged entry and verified exit", () => {
  assert.deepEqual(validateTenantRbacIncidentEvidence(evidence, { requireExit: true }), []);
});

test("incident evidence rejects missing reauthentication, convergence, and exit", () => {
  const invalid = { ...evidence, providerReauthentication: { proofId: "", verifiedAt: "invalid" }, convergence: { ...evidence.convergence, workerEpoch: "9" }, exit: null };
  const errors = validateTenantRbacIncidentEvidence(invalid, { requireExit: true });
  assert.ok(errors.includes("provider-reauthentication-evidence-required"));
  assert.ok(errors.includes("http-worker-emergency-convergence-required"));
  assert.ok(errors.includes("verified-exit-evidence-required"));
});

test("synthetic examples cannot be accepted as real incident evidence", () => {
  assert.deepEqual(validateTenantRbacIncidentEvidence({ ...evidence, synthetic: true }), ["synthetic-evidence-is-not-real-evidence"]);
  assert.deepEqual(validateTenantRbacIncidentEvidence({ ...evidence, synthetic: true }, { allowSynthetic: true }), []);
  assert.ok(validateTenantRbacIncidentEvidence({ ...evidence, notes: { nestedPassword: "do-not-store" } }).includes("evidence-must-not-contain-secrets"));
});
