'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { forbidden, notFound } from 'next/navigation';

import { db } from '@/db';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import {
  createTenantAccountLifecycleDataService,
  listLinkableTenantSchoolPeople,
  listTenantLifecycleAccounts,
  type LinkableTenantSchoolPerson,
} from '@/lib/authorization/tenant-account-lifecycle-data';
import type {
  LifecycleDeliveryChannel,
  TenantLifecycleAccount,
} from '@/lib/authorization/tenant-account-lifecycle';
import type { SecurityPrincipal } from '@/lib/authorization/security-command';
import type { MySqlSecurityCommandTransaction } from '@/lib/authorization/security-command-store';
import { createTenantRoleAssignmentDataRepository } from '@/lib/authorization/tenant-role-assignment-data';
import type { AssignmentRoleRow } from '@/lib/authorization/tenant-role-assignment';

export type LifecycleWorkspaceAccount = TenantLifecycleAccount & Readonly<{
  formerRoleIds: readonly string[];
}>;

export type LifecycleWorkspaceData = Readonly<{
  accounts: readonly LifecycleWorkspaceAccount[];
  people: readonly LinkableTenantSchoolPerson[];
  roles: readonly AssignmentRoleRow[];
}>;

export type LifecycleActionResult<T = undefined> =
  | Readonly<{ success: true; data: T; message: string; secret?: string }>
  | Readonly<{ success: false; error: string; stale?: boolean }>;

type AuthorizedContext = Readonly<{
  tenantId: string;
  principal: SecurityPrincipal;
}>;

async function authorize(domain: string, operationId: string): Promise<AuthorizedContext> {
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

function failure(error: unknown): LifecycleActionResult<never> {
  const rawCode = error instanceof Error && 'code' in error ? (error as { code: unknown }).code : undefined;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const stale = code === 'stale-version' || code === 'idempotency-conflict';
  if (stale) {
    return {
      success: false,
      stale,
      error: 'Data akun telah berubah. Data terbaru sedang dimuat; periksa kembali sebelum mencoba lagi.',
    };
  }
  return { success: false, error: lifecycleFailureMessage(code) };
}

function lifecycleFailureMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid-command':
      return 'Data tidak valid. Periksa nama, format email, dan person yang dipilih.';
    case 'context-denied':
      return 'Tidak dapat memproses. Email mungkin sudah terdaftar, person tidak valid, atau Anda tidak memiliki wewenang school-admin.';
    case 'unauthenticated':
      return 'Sesi tidak valid. Silakan keluar dan masuk kembali.';
    case 'command-in-progress':
      return 'Tindakan sedang diproses. Tunggu sebentar lalu coba lagi.';
    case 'integrity-failure':
      return 'Tindakan gagal diverifikasi. Hubungi administrator sistem.';
    default:
      return 'Tindakan tidak dapat diproses. Periksa data, status akun, dan kewenangan Anda.';
  }
}

function refresh(domain: string): void {
  revalidatePath(`/${domain}/users`);
}

function commandIds() {
  return { idempotencyKey: randomUUID(), correlationId: randomUUID() };
}

export async function getLifecycleWorkspaceAction(domain: string): Promise<LifecycleWorkspaceData> {
  const { tenantId } = await authorize(domain, 'tenant.accounts.view');
  const [accounts, people, roleData] = await Promise.all([
    listTenantLifecycleAccounts({ tenantId, limit: 100 }),
    listLinkableTenantSchoolPeople({ tenantId, limit: 100 }),
    db.transaction(async (transaction) => {
      const repository = createTenantRoleAssignmentDataRepository({ database: transaction } as MySqlSecurityCommandTransaction);
      const roles = await repository.listActiveRoles(tenantId);
      return { repository, roles };
    }),
  ]);
  const formerRoles = await db.transaction(async (transaction) => {
    const repository = createTenantRoleAssignmentDataRepository({ database: transaction } as MySqlSecurityCommandTransaction);
    return Promise.all(accounts.map(async (account) => ({
      userId: account.userId,
      roleIds: (await repository.listAssignments(tenantId, account.userId)).map((assignment) => assignment.roleId),
    })));
  });
  const byUser = new Map(formerRoles.map((entry) => [entry.userId, entry.roleIds]));
  return {
    accounts: accounts.map((account) => ({ ...account, formerRoleIds: byUser.get(account.userId) ?? [] })),
    people,
    roles: roleData.roles,
  };
}

