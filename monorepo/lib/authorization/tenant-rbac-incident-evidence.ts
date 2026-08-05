export const TENANT_RBAC_INCIDENT_EVIDENCE_VERSION = "tenant-rbac-incident@1";

export type TenantRbacIncidentEvidence = Readonly<{
  evidenceVersion: typeof TENANT_RBAC_INCIDENT_EVIDENCE_VERSION;
  evidenceKind: "tenant-rbac-incident";
  synthetic: boolean;
  incidentId: string;
  tenantId: string;
  correlationIds: readonly string[];
  detectedAt: string;
  recordedAt: string;
  trigger: string;
  actorIds: readonly string[];
  providerReauthentication: Readonly<{ proofId: string; verifiedAt: string }>;
  reason: string;
  expectedEpoch: string;
  observedEpochBefore: string;
  impactPreviewDigest: string;
  policyHash: string;
  emergencyReviewAt: string;
  convergence: Readonly<{ httpMode: "rbac-emergency"; workerMode: "rbac-emergency"; httpEpoch: string; workerEpoch: string; verifiedAt: string }>;
  exit: null | Readonly<{ evidenceDigest: string; reviewedAt: string; observedEpochAfter: string; httpMode: "rbac"; workerMode: "rbac" }>;
  remainingBlockers: readonly string[];
}>;

const HASH = /^[a-f0-9]{64}$/;
const SECRET_KEY = /(password|passwd|secret|token|credential|database_url|mysql_pwd)/i;
const URL_CREDENTIAL = /:\/\/[^/\s:@]+:[^/\s@]+@/;

function validDate(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(new Date(value).getTime());
}

function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretKey);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => SECRET_KEY.test(key) || containsSecretKey(nested));
}

export function validateTenantRbacIncidentEvidence(value: unknown, options: Readonly<{ allowSynthetic?: boolean; requireExit?: boolean }> = {}): readonly string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["evidence-must-be-an-object"];
  const evidence = value as Partial<TenantRbacIncidentEvidence>;
  if (evidence.evidenceVersion !== TENANT_RBAC_INCIDENT_EVIDENCE_VERSION) errors.push("unsupported-evidence-version");
  if (evidence.evidenceKind !== "tenant-rbac-incident") errors.push("invalid-evidence-kind");
  if (evidence.synthetic && !options.allowSynthetic) errors.push("synthetic-evidence-is-not-real-evidence");
  if (!evidence.incidentId?.trim() || !evidence.tenantId?.trim() || !evidence.reason?.trim() || !evidence.trigger?.trim()) errors.push("incident-identity-trigger-and-reason-required");
  if (!evidence.correlationIds?.length || !evidence.actorIds?.length) errors.push("correlation-and-actor-identities-required");
  if (!validDate(evidence.detectedAt) || !validDate(evidence.recordedAt) || !validDate(evidence.emergencyReviewAt)) errors.push("valid-incident-timestamps-required");
  if (!evidence.providerReauthentication?.proofId?.trim() || !validDate(evidence.providerReauthentication?.verifiedAt)) errors.push("provider-reauthentication-evidence-required");
  if (!/^\d+$/.test(evidence.expectedEpoch ?? "") || !/^\d+$/.test(evidence.observedEpochBefore ?? "")) errors.push("valid-epochs-required");
  if (!HASH.test(evidence.impactPreviewDigest ?? "") || !HASH.test(evidence.policyHash ?? "")) errors.push("impact-preview-and-policy-hashes-required");
  if (!evidence.convergence || evidence.convergence.httpMode !== "rbac-emergency" || evidence.convergence.workerMode !== "rbac-emergency" || evidence.convergence.httpEpoch !== evidence.convergence.workerEpoch || !validDate(evidence.convergence.verifiedAt)) errors.push("http-worker-emergency-convergence-required");
  if (options.requireExit && !evidence.exit) errors.push("verified-exit-evidence-required");
  if (evidence.exit && (!HASH.test(evidence.exit.evidenceDigest) || evidence.exit.httpMode !== "rbac" || evidence.exit.workerMode !== "rbac" || !/^\d+$/.test(evidence.exit.observedEpochAfter) || !validDate(evidence.exit.reviewedAt))) errors.push("valid-exit-evidence-required");
  const serialized = JSON.stringify(value);
  if (URL_CREDENTIAL.test(serialized) || containsSecretKey(value)) errors.push("evidence-must-not-contain-secrets");
  return Object.freeze(errors);
}
