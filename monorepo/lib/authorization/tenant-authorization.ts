import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  resolveActivePermission,
  tenantOperationMap,
  type ContextualPolicy,
  type OperationEntitlement,
  type TenantOperationDefinition,
} from "@/lib/authorization/tenant-rbac-contract";
import { validateEmergencyOverlay, type EmergencyOverlay } from "@/lib/authorization/tenant-rbac-rollout";
import { isTenantFeatureEnabled, type TenantFeatureKey } from "@/lib/features/tenant-feature-policy";

export const TENANT_AUTHORIZATION_RESOLVER_VERSION = "tenant-authorization@2";

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

export type TenantAuthorizationRollout = Readonly<{
  httpMode: TenantAuthorizationMode;
  workerMode: TenantAuthorizationMode;
  epoch: bigint;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
  emergencyOverlay: EmergencyOverlay | null;
}>;

export type TenantAuthorizationAccount = Readonly<{
  userId: string;
  tenantId: string | null;
  selfPersonId?: string | null;
  accountLifecycle: "pending-activation" | "active" | "inactive" | null;
  providerAdmin: boolean;
  applicant: boolean;
  activationComplete: boolean;
}>;

export type TenantAuthorizationTenant = Readonly<{
  id: string;
  domain: string;
  npsn: string;
  operationalStatus: string | null;
  trialEndsAt: Date | null;
  settings: unknown;
}>;

export type TenantAuthorizationAssignment = Readonly<{
  assignmentId: string;
  assignmentState: string;
  roleId: string;
  roleLifecycle: string;
  permissionKeys: readonly string[];
}>;

export type TenantAuthorizationAuthority = Readonly<{
  schoolAdminAuthorityStates: readonly string[];
  assignments: readonly TenantAuthorizationAssignment[];
}>;

export interface TenantAuthorizationStore {
  loadAccount(userId: string): Promise<TenantAuthorizationAccount | null>;
  loadTenantByDomain(domain: string): Promise<TenantAuthorizationTenant | null>;
  loadAuthority(userId: string, tenantId: string): Promise<TenantAuthorizationAuthority>;
  loadRollout(tenantId: string): Promise<TenantAuthorizationRollout | null>;
}

export type TenantAuthorizationPrincipal = Readonly<{
  userId: string;
  tenantId: string;
  schoolAdmin: boolean;
  roleIds: readonly string[];
  permissions: ReadonlySet<string>;
  rolloutEpoch: bigint;
  selfPersonId?: string | null;
  readOnly: boolean;
}>;

export type TenantAuthorizationContextDecision = Readonly<{
  allowed: boolean;
  arm?: "assigned" | "self" | "tenant-wide";
}>;

export type TenantAuthorizationContext = Readonly<{
  policy: ContextualPolicy;
  evaluate(principal: TenantAuthorizationPrincipal): Promise<TenantAuthorizationContextDecision>;
}>;

export type TenantAuthorizationInvariant = Readonly<{
  evaluate(principal: TenantAuthorizationPrincipal): Promise<boolean>;
}>;

export type TenantAuthorizationRequest = Readonly<{
  sessionUserId: string | null;
  domain: string;
  operationId: string;
  surface: TenantAuthorizationSurface;
  requestedPermissions?: readonly string[];
  expectedRolloutEpoch?: bigint;
  context?: TenantAuthorizationContext;
  invariant?: TenantAuthorizationInvariant;
}>;



export type TenantAuthorizationDecision = Readonly<{
  allowed: boolean;
  denial: TenantAuthorizationInternalDenial | null;
}>;

export type TenantAuthorizationResult =
  | Readonly<{
      kind: "authorized";
      principal: TenantAuthorizationPrincipal;
      mode: TenantAuthorizationMode;
      rbac: TenantAuthorizationDecision;
    }>
  | Readonly<{
      kind: "denied";
      external: TenantAuthorizationExternalDenial;
      internal: TenantAuthorizationInternalDenial;
      mode: TenantAuthorizationMode;
      rbac: TenantAuthorizationDecision;
    }>;

export type TenantAuthorizationEvaluatorDependencies = Readonly<{
  store: TenantAuthorizationStore;
  now?: () => Date;
}>;

const operations = new Map(tenantOperationMap.map((operation) => [operation.id, operation]));

function denial(
  operationId: string,
  code: TenantAuthorizationDenialCode,
  stage: TenantAuthorizationStage,
): TenantAuthorizationInternalDenial {
  return { operationId, code, stage };
}

function externalDenial(value: TenantAuthorizationInternalDenial): TenantAuthorizationExternalDenial {
  if (value.code === "no-session") return { kind: "login-required", status: 401 };
  if (["tenant-missing", "tenant-mismatch", "scope-denied"].includes(value.code)) {
    return { kind: "not-found", status: 404 };
  }
  return { kind: "forbidden", status: 403 };
}

