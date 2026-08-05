import { randomUUID } from "node:crypto";

import {
  SecurityCommandError,
  securityAuditEvidence,
  type JsonValue,
  type OptimisticVersion,
  type SecurityActor,
  type SecurityAuditEventDraft,
  type SecurityCommandMutation,
  type SecurityCommandResult,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";
import {
  permissionRegistry,
  type PermissionRisk,
} from "@/lib/authorization/tenant-rbac-contract";

export const TENANT_ROLE_ASSIGNMENT_EVENT_TYPES = {
  REPLACED: "tenant_role_assignment.replaced",
  ADDED: "tenant_role_assignment.added",
  REACTIVATED: "tenant_role_assignment.reactivated",
  SUSPENDED: "tenant_role_assignment.suspended",
  ZERO_ACCESS: "tenant_role_assignment.zero_access",
} as const;

export type AssignmentAccountRow = Readonly<{
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  lifecycle: "pending-activation" | "active" | "inactive";
  assignmentVersion: number;
  schoolAdmin: boolean;
}>;

export type AssignmentRoleRow = Readonly<{
  id: string;
  tenantId: string;
  name: string;
  lifecycle: "draft" | "active" | "archived";
  permissions: readonly string[];
}>;

export type AssignmentRow = Readonly<{
  assignmentId: string;
  roleId: string;
  state: "active" | "suspended";
  version: number;
}>;

export type AssignmentTransition = Readonly<{
  assignmentId: string;
  roleId: string;
  transition: "added" | "reactivated" | "suspended" | "unchanged";
}>;

export interface TenantRoleAssignmentRepository {
  lockTenant(tenantId: string): Promise<boolean>;
  isSchoolAdmin(tenantId: string, userId: string): Promise<boolean>;
  getAccount(tenantId: string, userId: string): Promise<AssignmentAccountRow | null>;
  listActiveRoles(tenantId: string): Promise<readonly AssignmentRoleRow[]>;
  listAssignments(tenantId: string, userId: string): Promise<readonly AssignmentRow[]>;
  replaceActiveAssignments(input: Readonly<{
    tenantId: string;
    userId: string;
    roleIds: readonly string[];
    expectedAssignmentVersion: number;
    existingAssignments: readonly AssignmentRow[];
    createId: () => string;
    updatedAt: Date;
  }>): Promise<Readonly<{
    updated: boolean;
    assignments: readonly AssignmentTransition[];
  }>>;
}

export type TenantRoleAssignmentExecutor<TTransaction extends object> = <TResult extends JsonValue>(input: Readonly<{
  principal: SecurityPrincipal;
  idempotencyKey: string;
  commandName: string;
  payload: JsonValue;
  expectedVersions?: readonly OptimisticVersion[];
  correlationId: string;
  requestId?: string;
  deriveContext?: (input: Readonly<{
    actor: SecurityActor;
    transaction: SecurityCommandStoreTransaction & TTransaction;
  }>) => Promise<SecurityContext>;
  authorizeAndMutate: (input: Readonly<{
    actor: SecurityActor;
    context: SecurityContext;
    expectedVersions: readonly OptimisticVersion[];
    transaction: SecurityCommandStoreTransaction & TTransaction;
  }>) => Promise<SecurityCommandMutation<TResult>>;
}>) => Promise<SecurityCommandResult<TResult>>;

export type EffectiveAccessPermission = Readonly<{
  key: string;
  label: string;
  description: string;
  risk: PermissionRisk;
  sources: readonly Readonly<{ roleId: string; roleName: string }>[];
  unavailableEntitlement: string | null;
  contextualLimitations: readonly string[];
}>;

export type ReplaceRoleSetInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  targetUserId: string;
  roleIds: readonly string[];
  expectedAssignmentVersion: number;
  reason: string;
  confirmZeroAccess: boolean;
  idempotencyKey: string;
  correlationId: string;
  requestId?: string;
}>;

export type ReplaceRoleSetResult = Readonly<{
  status: "assignments-replaced";
  targetUserId: string;
  assignmentVersion: number;
  roleIds: readonly string[];
  zeroAccess: boolean;
  effectiveAccess: readonly EffectiveAccessPermission[];
}>;

