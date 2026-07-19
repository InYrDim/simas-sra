export type CentralIdentitySnapshot = {
  providerAdmin: boolean;
  applicant: boolean;
  tenantMembership: { tenantId: string; domain: string | null; role: string | null } | null;
  activation: { passwordChangeRequired: boolean } | null;
};

export type CentralIdentity =
  | { kind: "provider-admin"; passwordChangeRequired?: boolean }
  | { kind: "applicant"; passwordChangeRequired?: boolean }
  | { kind: "tenant-member"; tenantId: string; domain: string; passwordChangeRequired: boolean }
  | { kind: "invalid"; reason: "no-identity-path" | "multiple-identity-paths" | "tenant-missing" | "tenant-role-missing" };

export function resolveCentralIdentity(snapshot: CentralIdentitySnapshot): CentralIdentity {
  const pathCount = Number(snapshot.providerAdmin) + Number(snapshot.applicant) + Number(snapshot.tenantMembership !== null);
  if (pathCount === 0) return { kind: "invalid", reason: "no-identity-path" };
  if (pathCount > 1) return { kind: "invalid", reason: "multiple-identity-paths" };
  const passwordChangeRequired = snapshot.activation?.passwordChangeRequired === true;
  if (snapshot.providerAdmin) return { kind: "provider-admin", passwordChangeRequired };
  if (snapshot.applicant) return { kind: "applicant", passwordChangeRequired };
  if (!snapshot.tenantMembership?.domain) return { kind: "invalid", reason: "tenant-missing" };
  if (!snapshot.tenantMembership.role) return { kind: "invalid", reason: "tenant-role-missing" };
  return {
    kind: "tenant-member",
    tenantId: snapshot.tenantMembership.tenantId,
    domain: snapshot.tenantMembership.domain,
    passwordChangeRequired,
  };
}

export function resolveCentralDestination(identity: CentralIdentity): string {
  if (identity.kind !== "invalid" && identity.passwordChangeRequired) return "/change-password";
  switch (identity.kind) {
    case "provider-admin": return "/provider";
    case "applicant": return "/apply";
    case "tenant-member": return identity.passwordChangeRequired ? "/change-password" : `/${identity.domain}/dashboard`;
    case "invalid": return "/access-error";
  }
}

type SecurityLogger = (event: { event: "central_auth_intent_rejected"; value: string }) => void;

export function resolveRawPublicIntent(search: string, log: SecurityLogger = console.warn): "apply" | null {
  const rawValues = search.replace(/^\?/, "").split("&").filter((part) => part.startsWith("intent=")).map((part) => part.slice(7));
  if (rawValues.length === 0) return null;
  if (rawValues.length === 1 && rawValues[0] === "apply") return "apply";
  log({ event: "central_auth_intent_rejected", value: rawValues.join(",") });
  return null;
}

export function resolvePublicIntent(value: string | string[] | undefined, log: SecurityLogger = console.warn): "apply" | null {
  if (value === undefined) return null;
  if (value === "apply") return "apply";
  log({ event: "central_auth_intent_rejected", value: Array.isArray(value) ? value.join(",") : value });
  return null;
}
