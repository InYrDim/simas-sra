import { randomUUID } from "node:crypto";

import {
  SecurityCommandError,
  type SecurityCommandMutation,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";
import {
  permissionRegistry,
} from "@/lib/authorization/tenant-rbac-contract";
import {
  TENANT_ROLE_ASSIGNMENT_EVENT_TYPES,
  type AssignmentAccountRow,
  type AssignmentRoleRow,
  type AssignmentRow,
  type TenantRoleAssignmentExecutor,
  type TenantRoleAssignmentRepository,
} from "@/lib/authorization/tenant-role-assignment";

export type BulkRoleOperation = "add" | "revoke";
export type BulkRoleOutcomeKind = "unchanged" | "changed" | "invalid" | "zero-role";

export type BulkRoleTarget = Readonly<{
  userId: string;
  expectedAssignmentVersion: number;
}>;

export type BulkRoleOutcome = Readonly<{
  userId: string;
  outcome: BulkRoleOutcomeKind;
  currentRoleIds: readonly string[];
  nextRoleIds: readonly string[];
  reason: string | null;
}>;

export type BulkRolePreviewInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  operation: BulkRoleOperation;
  roleIds: readonly string[];
  targets: readonly BulkRoleTarget[];
}>;

export type BulkRolePreviewResult = Readonly<{
  status: "bulk-previewed";
  outcomes: readonly BulkRoleOutcome[];
}>;

export type BulkRoleCommitInput = BulkRolePreviewInput & Readonly<{
  confirmZeroAccess: boolean;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
  requestId?: string;
}>;

export type BulkRoleCommitResult = Readonly<{
  status: "bulk-assignments-updated";
  outcomes: readonly BulkRoleOutcome[];
}>;

type PreparedTarget = Readonly<{
  account: AssignmentAccountRow;
  existingAssignments: readonly AssignmentRow[];
  outcome: BulkRoleOutcome;
  failure: "stale-version" | "ineligible" | null;
}>;

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function normalizeReason(value: string): string {
  const reason = value.trim().replace(/\s+/g, " ");
  if (!reason || reason.length > 1000) throw new SecurityCommandError("invalid-command");
  return reason;
}

function normalizeTargets(targets: readonly BulkRoleTarget[]): readonly BulkRoleTarget[] {
  if (targets.length < 1 || targets.length > 100) throw new SecurityCommandError("invalid-command");
  const ids = new Set<string>();
  for (const target of targets) {
    assertIdentifier(target.userId);
    if (ids.has(target.userId) || !Number.isSafeInteger(target.expectedAssignmentVersion) || target.expectedAssignmentVersion < 1) {
      throw new SecurityCommandError("invalid-command");
    }
    ids.add(target.userId);
  }
  return [...targets].sort((left, right) => left.userId.localeCompare(right.userId));
}

function normalizeRoleIds(roleIds: readonly string[]): readonly string[] {
  if (roleIds.length < 1) throw new SecurityCommandError("invalid-command");
  const result = [...new Set(roleIds)].sort();
  for (const roleId of result) assertIdentifier(roleId);
  return result;
}

function validateBulkRoles(tenantId: string, selectedRoleIds: readonly string[], roles: readonly AssignmentRoleRow[]): void {
  const byId = new Map(roles.map((role) => [role.id, role]));
  for (const roleId of selectedRoleIds) {
    const role = byId.get(roleId);
    if (!role || role.tenantId !== tenantId || role.lifecycle !== "active") {
      throw new SecurityCommandError("invalid-command");
    }
    const permissionKeys = new Set(role.permissions);
    for (const key of role.permissions) {
      const permission = permissionRegistry.find((candidate) => candidate.key === key);
      if (
        !permission
        || permission.lifecycle !== "active"
        || permission.assignment !== "tenant-assignable"
        || permission.dependencies.some((dependency) => !permissionKeys.has(dependency))
      ) {
        throw new SecurityCommandError("invalid-command");
      }
    }
  }
}

function nextRoles(
  currentRoleIds: readonly string[],
  changedRoleIds: readonly string[],
  operation: BulkRoleOperation,
): readonly string[] {
  const roles = new Set(currentRoleIds);
  for (const roleId of changedRoleIds) {
    if (operation === "add") roles.add(roleId);
    else roles.delete(roleId);
  }
  return [...roles].sort();
}