export async function createTenantAccountAction(
  domain: string,
  input: Readonly<{
    name: string;
    email: string;
    personId?: string;
    deliveryChannel: LifecycleDeliveryChannel | 'administrative';
  }>,
): Promise<LifecycleActionResult<{ targetUserId: string }>> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.create');
    const result = await createTenantAccountLifecycleDataService().create({
      principal, tenantId, ...input, ...commandIds(),
    });
    refresh(domain);
    return {
      success: true,
      data: { targetUserId: result.targetUserId },
      message: input.deliveryChannel === 'administrative'
        ? 'Akun aktif berhasil dibuat.'
        : 'Akun dan instruksi aktivasi berhasil dibuat.',
      ...('secret' in result && result.secret ? { secret: result.secret } : {}),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function issueTenantActivationAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; deliveryChannel: LifecycleDeliveryChannel; mode: 'resend' | 'reissue' }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.issue-activation');
    const result = await createTenantAccountLifecycleDataService().issueActivation({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: input.mode === 'resend' ? 'Instruksi aktivasi dikirim ulang.' : 'Instruksi aktivasi baru diterbitkan.', ...('secret' in result && result.secret ? { secret: result.secret } : {}) };
  } catch (error) {
    return failure(error);
  }
}

export async function activateTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; reason: string }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.activate');
    await createTenantAccountLifecycleDataService().activateAdministratively({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Akun berhasil diaktifkan secara administratif.' };
  } catch (error) {
    return failure(error);
  }
}

export async function deactivateTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; reason: string }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.deactivate');
    await createTenantAccountLifecycleDataService().deactivate({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Akun dinonaktifkan, sesi dicabut, dan penugasan role ditangguhkan.' };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; reason: string }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.delete');
    await createTenantAccountLifecycleDataService().deleteAccount({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Akun dihapus: akses ditutup, kredensial dihapus, dan tautan person dilepaskan. Jejak audit tetap tersimpan.' };
  } catch (error) {
    return failure(error);
  }
}

export async function reactivateTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; reason: string; roleIds: readonly string[] }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.reactivate');
    await createTenantAccountLifecycleDataService().reactivate({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Akun berhasil diaktifkan kembali dengan role yang dipilih.' };
  } catch (error) {
    return failure(error);
  }
}

export async function initiateTenantRecoveryAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; deliveryChannel: LifecycleDeliveryChannel; mode: 'resend' | 'reissue' }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.recovery');
    const result = await createTenantAccountLifecycleDataService().initiateRecovery({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: input.mode === 'resend' ? 'Instruksi pemulihan dikirim ulang.' : 'Instruksi pemulihan baru diterbitkan.', ...('secret' in result && result.secret ? { secret: result.secret } : {}) };
  } catch (error) {
    return failure(error);
  }
}

export async function linkTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; personId: string; reason: string }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.link');
    await createTenantAccountLifecycleDataService().linkAccount({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Akun berhasil ditautkan ke person sekolah.' };
  } catch (error) {
    return failure(error);
  }
}

export async function unlinkTenantAccountAction(
  domain: string,
  input: Readonly<{ targetUserId: string; expectedVersion: number; reason: string }>,
): Promise<LifecycleActionResult> {
  try {
    const { tenantId, principal } = await authorize(domain, 'tenant.accounts.unlink');
    await createTenantAccountLifecycleDataService().unlinkAccount({ principal, tenantId, ...input, ...commandIds() });
    refresh(domain);
    return { success: true, data: undefined, message: 'Tautan person sekolah dilepaskan dari akun.' };
  } catch (error) {
    return failure(error);
  }
}