function modeFor(rollout: TenantAuthorizationRollout | null, surface: TenantAuthorizationSurface): TenantAuthorizationMode {
  if (!rollout) return "rbac";
  return surface === "worker" ? rollout.workerMode : rollout.httpMode;
}

function tenantStateDenial(
  operation: TenantOperationDefinition,
  tenant: TenantAuthorizationTenant,
  now: Date,
): TenantAuthorizationDenialCode | null {
  if (operation.operationalGate === "none") return null;
  if (tenant.operationalStatus === "closed" || tenant.operationalStatus === null) return "tenant-unavailable";
  if (tenant.operationalStatus !== "active" && tenant.operationalStatus !== "suspended") return "tenant-unavailable";
  if (operation.operationalGate === "write") {
    if (tenant.operationalStatus === "suspended") return "read-only";
    if (tenant.trialEndsAt && tenant.trialEndsAt.getTime() <= now.getTime()) return "read-only";
  }
  return null;
}

function entitlementFeature(operation: TenantOperationDefinition): TenantFeatureKey | null {
  if (operation.id === "people-imports.template.download" || operation.id === "people-imports.export") {
    return "masterDataImportDownload";
  }
  if (operation.id === "people-imports.upload") return "masterDataImportValidation";
  if (operation.id === "people-imports.execute") return "masterDataImportExecution";
  const entitlement: OperationEntitlement = operation.entitlement;
  if (entitlement === "MD") return operation.operationalGate === "write" ? "masterDataWrite" : "masterDataRead";
  if (entitlement === "PPDB-R") return "ppdbRead";
  if (entitlement === "PPDB-W") return "ppdbWrite";
  if (entitlement === "QUIZ-R") return "ulanganRead";
  if (entitlement === "QUIZ-W") return "ulanganWrite";
  return null;
}

function requestedPermissions(
  operation: TenantOperationDefinition,
  supplied: readonly string[] | undefined,
): readonly string[] | null {
  if (operation.permissionMode !== "conditional") return operation.requiredPermissions;
  if (!supplied?.length) return null;
  const unique = [...new Set(supplied)];
  return unique.every((key) => operation.requiredPermissions.includes(key)) ? unique : null;
}

function hasPermissions(
  operation: TenantOperationDefinition,
  required: readonly string[],
  effective: ReadonlySet<string>,
): boolean {
  if (operation.permissionMode === "any") return required.some((key) => effective.has(key));
  return required.every((key) => effective.has(key));
}

function activeAuthority(authority: TenantAuthorizationAuthority) {
  const schoolAdmin = authority.schoolAdminAuthorityStates.length === 1
    && authority.schoolAdminAuthorityStates[0] === "active";
  const roleIds = new Set<string>();
  const permissions = new Set<string>();

  for (const assignment of authority.assignments) {
    if (assignment.assignmentState !== "active" || assignment.roleLifecycle !== "active") continue;
    const rolePermissionKeys = new Set(assignment.permissionKeys);
    const rolePermissions = assignment.permissionKeys.map(resolveActivePermission);
    const validRole = rolePermissions.every((permission) =>
      permission?.assignment === "tenant-assignable" &&
      permission.dependencies.every((dependency) => rolePermissionKeys.has(dependency)),
    );
    if (!validRole) continue;
    roleIds.add(assignment.roleId);
    for (const permission of rolePermissions) {
      if (permission) permissions.add(permission.key);
    }
  }

  if (schoolAdmin) {
    for (const operation of tenantOperationMap) {
      if (operation.lifecycle !== "active") continue;
      for (const key of operation.requiredPermissions) {
        if (resolveActivePermission(key)) permissions.add(key);
      }
    }
  }

  return { schoolAdmin, roleIds: [...roleIds].sort(), permissions };
}

