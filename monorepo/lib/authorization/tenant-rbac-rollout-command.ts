

import {
  createSecurityCommandService,
  SecurityCommandError,
  securityAuditEvidence,
  type SecurityPrincipal,
  type JsonValue,
} from "@/lib/authorization/security-command";
import type { ControlledSecurityCommandTransaction } from "@/lib/authorization/security-command-controlled-store";
import { TENANT_AUTHORIZATION_RESOLVER_VERSION } from "@/lib/authorization/tenant-authorization";
import {
  planEmergencyExit,
  planRolloutTransition,
  type RolloutState,
  type RolloutTransition,
} from "@/lib/authorization/tenant-rbac-rollout";

export type StoredRolloutState = Readonly<{
  httpMode: RolloutState["httpMode"];
  workerMode: RolloutState["workerMode"];
  epoch: string;
  version: number;
  resolverVersion: string;
  registryVersion: string;
  operationMapVersion: string;
  emergencyOverlay: Readonly<{
    overlayHash: string;
    deniedOperationIds: readonly string[];
    deniedPermissionKeys: readonly string[];
    denyMutations: boolean;
    policyVersion: string;
    reviewAt: string;
    expiresAt: string;
  }> | null;
  multiRoleAcceptedAt: string | null;
  legacyAuthorityDisabledAt: string | null;
  rollbackEligible: boolean;
}>;

type RolloutTransaction = ControlledSecurityCommandTransaction;

type Reauthentication = Readonly<{
  providerUserId: string;
  verifiedAt: Date;
  proofId: string;
}>;

function invalid(): never {
  throw new SecurityCommandError("invalid-command");
}

function storedState(state: RolloutState): StoredRolloutState {
  return {
    ...state,
    epoch: state.epoch.toString(),
    emergencyOverlay: state.emergencyOverlay ? {
      ...state.emergencyOverlay,
      reviewAt: state.emergencyOverlay.reviewAt.toISOString(),
      expiresAt: state.emergencyOverlay.expiresAt.toISOString(),
    } : null,
    multiRoleAcceptedAt: state.multiRoleAcceptedAt?.toISOString() ?? null,
    legacyAuthorityDisabledAt: state.legacyAuthorityDisabledAt?.toISOString() ?? null,
  };
}

function rolloutState(value: JsonValue): RolloutState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const row = value as Record<string, JsonValue>;
  const date = (key: string): Date | null => {
    const value = row[key];
    if (value === null) return null;
    if (typeof value !== "string") invalid();
    const result = new Date(value);
    if (Number.isNaN(result.getTime())) invalid();
    return result;
  };
  if (
    typeof row.httpMode !== "string" || typeof row.workerMode !== "string" || typeof row.epoch !== "string"
    || typeof row.version !== "number" || typeof row.resolverVersion !== "string" || typeof row.registryVersion !== "string"
    || typeof row.operationMapVersion !== "string" || typeof row.rollbackEligible !== "boolean"
  ) invalid();
  const emergencyValue = row.emergencyOverlay;
  let emergencyOverlay: RolloutState["emergencyOverlay"] = null;
  if (emergencyValue !== null) {
    if (typeof emergencyValue !== "object" || Array.isArray(emergencyValue)) invalid();
    const overlay = emergencyValue as Record<string, JsonValue>;
    if (
      typeof overlay.overlayHash !== "string" || !Array.isArray(overlay.deniedOperationIds)
      || !overlay.deniedOperationIds.every((value) => typeof value === "string")
      || !Array.isArray(overlay.deniedPermissionKeys) || !overlay.deniedPermissionKeys.every((value) => typeof value === "string")
      || typeof overlay.denyMutations !== "boolean" || typeof overlay.policyVersion !== "string"
      || typeof overlay.reviewAt !== "string" || typeof overlay.expiresAt !== "string"
    ) invalid();
    const reviewAt = new Date(overlay.reviewAt);
    const expiresAt = new Date(overlay.expiresAt);
    if (Number.isNaN(reviewAt.getTime()) || Number.isNaN(expiresAt.getTime())) invalid();
    emergencyOverlay = {
      overlayHash: overlay.overlayHash,
      deniedOperationIds: overlay.deniedOperationIds as string[],
      deniedPermissionKeys: overlay.deniedPermissionKeys as string[],
      denyMutations: overlay.denyMutations,
      policyVersion: overlay.policyVersion,
      reviewAt,
      expiresAt,
    };
  }
  return {
    httpMode: row.httpMode as RolloutState["httpMode"],
    workerMode: row.workerMode as RolloutState["workerMode"],
    epoch: BigInt(row.epoch),
    version: row.version,
    resolverVersion: row.resolverVersion,
    registryVersion: row.registryVersion,
    operationMapVersion: row.operationMapVersion,
    emergencyOverlay,
    multiRoleAcceptedAt: date("multiRoleAcceptedAt"),
    legacyAuthorityDisabledAt: date("legacyAuthorityDisabledAt"),
    rollbackEligible: row.rollbackEligible,
  };
}