async function prepare(
  repository: TenantRoleAssignmentRepository,
  input: BulkRolePreviewInput,
): Promise<Readonly<{ roles: readonly AssignmentRoleRow[]; targets: readonly PreparedTarget[] }>> {
  assertIdentifier(input.tenantId);
  if (input.principal.kind !== "authenticated-user") throw new SecurityCommandError("unauthenticated");
  if (!await repository.isSchoolAdmin(input.tenantId, input.principal.userId)) {
    throw new SecurityCommandError("context-denied");
  }
  const targets = normalizeTargets(input.targets);
  const roleIds = normalizeRoleIds(input.roleIds);
  const roles = await repository.listActiveRoles(input.tenantId);
  validateBulkRoles(input.tenantId, roleIds, roles);

  const prepared: PreparedTarget[] = [];
  for (const target of targets) {
    const [account, assignments] = await Promise.all([
      repository.getAccount(input.tenantId, target.userId),
      repository.listAssignments(input.tenantId, target.userId),
    ]);
    const currentRoleIds = assignments
      .filter((assignment) => assignment.state === "active")
      .map((assignment) => assignment.roleId)
      .sort();
    const computedRoleIds = nextRoles(currentRoleIds, roleIds, input.operation);
    let outcome: BulkRoleOutcomeKind = computedRoleIds.length === 0 ? "zero-role" : "changed";
    let invalidReason: string | null = null;
    let failure: PreparedTarget["failure"] = null;
    if (
      !account
      || account.tenantId !== input.tenantId
      || account.schoolAdmin
      || (account.lifecycle !== "active" && input.operation === "add")
    ) {
      outcome = "invalid";
      failure = "ineligible";
      invalidReason = "Target tidak lagi memenuhi syarat.";
    } else if (account.assignmentVersion !== target.expectedAssignmentVersion) {
      outcome = "invalid";
      failure = "stale-version";
      invalidReason = "Versi assignment target sudah berubah.";
    } else if (
      computedRoleIds.length === currentRoleIds.length
      && computedRoleIds.every((roleId, index) => roleId === currentRoleIds[index])
    ) {
      outcome = "unchanged";
    }
    prepared.push({
      account: account ?? {
        userId: target.userId,
        tenantId: input.tenantId,
        name: "",
        email: "",
        lifecycle: "inactive",
        assignmentVersion: target.expectedAssignmentVersion,
        schoolAdmin: false,
      },
      existingAssignments: assignments,
      outcome: {
        userId: target.userId,
        outcome,
        currentRoleIds,
        nextRoleIds: computedRoleIds,
        reason: invalidReason,
      },
      failure,
    });
  }
  return { roles, targets: prepared };
}

function tenantContext(tenantId: string): SecurityContext {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

export function createTenantRoleBulkAssignmentService<TTransaction extends object>(dependencies: Readonly<{
  execute: TenantRoleAssignmentExecutor<TTransaction>;
  repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => TenantRoleAssignmentRepository;
  readRepository?: TenantRoleAssignmentRepository;
  now?: () => Date;
  createId?: () => string;
}>) {
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? randomUUID;

  return Object.freeze({
    async preview(input: BulkRolePreviewInput): Promise<BulkRolePreviewResult> {
      const repository = dependencies.readRepository ?? dependencies.repository({} as SecurityCommandStoreTransaction & TTransaction);
      const prepared = await prepare(repository, input);
      return { status: "bulk-previewed", outcomes: prepared.targets.map((target) => target.outcome) };
    },

    async commit(input: BulkRoleCommitInput): Promise<BulkRoleCommitResult> {
      const targets = normalizeTargets(input.targets);
      const roleIds = normalizeRoleIds(input.roleIds);
      const reason = normalizeReason(input.reason);
      return (await dependencies.execute<BulkRoleCommitResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role-assignment.bulk",
        payload: {
          tenantId: input.tenantId,
          operation: input.operation,
          roleIds,
          targets,
          confirmZeroAccess: input.confirmZeroAccess,
          reason,
        },
        correlationId: input.correlationId,
        requestId: input.requestId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }): Promise<SecurityCommandMutation<BulkRoleCommitResult>> => {
          if (actor.kind !== "tenant-user" || actor.tenantId !== input.tenantId) {
            throw new SecurityCommandError("context-denied");
          }
          const repository = dependencies.repository(transaction);
          if (!await repository.lockTenant(input.tenantId)) throw new SecurityCommandError("context-denied");
          const prepared = await prepare(repository, input);
          if (prepared.targets.some((target) => target.failure === "stale-version")) {
            throw new SecurityCommandError("stale-version");
          }
          if (prepared.targets.some((target) => target.outcome.outcome === "invalid")) {
            throw new SecurityCommandError("invalid-command");
          }
          if (prepared.targets.some((target) => target.outcome.outcome === "zero-role") && !input.confirmZeroAccess) {
            throw new SecurityCommandError("invalid-command");
          }

          for (const target of prepared.targets) {
            if (target.outcome.outcome === "unchanged") continue;
            const replacement = await repository.replaceActiveAssignments({
              tenantId: input.tenantId,
              userId: target.account.userId,
              roleIds: target.outcome.nextRoleIds,
              expectedAssignmentVersion: target.account.assignmentVersion,
              existingAssignments: target.existingAssignments,
              createId,
              updatedAt: now(),
            });
            if (!replacement.updated) throw new SecurityCommandError("stale-version");
          }

          return {
            result: {
              status: "bulk-assignments-updated",
              outcomes: prepared.targets.map((target) => target.outcome),
            },
            auditEvents: [{
              purpose: "assignment-bulk-parent",
              order: "parent",
              eventType: TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.REPLACED,
              reason,
              metadata: {
                operation: input.operation,
                roleIds,
                targetCount: prepared.targets.length,
                zeroRoleCount: prepared.targets.filter((target) => target.outcome.outcome === "zero-role").length,
              },
            }, ...prepared.targets.map((target) => ({
              purpose: `assignment-bulk-${target.account.userId}`,
              order: "child" as const,
              eventType: target.outcome.outcome === "zero-role"
                ? TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.ZERO_ACCESS
                : TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.REPLACED,
              targets: { userId: target.account.userId },
              reason,
              metadata: {
                outcome: target.outcome.outcome,
                currentRoleIds: target.outcome.currentRoleIds,
                nextRoleIds: target.outcome.nextRoleIds,
              },
            }))],
          };
        },
      })).result;
    },
  });
}
