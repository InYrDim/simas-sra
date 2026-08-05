import { randomUUID } from "node:crypto";

import {
  SecurityCommandError,
  securityAuditEvidence,
  type JsonValue,
  type OptimisticVersion,
  type SecurityActor,
  type SecurityCommandMutation,
  type SecurityCommandResult,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";
import { permissionRegistry } from "@/lib/authorization/tenant-rbac-contract";

export const TENANT_ROLE_EVENT_TYPES = {
  CREATED: "tenant_role.created",
  RENAMED: "tenant_role.renamed",
  PERMISSIONS_EDITED: "tenant_role.permissions_edited",
  ACTIVATED: "tenant_role.activated",
  DRAFTED: "tenant_role.drafted",
  ARCHIVED: "tenant_role.archived",
  RESTORED: "tenant_role.restored",
} as const;

export type TenantRoleState = "draft" | "active" | "archived";

export function normalizeRoleName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 150) {
    throw new SecurityCommandError("invalid-command");
  }
  return normalized;
}

export function normalizeReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 1000) {
    throw new SecurityCommandError("invalid-command");
  }
  return normalized;
}

export type LifecycleRoleRow = Readonly<{
  id: string;
  tenantId: string;
  name: string;
  normalizedName: string;
  lifecycle: TenantRoleState;
  origin: "scratch" | "template" | "copy" | "legacy-migration";
  templateKey: string | null;
  templateVersion: string | null;
  copiedFromRoleId: string | null;
  legacyRole: string | null;
  version: number;
  permissions: readonly string[];
}>;

export interface TenantRoleLifecycleRepository {
  lockTenant(tenantId: string): Promise<boolean>;
  listRoles(tenantId: string): Promise<readonly LifecycleRoleRow[]>;
  insertRole(row: Readonly<{
    id: string;
    tenantId: string;
    name: string;
    normalizedName: string;
    origin: "scratch" | "template" | "copy";
    templateKey?: string | null;
    templateVersion?: string | null;
    copiedFromRoleId?: string | null;
    createdAt: Date;
  }>): Promise<void>;
  updateRole(input: Readonly<{
    id: string;
    tenantId: string;
    expectedVersion: number;
    name?: string;
    normalizedName?: string;
    lifecycle?: TenantRoleState;
    updatedAt: Date;
  }>): Promise<boolean>;
  insertPermissions(tenantId: string, roleId: string, permissions: readonly string[], createdAt: Date): Promise<void>;
  deletePermissions(tenantId: string, roleId: string, permissions: readonly string[]): Promise<void>;
  countActiveAssignments(tenantId: string, roleId: string): Promise<number>;
  isSchoolAdmin(tenantId: string, userId: string): Promise<boolean>;
  getRole(tenantId: string, roleId: string): Promise<LifecycleRoleRow | null>;
}