function rolloutDenial(
  request: TenantAuthorizationRequest,
  operation: TenantOperationDefinition,
  rollout: TenantAuthorizationRollout | null,
  now: Date,
): TenantAuthorizationInternalDenial | null {
  if (!rollout) return denial(request.operationId, "rollout-missing", "rollout");
  const supportedModes = new Set<TenantAuthorizationMode>(["rbac", "rbac-emergency"]);
  if (
    !supportedModes.has(rollout.httpMode) ||
    !supportedModes.has(rollout.workerMode) ||
    rollout.epoch < BigInt(1) ||
    rollout.resolverVersion !== TENANT_AUTHORIZATION_RESOLVER_VERSION ||
    rollout.registryVersion !== PERMISSION_REGISTRY_VERSION ||
    rollout.operationMapVersion !== OPERATION_MAP_VERSION
  ) return denial(request.operationId, "rollout-version-unsupported", "rollout");
  if (
    request.expectedRolloutEpoch !== undefined &&
    request.expectedRolloutEpoch !== rollout.epoch
  ) return denial(request.operationId, "rollout-epoch-stale", "rollout");
  if (request.surface === "worker" && operation.operationalGate === "write" && request.expectedRolloutEpoch === undefined) {
    return denial(request.operationId, "rollout-epoch-stale", "rollout");
  }

  const mode = modeFor(rollout, request.surface);
  if (mode !== "rbac-emergency") return null;
  if (rollout.httpMode !== "rbac-emergency" || rollout.workerMode !== "rbac-emergency" || !rollout.emergencyOverlay) {
    return denial(request.operationId, "emergency-policy-unsupported", "rollout");
  }
  try {
    validateEmergencyOverlay(rollout.emergencyOverlay, now);
    return null;
  } catch {
    return denial(request.operationId, "emergency-policy-unsupported", "rollout");
  }
}

function emergencyDenies(
  request: TenantAuthorizationRequest,
  operation: TenantOperationDefinition,
  rollout: TenantAuthorizationRollout | null,
  required: readonly string[],
): boolean {
  if (!rollout || modeFor(rollout, request.surface) !== "rbac-emergency" || !rollout.emergencyOverlay) return false;
  const policy = rollout.emergencyOverlay;
  return Boolean(
    policy.deniedOperationIds.includes(operation.id) ||
    required.some((key) => policy.deniedPermissionKeys.includes(key)) ||
    (policy.denyMutations && operation.operationalGate === "write"),
  );
}