function transitionPayload(transition: RolloutTransition): JsonValue {
  return JSON.parse(JSON.stringify(transition, (_, value) => value instanceof Date ? value.toISOString() : typeof value === "bigint" ? value.toString() : value)) as JsonValue;
}

export function createTenantRbacRolloutCommandService(options: Readonly<{
  executeSecurityCommand: ReturnType<typeof createSecurityCommandService<RolloutTransaction>>;
  now?: () => Date;
  reauthenticateProvider: (input: Readonly<{ actorUserId: string; proofId: string }>) => Promise<Reauthentication>;
}>) {
  const now = options.now ?? (() => new Date());

  async function requireProviderReauthentication(input: Readonly<{ actor: { kind: string; userId?: string }; proofId: string }>): Promise<void> {
    if (input.actor.kind !== "provider-admin" || !input.actor.userId) throw new SecurityCommandError("context-denied");
    const proof = await options.reauthenticateProvider({ actorUserId: input.actor.userId, proofId: input.proofId });
    if (proof.providerUserId !== input.actor.userId || proof.proofId !== input.proofId || Number.isNaN(proof.verifiedAt.getTime())) throw new SecurityCommandError("context-denied");
  }

  async function execute(input: Readonly<{
    principal: SecurityPrincipal;
    idempotencyKey: string;
    tenantId: string;
    expectedVersion: number;
    expectedEpoch: bigint;
    proofId: string;
    correlationId: string;
    requestId?: string;
    transition: RolloutTransition;
  }>) {
    return options.executeSecurityCommand({
      principal: input.principal,
      idempotencyKey: input.idempotencyKey,
      commandName: "tenant-rbac-rollout.transition",
      payload: { tenantId: input.tenantId, transition: transitionPayload(input.transition), proofId: input.proofId },
      expectedVersions: [{ resourceType: "tenant-rbac-rollout", resourceId: input.tenantId, expectedVersion: input.expectedVersion }],
      correlationId: input.correlationId,
      requestId: input.requestId,
      deriveContext: async ({ actor }) => {
        await requireProviderReauthentication({ actor, proofId: input.proofId });
        return { kind: "provider", contextId: "simas-provider", providerContextId: "simas-provider" };
      },
      authorizeAndMutate: async ({ actor, transaction }) => {
        await requireProviderReauthentication({ actor, proofId: input.proofId });
        const current = await transaction.readState(input.tenantId);
        if (!current || current.version !== input.expectedVersion) throw new SecurityCommandError("stale-version");
        const before = rolloutState(current.value);
        if (before.epoch !== input.expectedEpoch) throw new SecurityCommandError("stale-version");
        if (
          before.resolverVersion !== TENANT_AUTHORIZATION_RESOLVER_VERSION ||
          !["rbac", "rbac-emergency"].includes(before.httpMode) ||
          !["rbac", "rbac-emergency"].includes(before.workerMode)
        ) throw new SecurityCommandError("context-denied");
        const after = input.transition.toMode === "rbac" && before.httpMode === "rbac-emergency"
          ? planEmergencyExit(before, input.transition)
          : planRolloutTransition(before, input.transition, now());
        if (!await transaction.writeState({ id: current.id, expectedVersion: current.version, value: storedState(after) as unknown as JsonValue })) throw new SecurityCommandError("stale-version");
        return {
          result: { tenantId: input.tenantId, epoch: after.epoch.toString(), version: after.version, httpMode: after.httpMode, workerMode: after.workerMode },
          versionTransitions: [{ resourceType: "tenant-rbac-rollout", resourceId: input.tenantId, expectedVersion: current.version, toVersion: current.version + 1 }],
          auditEvents: [{
            purpose: "rollout-transition",
            order: "parent",
            eventType: "tenant_rbac_rollout.transitioned",
            reason: input.transition.reason,
            evidence: securityAuditEvidence({
              before: storedState(before) as unknown as JsonValue,
              after: storedState(after) as unknown as JsonValue,
              diff: {
                httpMode: { before: before.httpMode, after: after.httpMode },
                workerMode: { before: before.workerMode, after: after.workerMode },
                epoch: { before: before.epoch.toString(), after: after.epoch.toString() },
              },
              version: { before: current.version, after: after.version },
            }),
            metadata: { tenantId: input.tenantId },
          }],
        };
      },
    });
  }

  return Object.freeze({ execute });
}