export type TenantRoleLifecycleExecutor<TTransaction extends object> = <TResult extends JsonValue>(input: Readonly<{
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

export type TenantRoleLifecycleService = Readonly<{
  createRole(input: CreateRoleInput): Promise<CreateRoleResult>;
  renameRole(input: RenameRoleInput): Promise<RenameRoleResult>;
  editPermissions(input: EditPermissionsInput): Promise<EditPermissionsResult>;
  activateRole(input: ActivateRoleInput): Promise<ActivateRoleResult>;
  draftRole(input: DraftRoleInput): Promise<DraftRoleResult>;
  archiveRole(input: ArchiveRoleInput): Promise<ArchiveRoleResult>;
  restoreRole(input: RestoreRoleInput): Promise<RestoreRoleResult>;
}>;

export type CreateRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  name: string;
  origin: "scratch" | "template" | "copy";
  templateKey?: string;
  templateVersion?: string;
  copiedFromRoleId?: string;
  permissions: readonly string[];
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type CreateRoleResult = Readonly<{
  status: "role-created";
  roleId: string;
  lifecycle: TenantRoleState;
}>;

export type RenameRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  newName: string;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type RenameRoleResult = Readonly<{
  status: "role-renamed";
  roleId: string;
}>;

export type EditPermissionsInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  addedPermissions: readonly string[];
  removedPermissions: readonly string[];
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type EditPermissionsResult = Readonly<{
  status: "permissions-edited";
  roleId: string;
}>;

export type ActivateRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type ActivateRoleResult = Readonly<{
  status: "role-activated";
  roleId: string;
}>;

export type DraftRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type DraftRoleResult = Readonly<{
  status: "role-drafted";
  roleId: string;
}>;

export type ArchiveRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type ArchiveRoleResult = Readonly<{
  status: "role-archived";
  roleId: string;
}>;

export type RestoreRoleInput = Readonly<{
  principal: SecurityPrincipal;
  tenantId: string;
  roleId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type RestoreRoleResult = Readonly<{
  status: "role-restored";
  roleId: string;
}>;

function tenantContext(tenantId: string): SecurityContext {
  return { kind: "tenant", contextId: tenantId, tenantId };
}

function assertIdentifier(value: string): void {
  if (!value || value.length > 36 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SecurityCommandError("invalid-command");
  }
}

function validatePermissions(keys: readonly string[]): void {
  const invalid = keys.find(k => {
    const def = permissionRegistry.find(p => p.key === k);
    if (!def) return true;
    if (def.assignment !== "tenant-assignable") return true;
    if (def.lifecycle === "reserved") return true;
    return false;
  });
  if (invalid) throw new SecurityCommandError("invalid-command");

  const keySet = new Set(keys);
  for (const k of keys) {
    const def = permissionRegistry.find(p => p.key === k);
    if (def && def.dependencies) {
      for (const dep of def.dependencies) {
        if (!keySet.has(dep)) throw new SecurityCommandError("invalid-command");
      }
    }
  }
}

function computeRisk(keys: readonly string[]): string {
  const risks = keys.map(k => permissionRegistry.find(p => p.key === k)?.risk || "low");
  if (risks.includes("critical")) return "critical";
  if (risks.includes("sensitive")) return "sensitive";
  if (risks.includes("medium")) return "medium";
  return "low";
}

async function authorizeAdminMutation<TTransaction extends object>(
  actor: SecurityActor,
  transaction: SecurityCommandStoreTransaction & TTransaction,
  dependencies: Readonly<{
    repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => TenantRoleLifecycleRepository;
  }>,
  input: { tenantId: string; roleId?: string; expectedVersion?: number; normalizedName?: string; }
) {
  if (actor.kind !== "tenant-user" && actor.kind !== "provider-admin") throw new SecurityCommandError("context-denied");
  const repo = dependencies.repository(transaction);
  if (!(await repo.lockTenant(input.tenantId))) throw new SecurityCommandError("context-denied");
  
  if (actor.kind === "tenant-user" && !(await repo.isSchoolAdmin(input.tenantId, actor.userId))) {
    throw new SecurityCommandError("context-denied");
  }

  let role = undefined;
  if (input.roleId) {
    const roles = await repo.listRoles(input.tenantId);
    role = roles.find(r => r.id === input.roleId);
    if (!role) throw new SecurityCommandError("invalid-command");
    if (input.expectedVersion !== undefined && role.version !== input.expectedVersion) {
      throw new SecurityCommandError("stale-version");
    }
    if (input.normalizedName && roles.some(r => r.id !== input.roleId && r.normalizedName === input.normalizedName)) {
      throw new SecurityCommandError("invalid-command");
    }
  }

  return { repo, role };
}

export function createTenantRoleLifecycleService<TTransaction extends object>(dependencies: Readonly<{
  execute: TenantRoleLifecycleExecutor<TTransaction>;
  repository: (transaction: SecurityCommandStoreTransaction & TTransaction) => TenantRoleLifecycleRepository;
  createId?: () => string;
  now?: () => Date;
}>): TenantRoleLifecycleService {
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return {
    async createRole(input) {
      assertIdentifier(input.tenantId);
      const name = normalizeRoleName(input.name);
      const normalizedName = name.toLowerCase();
      const reason = normalizeReason(input.reason);
      validatePermissions(input.permissions);

      return (await dependencies.execute<CreateRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.create",
        payload: { tenantId: input.tenantId, name, permissions: input.permissions, origin: input.origin },
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo } = await authorizeAdminMutation(actor, transaction, dependencies, { tenantId: input.tenantId });

          const roles = await repo.listRoles(input.tenantId);
          if (roles.some(r => r.normalizedName === normalizedName)) {
            throw new SecurityCommandError("invalid-command");
          }

          const roleId = createId();
          const createdAt = now();
          await repo.insertRole({
            id: roleId,
            tenantId: input.tenantId,
            name,
            normalizedName,
            origin: input.origin,
            templateKey: input.templateKey,
            templateVersion: input.templateVersion,
            copiedFromRoleId: input.copiedFromRoleId,
            createdAt,
          });

          if (input.permissions.length > 0) {
            await repo.insertPermissions(input.tenantId, roleId, input.permissions, createdAt);
          }

          return {
            result: { status: "role-created", roleId, lifecycle: "draft" },
            auditEvents: [{
              purpose: "role-created",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.CREATED,
              targets: { roleId },
              reason,
              evidence: securityAuditEvidence({
                after: {
                  name,
                  lifecycle: "draft",
                  permissions: [...input.permissions].sort(),
                },
                diff: {
                  created: {
                    name,
                    lifecycle: "draft",
                    permissions: [...input.permissions].sort(),
                  },
                },
                version: { after: 1 },
              }),
              metadata: {
                origin: input.origin,
                riskLevel: computeRisk(input.permissions),
              },
            }],
          };
        },
      })).result;
    },

    async renameRole(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const newName = normalizeRoleName(input.newName);
      const normalizedName = newName.toLowerCase();
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<RenameRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.rename",
        payload: { tenantId: input.tenantId, roleId: input.roleId, newName },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion, 
            normalizedName 
          });

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            name: newName,
            normalizedName,
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          return {
            result: { status: "role-renamed", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-renamed",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.RENAMED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { name: role!.name },
                after: { name: newName },
                diff: { name: { before: role!.name, after: newName } },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {},
            }],
          };
        },
      })).result;
    },

    async editPermissions(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<EditPermissionsResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.edit-permissions",
        payload: { tenantId: input.tenantId, roleId: input.roleId, addedPermissions: input.addedPermissions, removedPermissions: input.removedPermissions },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion 
          });

          const currentSet = new Set(role!.permissions);
          for (const rm of input.removedPermissions) currentSet.delete(rm);
          for (const add of input.addedPermissions) currentSet.add(add);
          
          const newPermissions = Array.from(currentSet);
          validatePermissions(newPermissions);

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          if (input.removedPermissions.length > 0) {
            await repo.deletePermissions(input.tenantId, input.roleId, input.removedPermissions);
          }
          if (input.addedPermissions.length > 0) {
            await repo.insertPermissions(input.tenantId, input.roleId, input.addedPermissions, now());
          }

          return {
            result: { status: "permissions-edited", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-permissions-edited",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.PERMISSIONS_EDITED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { permissions: [...role!.permissions].sort() },
                after: { permissions: [...newPermissions].sort() },
                diff: {
                  permissions: {
                    added: [...input.addedPermissions].sort(),
                    removed: [...input.removedPermissions].sort(),
                  },
                },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {
                riskLevelBefore: computeRisk(role!.permissions),
                riskLevelAfter: computeRisk(newPermissions),
              },
            }],
          };
        },
      })).result;
    },

    async activateRole(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<ActivateRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.activate",
        payload: { tenantId: input.tenantId, roleId: input.roleId },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion 
          });
          if (role!.lifecycle === "active") throw new SecurityCommandError("invalid-command");

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            lifecycle: "active",
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          return {
            result: { status: "role-activated", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-activated",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.ACTIVATED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { lifecycle: role!.lifecycle },
                after: { lifecycle: "active" },
                diff: { lifecycle: { before: role!.lifecycle, after: "active" } },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {},
            }],
          };
        },
      })).result;
    },

    async draftRole(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<DraftRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.draft",
        payload: { tenantId: input.tenantId, roleId: input.roleId },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion 
          });
          if (role!.lifecycle !== "active") throw new SecurityCommandError("invalid-command");

          const activeAssignments = await repo.countActiveAssignments(input.tenantId, input.roleId);
          if (activeAssignments > 0) throw new SecurityCommandError("invalid-command");

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            lifecycle: "draft",
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          return {
            result: { status: "role-drafted", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-drafted",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.DRAFTED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { lifecycle: role!.lifecycle },
                after: { lifecycle: "draft" },
                diff: { lifecycle: { before: role!.lifecycle, after: "draft" } },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {},
            }],
          };
        },
      })).result;
    },

    async archiveRole(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<ArchiveRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.archive",
        payload: { tenantId: input.tenantId, roleId: input.roleId },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion 
          });
          if (role!.lifecycle === "archived") throw new SecurityCommandError("invalid-command");

          const activeAssignments = await repo.countActiveAssignments(input.tenantId, input.roleId);
          if (activeAssignments > 0) throw new SecurityCommandError("invalid-command");

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            lifecycle: "archived",
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          return {
            result: { status: "role-archived", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-archived",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.ARCHIVED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { lifecycle: role!.lifecycle },
                after: { lifecycle: "archived" },
                diff: { lifecycle: { before: role!.lifecycle, after: "archived" } },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {},
            }],
          };
        },
      })).result;
    },

    async restoreRole(input) {
      assertIdentifier(input.tenantId);
      assertIdentifier(input.roleId);
      const reason = normalizeReason(input.reason);

      return (await dependencies.execute<RestoreRoleResult>({
        principal: input.principal,
        idempotencyKey: input.idempotencyKey,
        commandName: "tenant-role.restore",
        payload: { tenantId: input.tenantId, roleId: input.roleId },
        expectedVersions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion }],
        correlationId: input.correlationId,
        deriveContext: async () => tenantContext(input.tenantId),
        authorizeAndMutate: async ({ actor, transaction }) => {
          const { repo, role } = await authorizeAdminMutation(actor, transaction, dependencies, { 
            tenantId: input.tenantId, 
            roleId: input.roleId, 
            expectedVersion: input.expectedVersion 
          });
          if (role!.lifecycle !== "archived") throw new SecurityCommandError("invalid-command");

          const updated = await repo.updateRole({
            id: input.roleId,
            tenantId: input.tenantId,
            expectedVersion: input.expectedVersion,
            lifecycle: "draft",
            updatedAt: now(),
          });
          if (!updated) throw new SecurityCommandError("stale-version");

          return {
            result: { status: "role-restored", roleId: input.roleId },
            versionTransitions: [{ resourceType: "tenant-role", resourceId: input.roleId, expectedVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 }],
            auditEvents: [{
              purpose: "role-restored",
              order: "summary",
              eventType: TENANT_ROLE_EVENT_TYPES.RESTORED,
              targets: { roleId: input.roleId },
              reason,
              evidence: securityAuditEvidence({
                before: { lifecycle: role!.lifecycle },
                after: { lifecycle: "draft" },
                diff: { lifecycle: { before: role!.lifecycle, after: "draft" } },
                version: { before: input.expectedVersion, after: input.expectedVersion + 1 },
              }),
              metadata: {},
            }],
          };
        },
      })).result;
    },
  };
}
