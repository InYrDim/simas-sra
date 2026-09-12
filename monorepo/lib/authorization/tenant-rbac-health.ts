export const TENANT_RBAC_HEALTH_CONTRACT_VERSION = "tenant-rbac-health@1";

export const TENANT_RBAC_STOP_CONDITIONS = [
  "unexplained-widening",
  "isolation-mismatch",
  "next-request-revocation-failure",
  "worker-execution-authorization-failure",
  "audit-integrity-failure",
  "unsupported-version",
  "school-admin-coverage-violation",
  "emergency-review-overdue",
  "http-worker-epoch-mismatch",
] as const;

export type TenantRbacStopCondition = (typeof TENANT_RBAC_STOP_CONDITIONS)[number];
export type TenantRbacHealthSeverity = "warning" | "blocking";
export type TenantRbacHealthStatus = "healthy" | "warning" | "blocking";
export type TenantRbacGateStatus = "passed" | "failed" | "unknown";

export type TenantRbacHealthSignal = Readonly<{
  contractVersion: typeof TENANT_RBAC_HEALTH_CONTRACT_VERSION;
  code: TenantRbacStopCondition | "promotion-evidence-unknown";
  severity: TenantRbacHealthSeverity;
  tenantId: string;
  surface: "http" | "worker" | "both";
  deduplicationKey: string;
  observedAt: string;
  safeDetails: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type TenantRbacHealthSnapshot = Readonly<{
  tenantId: string;
  httpMode: "legacy" | "intersection" | "rbac" | "rbac-emergency";
  workerMode: "legacy" | "intersection" | "rbac" | "rbac-emergency";
  httpEpoch: string;
  workerEpoch: string;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
  expectedVersions: Readonly<{ resolver: string; registry: string; operationMap: string }>;
  emergencyReviewAt: string | null;
  gates: Readonly<Record<"noUnexplainedWidening" | "isolationMatch" | "nextRequestRevocation" | "workerExecution" | "auditIntegrity" | "supportedVersion" | "schoolAdminCoverage", TenantRbacGateStatus>>;
}>;

const gateSignals = {
  noUnexplainedWidening: ["unexplained-widening", "both"],
  isolationMatch: ["isolation-mismatch", "both"],
  nextRequestRevocation: ["next-request-revocation-failure", "http"],
  workerExecution: ["worker-execution-authorization-failure", "worker"],
  auditIntegrity: ["audit-integrity-failure", "both"],
  supportedVersion: ["unsupported-version", "both"],
  schoolAdminCoverage: ["school-admin-coverage-violation", "both"],
} as const satisfies Record<keyof TenantRbacHealthSnapshot["gates"], readonly [TenantRbacStopCondition, "http" | "worker" | "both"]>;

function signal(input: Omit<TenantRbacHealthSignal, "contractVersion" | "deduplicationKey">): TenantRbacHealthSignal {
  return Object.freeze({
    ...input,
    contractVersion: TENANT_RBAC_HEALTH_CONTRACT_VERSION,
    deduplicationKey: `${TENANT_RBAC_HEALTH_CONTRACT_VERSION}:${input.tenantId}:${input.surface}:${input.code}`,
  });
}

export function evaluateTenantRbacHealth(snapshot: TenantRbacHealthSnapshot, now = new Date()): readonly TenantRbacHealthSignal[] {
  if (!snapshot.tenantId.trim() || Number.isNaN(now.getTime())) throw new Error("invalid-health-snapshot");
  const observedAt = now.toISOString();
  const signals: TenantRbacHealthSignal[] = [];

  for (const [gate, [code, surface]] of Object.entries(gateSignals) as [keyof typeof gateSignals, (typeof gateSignals)[keyof typeof gateSignals]][]) {
    const status = snapshot.gates[gate];
    if (status === "failed") signals.push(signal({ code, severity: "blocking", tenantId: snapshot.tenantId, surface, observedAt, safeDetails: { gate } }));
    else if (status === "unknown" && (snapshot.httpMode === "intersection" || snapshot.workerMode === "intersection")) {
      signals.push(signal({ code: "promotion-evidence-unknown", severity: "warning", tenantId: snapshot.tenantId, surface, observedAt, safeDetails: { gate } }));
    }
  }

  const versionsSupported = snapshot.resolverVersion === snapshot.expectedVersions.resolver
    && snapshot.registryVersion === snapshot.expectedVersions.registry
    && snapshot.operationMapVersion === snapshot.expectedVersions.operationMap;
  if (!versionsSupported && !signals.some((item) => item.code === "unsupported-version")) {
    signals.push(signal({ code: "unsupported-version", severity: "blocking", tenantId: snapshot.tenantId, surface: "both", observedAt, safeDetails: {
      resolverVersion: snapshot.resolverVersion,
      registryVersion: snapshot.registryVersion,
      operationMapVersion: snapshot.operationMapVersion,
    } }));
  }

  if (snapshot.httpEpoch !== snapshot.workerEpoch) {
    signals.push(signal({ code: "http-worker-epoch-mismatch", severity: "blocking", tenantId: snapshot.tenantId, surface: "both", observedAt, safeDetails: { httpEpoch: snapshot.httpEpoch, workerEpoch: snapshot.workerEpoch } }));
  }

  if (snapshot.httpMode === "rbac-emergency" || snapshot.workerMode === "rbac-emergency") {
    const reviewAt = snapshot.emergencyReviewAt ? new Date(snapshot.emergencyReviewAt) : null;
    if (!reviewAt || Number.isNaN(reviewAt.getTime()) || reviewAt.getTime() <= now.getTime()) {
      signals.push(signal({ code: "emergency-review-overdue", severity: "blocking", tenantId: snapshot.tenantId, surface: "both", observedAt, safeDetails: { emergencyReviewAt: snapshot.emergencyReviewAt } }));
    }
  }

  return Object.freeze(signals);
}

export function summarizeTenantRbacHealth(signals: readonly TenantRbacHealthSignal[]): Readonly<{ status: TenantRbacHealthStatus; blocking: number; warnings: number }> {
  const blocking = signals.filter((item) => item.severity === "blocking").length;
  const warnings = signals.filter((item) => item.severity === "warning").length;
  return Object.freeze({ status: blocking > 0 ? "blocking" : warnings > 0 ? "warning" : "healthy", blocking, warnings });
}

export function tenantRbacHealthExitCode(signals: readonly TenantRbacHealthSignal[]): 0 | 1 {
  return signals.some((item) => item.severity === "blocking") ? 1 : 0;
}