export function createTenantAuthorizationEvaluator(dependencies: TenantAuthorizationEvaluatorDependencies) {
  const accountMemo = new Map<string, Promise<TenantAuthorizationAccount | null>>();
  const tenantMemo = new Map<string, Promise<TenantAuthorizationTenant | null>>();
  const authorityMemo = new Map<string, Promise<TenantAuthorizationAuthority>>();
  const rolloutMemo = new Map<string, Promise<TenantAuthorizationRollout | null>>();
  const now = dependencies.now ?? (() => new Date());

  const loadAccount = (userId: string) => {
    const existing = accountMemo.get(userId);
    if (existing) return existing;
    const pending = dependencies.store.loadAccount(userId);
    accountMemo.set(userId, pending);
    return pending;
  };
  const loadTenant = (domain: string) => {
    const existing = tenantMemo.get(domain);
    if (existing) return existing;
    const pending = dependencies.store.loadTenantByDomain(domain);
    tenantMemo.set(domain, pending);
    return pending;
  };
  const loadAuthority = (userId: string, tenantId: string) => {
    const key = `${userId}\u0000${tenantId}`;
    const existing = authorityMemo.get(key);
    if (existing) return existing;
    const pending = dependencies.store.loadAuthority(userId, tenantId);
    authorityMemo.set(key, pending);
    return pending;
  };
  const loadRollout = (tenantId: string) => {
    const existing = rolloutMemo.get(tenantId);
    if (existing) return existing;
    const pending = dependencies.store.loadRollout(tenantId);
    rolloutMemo.set(tenantId, pending);
    return pending;
  };

  async function evaluate(request: TenantAuthorizationRequest): Promise<TenantAuthorizationResult> {
    const operation = operations.get(request.operationId);
    let rollout: TenantAuthorizationRollout | null = null;
    let principal: TenantAuthorizationPrincipal | null = null;
    let rbacDenial: TenantAuthorizationInternalDenial | null = null;

    try {
      if (!request.sessionUserId) {
        rbacDenial = denial(request.operationId, "no-session", "authentication");
      }

      const account = request.sessionUserId ? await loadAccount(request.sessionUserId) : null;
      if (!rbacDenial && !account) rbacDenial = denial(request.operationId, "account-missing", "account");
      if (
        !rbacDenial &&
        account?.accountLifecycle !== null &&
        account?.accountLifecycle !== "active" &&
        account?.accountLifecycle !== "pending-activation"
      ) {
        rbacDenial = denial(request.operationId, "account-inactive", "account");
      }

      const tenant = !rbacDenial ? await loadTenant(request.domain) : null;
      if (!rbacDenial && !tenant) rbacDenial = denial(request.operationId, "tenant-missing", "tenant-resolution");
      if (!rbacDenial && account && tenant && account.tenantId !== tenant.id) {
        rbacDenial = denial(request.operationId, "tenant-mismatch", "tenant-membership");
      }
      if (!rbacDenial && account && (account.providerAdmin || account.applicant)) {
        rbacDenial = denial(request.operationId, "identity-kind-rejected", "identity-kind");
      }
      if (!rbacDenial && account && !account.activationComplete) {
        rbacDenial = denial(request.operationId, "activation-incomplete", "activation");
      }
      if (!rbacDenial && account?.accountLifecycle === "pending-activation") {
        rbacDenial = denial(request.operationId, "activation-incomplete", "activation");
      }

      if (!operation && !rbacDenial) {
        rbacDenial = denial(request.operationId, "unknown-operation", "permission-configuration");
      }
      const stateProblem = operation && tenant ? tenantStateDenial(operation, tenant, now()) : null;
      if (!rbacDenial && stateProblem) {
        rbacDenial = denial(request.operationId, stateProblem, "tenant-state");
      }
      const feature = operation ? entitlementFeature(operation) : null;
      if (!rbacDenial && feature && tenant && !isTenantFeatureEnabled(tenant.settings, feature)) {
        rbacDenial = denial(request.operationId, "entitlement-disabled", "entitlement");
      }

      const required: readonly string[] | null = operation ? requestedPermissions(operation, request.requestedPermissions) : null;
      if (!rbacDenial && (!operation || operation.lifecycle !== "active" || !required)) {
        rbacDenial = denial(request.operationId, operation ? "unknown-permission" : "unknown-operation", "permission-configuration");
      }
      if (!rbacDenial && required?.some((key) => !resolveActivePermission(key))) {
        rbacDenial = denial(request.operationId, "unknown-permission", "permission-configuration");
      }

      if (!rbacDenial && account && tenant && operation) {
        rollout = await loadRollout(tenant.id);
        let effective: ReturnType<typeof activeAuthority> | null = null;
        try {
          effective = activeAuthority(await loadAuthority(account.userId, tenant.id));
        } catch {
          rbacDenial = denial(request.operationId, "store-unavailable", "persistence");
        }
        principal = {
          userId: account.userId,
          tenantId: tenant.id,
          schoolAdmin: effective?.schoolAdmin ?? false,
          roleIds: effective?.roleIds ?? [],
          permissions: effective?.permissions ?? new Set<string>(),
          rolloutEpoch: rollout?.epoch ?? BigInt(0),
          selfPersonId: account?.selfPersonId ?? null,
          readOnly: tenant.operationalStatus === "suspended" || (tenant.trialEndsAt !== null && tenant.trialEndsAt.getTime() <= now().getTime()),
        };

        if (!rbacDenial && required && effective && !hasPermissions(operation, required, effective.permissions)) {
          rbacDenial = denial(request.operationId, "permission-denied", "effective-permission");
        }
        if (!rbacDenial && operation.contextualPolicy === "school-admin-only" && !effective?.schoolAdmin) {
          rbacDenial = denial(request.operationId, "permission-denied", "effective-permission");
        }
        if (!rbacDenial && !effective?.schoolAdmin && !["tenant-wide", "none", "school-admin-only"].includes(operation.contextualPolicy)) {
          if (!request.context || request.context.policy !== operation.contextualPolicy) {
            rbacDenial = denial(request.operationId, "scope-denied", "context");
          } else {
            try {
              const context = await request.context.evaluate(principal);
              const allowedArms = new Set(operation.contextualArms);
              if (!context.allowed || !context.arm || !allowedArms.has(context.arm)) {
                rbacDenial = denial(request.operationId, "scope-denied", "context");
              }
            } catch {
              rbacDenial = denial(request.operationId, "store-unavailable", "persistence");
            }
          }
        }
        if (!rbacDenial && request.invariant) {
          try {
            if (!await request.invariant.evaluate(principal)) {
              rbacDenial = denial(request.operationId, "invariant-denied", "invariant");
            }
          } catch {
            rbacDenial = denial(request.operationId, "store-unavailable", "persistence");
          }
        }

        const rolloutProblem = rolloutDenial(request, operation, rollout, now());
        if (rolloutProblem && (!rbacDenial || operation.operationalGate === "write")) {
          rbacDenial = rolloutProblem;
        }
        if (!rbacDenial && emergencyDenies(request, operation, rollout, required ?? [])) {
          rbacDenial = denial(request.operationId, "permission-denied", "effective-permission");
        }
      }
    } catch {
      const unavailable = denial(request.operationId, "store-unavailable", "persistence");
      rbacDenial ??= unavailable;
    }

    const mode = modeFor(rollout, request.surface);
    const rbac: TenantAuthorizationDecision = { allowed: !rbacDenial, denial: rbacDenial };
    if (rbac.allowed && principal) return { kind: "authorized", principal, mode, rbac };

    const visibleDenial = rbacDenial ?? denial(request.operationId, "permission-denied", "effective-permission");
    return { kind: "denied", external: externalDenial(visibleDenial), internal: visibleDenial, mode, rbac };
  }

  return Object.freeze({ evaluate });
}
