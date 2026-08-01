'use server';

import { revalidatePath } from 'next/cache';
import { notFound, forbidden } from 'next/navigation';
import { randomUUID } from 'node:crypto';

import { db } from '@/db';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import { createTenantRoleLifecycleDataService, createTenantRoleLifecycleDataRepository } from '@/lib/authorization/tenant-role-lifecycle-data';
import type { TenantRoleState } from '@/lib/authorization/tenant-role-lifecycle';

export type RoleStatus = TenantRoleState;

export interface Role {
  id: string;
  name: string;
  description: string;
  status: RoleStatus;
  userCount: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

async function enforceRoleAccess(domain: string, operationId: string) {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const decision = await evaluator.evaluate({
    surface: "api",
    domain,
    operationId,
  });
  if (decision.kind !== "authorized") {
    if (decision.kind === "denied" && decision.external.status === 404) {
      notFound();
    }
    forbidden();
  }
  return decision.principal;
}

export async function getRoles(domain: string): Promise<Role[]> {
  const principal = await enforceRoleAccess(domain, 'tenant.roles.list');
  
  return db.transaction(async (tx) => {
    const repo = createTenantRoleLifecycleDataRepository(tx);
    const roles = await repo.listRoles(principal.tenantId);
    
    const results = [];
    for (const r of roles) {
      const userCount = await repo.countActiveAssignments(principal.tenantId, r.id);
      results.push({
        id: r.id,
        name: r.name,
        description: '', // description not stored in DB, reason used for audit
        status: r.lifecycle,
        userCount,
        permissions: [...r.permissions],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: r.version,
      });
    }
    return results;
  });
}

export async function getRole(domain: string, id: string): Promise<Role | null> {
  const principal = await enforceRoleAccess(domain, 'tenant.roles.list');
  
  return db.transaction(async (tx) => {
    const repo = createTenantRoleLifecycleDataRepository(tx);
    const r = await repo.getRole(principal.tenantId, id);
    if (!r) return null;
    
    const userCount = await repo.countActiveAssignments(principal.tenantId, r.id);
    return {
      id: r.id,
      name: r.name,
      description: '',
      status: r.lifecycle,
      userCount,
      permissions: [...r.permissions],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: r.version,
    };
  });
}

export async function createRole(domain: string, data: Partial<Role>): Promise<{ success: boolean; role?: Role; error?: string }> {
  try {
    const principal = await enforceRoleAccess(domain, 'tenant.roles.create');
    const service = createTenantRoleLifecycleDataService();
    
    const res = await service.createRole({
      principal,
      tenantId: principal.tenantId,
      name: data.name || '',
      origin: 'scratch',
      permissions: data.permissions || [],
      reason: data.description || 'Created via UI',
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    
    revalidatePath(`/${domain}/settings/roles`);
    return { success: true, role: { ...data, id: res.roleId, version: 1 } as Role };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create role' };
  }
}

export async function updateRole(domain: string, id: string, expectedVersion: number, data: Partial<Role>): Promise<{ success: boolean; error?: string }> {
  try {
    const principal = await enforceRoleAccess(domain, 'tenant.roles.rename');
    const service = createTenantRoleLifecycleDataService();
    const correlationId = randomUUID();
    
    if (data.name) {
      await service.renameRole({
        principal,
        tenantId: principal.tenantId,
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
    
    if (data.permissions) {
      // Need to find existing permissions to know what was added/removed
      const role = await getRole(domain, id);
      const existingPerms = new Set(role?.permissions || []);
      const newPerms = new Set(data.permissions);
      
      const addedPermissions = [...newPerms].filter(p => !existingPerms.has(p));
      const removedPermissions = [...existingPerms].filter(p => !newPerms.has(p));
      
      if (addedPermissions.length > 0 || removedPermissions.length > 0) {
        // Evaluate if they have change-permissions right
        await enforceRoleAccess(domain, 'tenant.roles.change-permissions');
        await service.editPermissions({
          principal,
          tenantId: principal.tenantId,
          roleId: id,
          expectedVersion,
          addedPermissions,
          removedPermissions,
          reason: data.description || 'Permissions updated via UI',
          idempotencyKey: randomUUID(),
          correlationId,
        });
      }
    }
    
    revalidatePath(`/${domain}/settings/roles`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update role' };
  }
}

export async function changeRoleStatus(domain: string, id: string, expectedVersion: number, status: RoleStatus): Promise<{ success: boolean; error?: string }> {
  try {
    const service = createTenantRoleLifecycleDataService();
    const correlationId = randomUUID();
    
    let principal;
    if (status === 'active') {
      principal = await enforceRoleAccess(domain, 'tenant.roles.activate');
      await service.activateRole({
        principal,
        tenantId: principal.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to active via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'draft') {
      principal = await enforceRoleAccess(domain, 'tenant.roles.draft');
      await service.draftRole({
        principal,
        tenantId: principal.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to draft via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    } else if (status === 'archived') {
      principal = await enforceRoleAccess(domain, 'tenant.roles.archive');
      await service.archiveRole({
        principal,
        tenantId: principal.tenantId,
        roleId: id,
        expectedVersion,
        reason: 'Status changed to archived via UI',
        idempotencyKey: randomUUID(),
        correlationId,
      });
    }
    
    revalidatePath(`/${domain}/settings/roles`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to change role status' };
  }
}
