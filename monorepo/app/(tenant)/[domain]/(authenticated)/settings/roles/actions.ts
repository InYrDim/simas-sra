'use server';

import { revalidatePath } from 'next/cache';
import { notFound, forbidden } from 'next/navigation';
import { randomUUID } from 'node:crypto';

import { db } from '@/db';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import { createTenantRoleLifecycleDataService, createTenantRoleLifecycleDataRepository } from '@/lib/authorization/tenant-role-lifecycle-data';
import { getTenantRoleTemplate, TENANT_ROLE_TEMPLATE_VERSION } from '@/lib/authorization/tenant-role-templates';
import type { TenantRoleState } from '@/lib/authorization/tenant-role-lifecycle';

export type RoleStatus = TenantRoleState | "restored" | "deleted";

export interface Role {
  id: string;
  name: string;
  description: string;
  status: RoleStatus;
  userCount: number;
  permissions: string[];
  /** Menu keys hidden for this role; absent keys default to visible. */
  menuVisibility?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

async function enforceRoleAccess(domain: string, operationId: string, requestedPermissions?: string[]) {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const decision = await evaluator.evaluate({
    surface: "api",
    domain,
    operationId,
    ...(requestedPermissions?.length ? { requestedPermissions } : {}),
  });
  if (decision.kind !== "authorized") {
    if (decision.kind === "denied" && decision.external.status === 404) {
      notFound();
    }
    forbidden();
  }
  return {
    tenantId: decision.principal.tenantId,
    principal: { kind: 'authenticated-user' as const, userId: decision.principal.userId },
  };
}

export async function getRoles(domain: string): Promise<Role[]> {
  const { tenantId } = await enforceRoleAccess(domain, 'tenant.roles.list');

  return db.transaction(async (tx) => {
    const repo = createTenantRoleLifecycleDataRepository({ database: tx });
    const roles = await repo.listRoles(tenantId);

    const results = [];
    for (const r of roles) {
      const userCount = await repo.countActiveAssignments(tenantId, r.id);
      results.push({
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        status: r.lifecycle,
        userCount,
        permissions: [...r.permissions],
        menuVisibility: { ...r.menuVisibility },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: r.version,
      });
    }
    return results;
  });
}

export async function getRole(domain: string, id: string): Promise<Role | null> {
  const { tenantId } = await enforceRoleAccess(domain, 'tenant.roles.list');

  return db.transaction(async (tx) => {
    const repo = createTenantRoleLifecycleDataRepository({ database: tx });
    const r = await repo.getRole(tenantId, id);
    if (!r) return null;

    const userCount = await repo.countActiveAssignments(tenantId, r.id);
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      status: r.lifecycle,
      userCount,
      permissions: [...r.permissions],
      menuVisibility: { ...r.menuVisibility },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: r.version,
    };
  });
}

