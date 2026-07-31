import { createHash } from "node:crypto";

import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  resolveActivePermission,
  tenantOperationMap,
  type ContextualPolicy,
  type OperationEntitlement,
  type TenantOperationDefinition,
} from "@/lib/authorization/tenant-rbac-contract";

export const TENANT_AUTHORIZATION_RESOLVER_VERSION = "tenant-authorization@1";

export type TenantAuthorizationSurface = "page" | "api" | "worker";
export type TenantAuthorizationMode = "legacy" | "intersection" | "rbac" | "rbac-emergency";
export type TenantAuthorizationExternalDenial =
  | Readonly<{ kind: "login-required"; status: 401 }>
  | Readonly<{ kind: "forbidden"; status: 403 }>
  | Readonly<{ kind: "not-found"; status: 404 }>;

export type TenantAuthorizationDenialCode =
  | "no-session"
  | "account-missing"
  | "account-inactive"
  | "tenant-missing"
  | "tenant-mismatch"
  | "identity-kind-rejected"
  | "activation-incomplete"
  | "tenant-unavailable"
  | "read-only"
  | "entitlement-disabled"
  | "unknown-operation"
  | "unknown-permission"
  | "permission-denied"
  | "scope-denied"
  | "invariant-denied"
  | "rollout-missing"
  | "rollout-version-unsupported"
  | "rollout-epoch-stale"
  | "emergency-policy-unsupported"
  | "store-unavailable";

export type TenantAuthorizationStage =
  | "authentication"
  | "account"
  | "tenant-resolution"
  | "tenant-membership"
  | "identity-kind"
  | "activation"
  | "tenant-state"
  | "entitlement"
  | "permission-configuration"
  | "effective-permission"
  | "context"
  | "invariant"
  | "rollout"
  | "persistence";

export type TenantAuthorizationInternalDenial = Readonly<{
  code: TenantAuthorizationDenialCode;
  stage: TenantAuthorizationStage;
  operationId: string;
}>;

export type LegacyAuthorizationDecision = Readonly<{
  allowed: boolean;
  reason: string;
}>;

export type TenantAuthorizationRollout = Readonly<{