export type TenantRoleAssignmentService = Readonly<{
  replaceRoleSet(input: ReplaceRoleSetInput): Promise<ReplaceRoleSetResult>;
}>;

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function normalizeReason(value: string, required: boolean): string | undefined {
  const reason = value.trim().replace(/\s+/g, " ");
  if ((!reason && required) || reason.length > 1000) {
    throw new SecurityCommandError("invalid-command");
  }
  return reason || undefined;
}

function tenantContext(tenantId: string): SecurityContext {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

function normalizeRoleIds(roleIds: readonly string[]): readonly string[] {
  const normalized = [...new Set(roleIds)].sort();
  for (const roleId of normalized) assertIdentifier(roleId);
  return normalized;
}

function contextualLimitations(permissionKey: string): readonly string[] {
  if (permissionKey.includes("view-sensitive") || permissionKey.includes("view-contact")) {
    return ["Proyeksi data sensitif tetap dibatasi oleh operasi dan konteks target."];
  }
  return [];
}

export function projectEffectiveAccess(roles: readonly AssignmentRoleRow[]): readonly EffectiveAccessPermission[] {
  const sources = new Map<string, Array<{ roleId: string; roleName: string }>>();
  for (const role of roles) {
    if (role.lifecycle !== "active") continue;
    for (const permissionKey of role.permissions) {
      const list = sources.get(permissionKey) ?? [];
      list.push({ roleId: role.id, roleName: role.name });
      sources.set(permissionKey, list);
    }
  }

  return [...sources.entries()]
    .map(([key, permissionSources]): EffectiveAccessPermission | null => {
      const definition = permissionRegistry.find((entry) => entry.key === key);
      if (!definition || definition.lifecycle !== "active" || definition.assignment !== "tenant-assignable") return null;
      return {
        key,
        label: definition.labelId,
        description: definition.descriptionId,
        risk: definition.risk,
        sources: permissionSources.sort((left, right) => left.roleId.localeCompare(right.roleId)),
        unavailableEntitlement: null,
        contextualLimitations: contextualLimitations(key),
      };
    })
    .filter((permission): permission is EffectiveAccessPermission => permission !== null)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function validateSelectedRoles(
  tenantId: string,
  selectedRoleIds: readonly string[],
  roles: readonly AssignmentRoleRow[],
): readonly AssignmentRoleRow[] {
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const selected = selectedRoleIds.map((roleId) => rolesById.get(roleId));
  if (selected.some((role) => !role || role.tenantId !== tenantId || role.lifecycle !== "active")) {
    throw new SecurityCommandError("invalid-command");
  }

  for (const role of selected as AssignmentRoleRow[]) {
    const permissionKeys = new Set(role.permissions);
    for (const permissionKey of role.permissions) {
      const permission = permissionRegistry.find((entry) => entry.key === permissionKey);
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
  return selected as AssignmentRoleRow[];
}

export function createTenantRoleAssignmentService<TTransaction extends object>(dependencies: Readonly<{
  execute: TenantRoleAssignmentExecutor<TTransaction>;
  repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => TenantRoleAssignmentRepository;
  createId?: () => string;
  now?: () => Date;
}>): TenantRoleAssignmentService {
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return {
    async replaceRoleSet(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.targetUserId);
      if (!Number.isSafeInteger(input.expectedAssignmentVersion) || input.expectedAssignmentVersion < 1) {
        throw new SecurityCommandError("invalid-command");
      }
      const roleIds = normalizeRoleIds(input.roleIds);
      const zeroAccess = roleIds.length === 0;
      const reason = normalizeReason(input.reason, zeroAccess);
      if (zeroAccess && !input.confirmZeroAccess) throw new SecurityCommandError("invalid-command");

      return (await dependencies.execute<ReplaceRoleSetResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role-assignment.replace",
        payload: {
          tenantId: input.tenantId,
          targetUserId: input.targetUserId,
          roleIds,
          confirmZeroAccess: input.confirmZeroAccess,
          reason: reason ?? null,
        },
        expectedVersions: [{
          resourceType: "tenant-role-assignment-set",
          resourceId: input.targetUserId,
          expectedVersion: input.expectedAssignmentVersion,
        }],
        correlationId: input.correlationId,
        requestId: input.requestId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          if (actor.kind !== "tenant-user" || actor.tenantId !== input.tenantId) {
            throw new SecurityCommandError("context-denied");
          }
          const repository = dependencies.repository(transaction);
          if (!await repository.lockTenant(input.tenantId)) throw new SecurityCommandError("context-denied");
          if (!await repository.isSchoolAdmin(input.tenantId, actor.userId)) {
            throw new SecurityCommandError("context-denied");
          }

          const target = await repository.getAccount(input.tenantId, input.targetUserId);
          if (!target || target.tenantId !== input.tenantId || target.schoolAdmin) {
            throw new SecurityCommandError("context-denied");
          }
          if (target.assignmentVersion !== input.expectedAssignmentVersion) {
            throw new SecurityCommandError("stale-version");
          }

          const existingAssignments = await repository.listAssignments(input.tenantId, input.targetUserId);
          const currentRoleIds = existingAssignments
            .filter((assignment) => assignment.state === "active")
            .map((assignment) => assignment.roleId)
            .sort();
          const currentRoleIdSet = new Set(currentRoleIds);
          if (target.lifecycle !== "active" && roleIds.some((roleId) => !currentRoleIdSet.has(roleId))) {
            throw new SecurityCommandError("invalid-command");
          }
          const allRoles = await repository.listActiveRoles(input.tenantId);
          const selectedRoles = validateSelectedRoles(input.tenantId, roleIds, allRoles);
          const replacement = await repository.replaceActiveAssignments({
            tenantId: input.tenantId,
            userId: input.targetUserId,
            roleIds,
            expectedAssignmentVersion: input.expectedAssignmentVersion,
            existingAssignments,
            createId,
            updatedAt: now(),
          });
          if (!replacement.updated) throw new SecurityCommandError("stale-version");

          const effectiveAccess = projectEffectiveAccess(selectedRoles);
          const auditEvents: SecurityAuditEventDraft[] = [{
            purpose: "assignment-set-replaced",
            order: "summary" as const,
            eventType: TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.REPLACED,
            targets: { userId: input.targetUserId },
            ...(reason ? { reason } : {}),
            evidence: securityAuditEvidence({
              before: { roleIds: currentRoleIds },
              after: { roleIds },
              diff: {
                roleIds: {
                  added: roleIds.filter((roleId) => !currentRoleIdSet.has(roleId)),
                  removed: currentRoleIds.filter((roleId) => !roleIds.includes(roleId)),
                },
              },
              version: {
                before: input.expectedAssignmentVersion,
                after: input.expectedAssignmentVersion + 1,
              },
            }),
            metadata: { zeroAccess },
          }];
          for (const assignment of replacement.assignments) {
            if (assignment.transition === "unchanged") continue;
            auditEvents.push({
              purpose: `assignment-${assignment.transition}-${assignment.assignmentId}`,
              order: "child",
              eventType: assignment.transition === "added"
                ? TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.ADDED
                : assignment.transition === "reactivated"
                  ? TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.REACTIVATED
                  : TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.SUSPENDED,
              targets: {
                userId: input.targetUserId,
                roleId: assignment.roleId,
                assignmentId: assignment.assignmentId,
              },
              ...(reason ? { reason } : {}),
              evidence: securityAuditEvidence({
                before: assignment.transition === "suspended" ? { state: "active" } : null,
                after: assignment.transition === "suspended" ? { state: "suspended" } : { state: "active" },
                diff: { state: { transition: assignment.transition } },
              }),
              metadata: { transition: assignment.transition },
            });
          }
          if (zeroAccess) {
            auditEvents.push({
              purpose: "assignment-zero-access",
              order: "consequence",
              eventType: TENANT_ROLE_ASSIGNMENT_EVENT_TYPES.ZERO_ACCESS,
              targets: { userId: input.targetUserId },
              reason: reason!,
              evidence: securityAuditEvidence({
                after: { roleIds: [] },
                diff: { zeroAccess: { before: false, after: true } },
                version: {
                  before: input.expectedAssignmentVersion,
                  after: input.expectedAssignmentVersion + 1,
                },
              }),
              metadata: { surface: "Akses belum diberikan" },
            });
          }

          return {
            result: {
              status: "assignments-replaced",
              targetUserId: input.targetUserId,
              assignmentVersion: input.expectedAssignmentVersion + 1,
              roleIds,
              zeroAccess,
              effectiveAccess,
            },
            versionTransitions: [{
              resourceType: "tenant-role-assignment-set",
              resourceId: input.targetUserId,
              expectedVersion: input.expectedAssignmentVersion,
              toVersion: input.expectedAssignmentVersion + 1,
            }],
            auditEvents,
          };
        },
      })).result;
    },
  };
}