export async function createRole(domain: string, data: Partial<Role>): Promise<{ success: boolean; role?: Role; error?: string }> {
  try {
    const { tenantId, principal } = await enforceRoleAccess(domain, 'tenant.roles.create');
    const service = createTenantRoleLifecycleDataService();

    const res = await service.createRole({
      principal,
      tenantId,
      name: data.name || '',
      origin: 'scratch',
      description: data.description ?? null,
      permissions: data.permissions || [],
      menuVisibility: data.menuVisibility || {},
      reason: data.description || 'Created via UI',
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    revalidatePath(`/${domain}/settings/roles`);
    return { success: true, role: { ...data, id: res.roleId, version: 1 } as Role };
  } catch {
    return { success: false, error: 'Failed to create role' };
  }
}

export async function createRoleFromTemplate(domain: string, templateKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const template = getTenantRoleTemplate(templateKey);
    if (!template) return { success: false, error: 'Template tidak ditemukan' };

    const { tenantId, principal } = await enforceRoleAccess(domain, 'tenant.roles.create');
    const service = createTenantRoleLifecycleDataService();

    await service.createRole({
      principal,
      tenantId,
      name: template.name,
      origin: 'template',
      templateKey: template.key,
      templateVersion: TENANT_ROLE_TEMPLATE_VERSION,
      description: template.description,
      permissions: template.permissions,
      reason: `Dibuat dari template ${template.name}`,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    revalidatePath(`/${domain}/settings/roles`);
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal membuat role dari template' };
  }
}

export async function updateRole(domain: string, id: string, expectedVersion: number, data: Partial<Role>): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, principal } = await enforceRoleAccess(domain, 'tenant.roles.update', ['tenant.roles.rename']);
    const service = createTenantRoleLifecycleDataService();
    const correlationId = randomUUID();

    if (data.name) {
      await service.renameRole({
        principal,
        tenantId,
        roleId: id,
        expectedVersion,
        newName: data.name,
        reason: data.description || 'Renamed via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
      // Increment expectedVersion since it successfully updated
      expectedVersion++;
    }

    if (data.description !== undefined) {
      await service.changeRoleDescription({
        principal,
        tenantId,
        roleId: id,
        expectedVersion,
        description: data.description ?? null,
        reason: 'Description updated via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
      // Increment expectedVersion since it successfully updated
      expectedVersion++;
    }

    if (data.permissions) {
      // Need to find existing permissions to know what was added/removed
      const role = await getRole(domain, id);
      const existingPerms = new Set(role?.permissions || []);
      const newPerms = new Set(data.permissions);

      const addedPermissions = [...newPerms].filter(p => !existingPerms.has(p));
      const removedPermissions = [...existingPerms].filter(p => !newPerms.has(p));

      if (addedPermissions.length > 0 || removedPermissions.length > 0) {
        // Evaluate if they have change-permissions right
        await enforceRoleAccess(domain, 'tenant.roles.update', ['tenant.roles.change-permissions']);
        await service.editPermissions({
          principal,
          tenantId,
          roleId: id,
          expectedVersion,
          addedPermissions,
          removedPermissions,
          menuVisibility: data.menuVisibility || {},
          reason: data.description || 'Permissions updated via UI',
          idempotencyKey: randomUUID(),
          correlationId,
        });
      }
    }

    // Persist menu visibility even when no permission changed (e.g. user only
    // toggled sidebar items). Upsert is idempotent so a concurrent permission
    // edit above is harmless.
    if (data.menuVisibility && Object.keys(data.menuVisibility).length > 0) {
      await db.transaction(async (tx) => {
        const repo = createTenantRoleLifecycleDataRepository({ database: tx });
        await repo.upsertMenuVisibility(tenantId, id, data.menuVisibility!, new Date());
      });
    }

    revalidatePath(`/${domain}/settings/roles`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update role' };
  }
}

export async function changeRoleStatus(domain: string, id: string, expectedVersion: number, status: RoleStatus): Promise<{ success: boolean; error?: string }> {
  try {
    const service = createTenantRoleLifecycleDataService();
    const correlationId = randomUUID();

    let access;
    if (status === 'active') {
      access = await enforceRoleAccess(domain, 'tenant.roles.lifecycle', ['tenant.roles.activate']);
      await service.activateRole({
        principal: access.principal,
        tenantId: access.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to active via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'draft') {
      access = await enforceRoleAccess(domain, 'tenant.roles.lifecycle', ['tenant.roles.draft']);
      await service.draftRole({
        principal: access.principal,
        tenantId: access.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to draft via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'archived') {
      access = await enforceRoleAccess(domain, 'tenant.roles.lifecycle', ['tenant.roles.archive']);
      await service.archiveRole({
        principal: access.principal,
        tenantId: access.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to archived via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'restored') {
      access = await enforceRoleAccess(domain, 'tenant.roles.lifecycle', ['tenant.roles.restore']);
      await service.restoreRole({
        principal: access.principal,
        tenantId: access.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Role restored via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'deleted') {
      access = await enforceRoleAccess(domain, 'tenant.roles.lifecycle', ['tenant.roles.delete']);
      await service.deleteRole({
        principal: access.principal,
        tenantId: access.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Role deleted via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    }

    revalidatePath(`/${domain}/settings/roles`);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to change role status' };
  }
}
