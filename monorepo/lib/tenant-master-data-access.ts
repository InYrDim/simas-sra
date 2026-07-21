import type { TenantRole } from "@/types/TenantRole";

export type MasterDataOperation = "read" | "write" | "download-template" | "validate-import" | "execute-import";
export type MasterDataFeaturePolicy = Readonly<{ read: boolean; write: boolean; importDownload?: boolean; importValidation?: boolean; importExecution?: boolean }>;
export type MasterDataCapabilities = Readonly<{
  read: boolean;
  write: boolean;
  downloadTemplate: boolean;
}>;

export type MasterDataPrincipal = Readonly<{
  userId: string;
  tenantId: string;
  role: "school-admin";
  capabilities: MasterDataCapabilities;
}>;

export type MasterDataAccessSnapshot = Readonly<{
  session: Readonly<{ userId: string; tenantId: string | null; tenantRole: TenantRole | null }>;
  requestedDomain: string;
  tenant: Readonly<{
    id: string;
    domain: string;
    operationalStatus: string | null;
    trialEndsAt: Date | null;
    featurePolicy: MasterDataFeaturePolicy;
  }> | null;
  operation: MasterDataOperation;
  now: Date;
}>;

export type MasterDataAccessResult =
  | { kind: "authorized"; principal: MasterDataPrincipal }
  | { kind: "forbidden"; reason: "role" | "feature-disabled" | "read-only" }
  | { kind: "not-found" };

function capabilitiesFor(snapshot: MasterDataAccessSnapshot): MasterDataCapabilities | null {
  const tenant = snapshot.tenant;
  if (!tenant || tenant.operationalStatus === "closed") return null;
  if (tenant.operationalStatus === "suspended") {
    return { read: true, write: false, downloadTemplate: false };
  }
  if (tenant.operationalStatus !== "active") return null;

  const trialExpired = tenant.trialEndsAt !== null && tenant.trialEndsAt.getTime() <= snapshot.now.getTime();
  return trialExpired
    ? { read: true, write: false, downloadTemplate: true }
    : { read: true, write: true, downloadTemplate: true };
}

export function authorizeMasterDataAccess(snapshot: MasterDataAccessSnapshot): MasterDataAccessResult {
  const tenant = snapshot.tenant;
  if (
    !tenant ||
    tenant.domain !== snapshot.requestedDomain ||
    snapshot.session.tenantId !== tenant.id
  ) return { kind: "not-found" };

  if (snapshot.session.tenantRole !== "school-admin") {
    return { kind: "forbidden", reason: "role" };
  }

  const capabilities = capabilitiesFor(snapshot);
  if (!capabilities) return { kind: "not-found" };

  const featureEnabled = snapshot.operation === "download-template"
    ? tenant.featurePolicy.importDownload === true
    : snapshot.operation === "validate-import"
      ? tenant.featurePolicy.importValidation === true
      : snapshot.operation === "execute-import"
        ? tenant.featurePolicy.importExecution === true
      : snapshot.operation === "write"
        ? tenant.featurePolicy.write
        : tenant.featurePolicy.read;
  if (!featureEnabled) return { kind: "forbidden", reason: "feature-disabled" };

  if (
    ((snapshot.operation === "write" || snapshot.operation === "validate-import" || snapshot.operation === "execute-import") && !capabilities.write) ||
    (snapshot.operation === "download-template" && !capabilities.downloadTemplate)
  ) return { kind: "forbidden", reason: "read-only" };

  return {
    kind: "authorized",
    principal: {
      userId: snapshot.session.userId,
      tenantId: tenant.id,
      role: "school-admin",
      capabilities,
    },
  };
}

export function authorizeMasterDataRecordAccess(
  principal: MasterDataPrincipal,
  record: Readonly<{ id: string; tenantId: string }> | null,
) {
  if (!record || record.tenantId !== principal.tenantId) return { kind: "not-found" } as const;
  return { kind: "authorized", principal, recordId: record.id } as const;
}
