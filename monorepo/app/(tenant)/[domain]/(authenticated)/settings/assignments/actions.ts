'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { forbidden, notFound } from 'next/navigation';

import { db } from '@/db';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import {
  createTenantRoleAssignmentDataRepository,
  createTenantRoleAssignmentDataService,
  createTenantRoleBulkAssignmentDataService,
  listEligibleAssignmentAccounts,
  previewTenantRoleBulkAssignment,
  type EligibleAssignmentAccount,
} from '@/lib/authorization/tenant-role-assignment-data';
import {
  getAssignmentAccountAccess,
  type AssignmentAccountAccess,
} from '@/lib/authorization/tenant-role-assignment-query-data';
import type { SecurityPrincipal } from '@/lib/authorization/security-command';
import type { AssignmentRoleRow } from '@/lib/authorization/tenant-role-assignment';
import type {
  BulkRoleOperation,
  BulkRoleOutcome,
  BulkRoleTarget,
} from '@/lib/authorization/tenant-role-bulk-assignment';
import type { MySqlSecurityCommandTransaction } from '@/lib/authorization/security-command-store';

export type AssignmentActionResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; error: string; stale?: boolean }>;

async function enforceAssignmentAccess(domain: string, operationId: string): Promise<{
  tenantId: string;
  principal: SecurityPrincipal;
}> {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const decision = await evaluator.evaluate({ surface: 'api', domain, operationId });
  if (decision.kind !== 'authorized') {
    if (decision.kind === 'denied' && decision.external.status === 404) notFound();
    forbidden();
  }
  return {
    tenantId: decision.principal.tenantId,
    principal: { kind: 'authenticated-user', userId: decision.principal.userId },
  };
}

function failure(error: unknown): AssignmentActionResult<never> {
  const stale = error instanceof Error && 'code' in error && error.code === 'stale-version';
  return {
    success: false,
    stale,
    error: stale
      ? 'Data assignment sudah berubah. Muat ulang data pengguna lalu coba lagi.'
      : 'Perubahan tidak dapat diproses. Periksa target, role, alasan, dan konfirmasi Anda.',
  };
}

export async function getAssignmentRolesAction(domain: string): Promise<readonly AssignmentRoleRow[]> {
  const { tenantId } = await enforceAssignmentAccess(domain, 'tenant.assignments.view');
  return db.transaction(async (transaction) => {
    const controlled = { database: transaction } as MySqlSecurityCommandTransaction;
    return createTenantRoleAssignmentDataRepository(controlled).listActiveRoles(tenantId);
  });
}

export async function searchEligibleAccountsAction(
  domain: string,
  input: Readonly<{ query?: string; lifecycle?: 'pending-activation' | 'active' | 'inactive' }>,
): Promise<readonly EligibleAssignmentAccount[]> {
  const { tenantId } = await enforceAssignmentAccess(domain, 'tenant.assignments.view');
  return listEligibleAssignmentAccounts({ tenantId, ...input, limit: 100 });
}

export async function getEffectiveAccessAction(
  domain: string,
  userId: string,
): Promise<AssignmentAccountAccess | null> {
  const { tenantId } = await enforceAssignmentAccess(domain, 'tenant.effective-access.view');
  return getAssignmentAccountAccess(tenantId, userId);
}

export async function replaceRoleSetAction(
  domain: string,
  input: Readonly<{
    targetUserId: string;
    roleIds: readonly string[];
    expectedAssignmentVersion: number;
    reason: string;
    confirmZeroAccess: boolean;
  }>,
): Promise<AssignmentActionResult<AssignmentAccountAccess>> {
  try {
    const { tenantId, principal } = await enforceAssignmentAccess(domain, 'tenant.assignments.replace');
    await createTenantRoleAssignmentDataService().replaceRoleSet({
      principal,
      tenantId,
      ...input,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    const account = await getAssignmentAccountAccess(tenantId, input.targetUserId);
    if (!account) return { success: false, error: 'Pengguna tidak lagi memenuhi syarat assignment.' };
    revalidatePath(`/${domain}/settings/assignments`);
    return { success: true, data: account };
  } catch (error) {
    return failure(error);
  }
}

export async function previewBulkRoleChangeAction(
  domain: string,
  input: Readonly<{ operation: BulkRoleOperation; roleIds: readonly string[]; targets: readonly BulkRoleTarget[] }>,
): Promise<AssignmentActionResult<readonly BulkRoleOutcome[]>> {
  try {
    const { tenantId, principal } = await enforceAssignmentAccess(domain, 'tenant.assignments.bulk');
    const result = await previewTenantRoleBulkAssignment({ principal, tenantId, ...input });
    return { success: true, data: result.outcomes };
  } catch (error) {
    return failure(error);
  }
}

export async function commitBulkRoleChangeAction(
  domain: string,
  input: Readonly<{
    operation: BulkRoleOperation;
    roleIds: readonly string[];
    targets: readonly BulkRoleTarget[];
    reason: string;
    confirmZeroAccess: boolean;
  }>,
): Promise<AssignmentActionResult<readonly BulkRoleOutcome[]>> {
  try {
    const { tenantId, principal } = await enforceAssignmentAccess(domain, 'tenant.assignments.bulk');
    const result = await createTenantRoleBulkAssignmentDataService().commit({
      principal,
      tenantId,
      ...input,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    revalidatePath(`/${domain}/settings/assignments`);
    return { success: true, data: result.outcomes };
  } catch (error) {
    return failure(error);
  }
}
