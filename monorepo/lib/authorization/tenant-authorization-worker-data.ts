import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applicant,
  providerAdmin,
  schoolAdminAuthority,
  schoolPerson,
  tenant,
  tenantAccountSecurity,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
  tenantRbacRollout,
  user,
} from "@/db/schema";
import {
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationAccount,
  type TenantAuthorizationAuthority,
  type TenantAuthorizationRollout,
  type TenantAuthorizationStore,
  type TenantAuthorizationTenant,
} from "@/lib/authorization/tenant-authorization";
import { validateEmergencyOverlay } from "@/lib/authorization/tenant-rbac-rollout";

function date(value: unknown): Date | null {
  return value === null || value === undefined ? null : new Date(value as string | number | Date);
}

export const tenantAuthorizationStore: TenantAuthorizationStore = {
  async loadAccount(userId) {
    const [account] = await db
      .select({
        userId: user.id,
        tenantId: user.tenantId,
        lifecycle: tenantAccountSecurity.lifecycle,
      })
      .from(user)
      .leftJoin(tenantAccountSecurity, and(
        eq(tenantAccountSecurity.tenantId, user.tenantId),
        eq(tenantAccountSecurity.userId, user.id),
      ))
      .where(eq(user.id, userId))
      .limit(1);

    if (!account) return null;

    const tenantId = account.tenantId;
    if (!tenantId) {
      return {
        userId: account.userId,
        tenantId: null,
        selfPersonId: null,
        accountLifecycle: account.lifecycle ?? null,
        providerAdmin: false,
        applicant: false,
        activationComplete: true,
      };
    }

    const [selfPerson] = await db
      .select({ count: count() })
      .from(schoolPerson)
      .where(and(eq(schoolPerson.tenantId, tenantId), eq(schoolPerson.accountUserId, account.userId)));

    const [providerAdminRow] = await db
      .select({ count: count() })
      .from(providerAdmin)
      .where(eq(providerAdmin.userId, account.userId));

    const [applicantRow] = await db
      .select({ count: count() })
      .from(applicant)
      .where(eq(applicant.userId, account.userId));

    return {
      userId: account.userId,
      tenantId,
      selfPersonId: Number(selfPerson.count) > 0 ? "linked" : null,
      accountLifecycle: account.lifecycle ?? null,
      providerAdmin: Number(providerAdminRow.count) === 1,
      applicant: Number(applicantRow.count) === 1,
      activationComplete: true,
    };
  },

  async loadTenantByDomain(domain) {
    const [tenantRow] = await db
      .select({
        id: tenant.id,
        domain: tenant.domain,
        npsn: tenant.npsn,
        operationalStatus: tenant.operationalStatus,
        trialEndsAt: tenant.trialEndsAt,
        settings: tenant.settings,
      })
      .from(tenant)
      .where(eq(tenant.domain, domain))
      .limit(1);

    if (!tenantRow) return null;
    return {
      id: tenantRow.id,
      domain: tenantRow.domain,
      npsn: tenantRow.npsn,
      operationalStatus: tenantRow.operationalStatus,
      trialEndsAt: date(tenantRow.trialEndsAt),
      settings: tenantRow.settings,
    };
  },

  async loadAuthority(userId, tenantId) {
    const authorityRows = await db
      .select({ authorityState: schoolAdminAuthority.authorityState })
      .from(schoolAdminAuthority)
      .where(and(eq(schoolAdminAuthority.userId, userId), eq(schoolAdminAuthority.tenantId, tenantId)));

    const assignmentRows = await db
      .select({
        assignmentId: tenantRoleAssignment.id,
        assignmentState: tenantRoleAssignment.state,
        roleId: tenantRole.id,
        roleLifecycle: tenantRole.lifecycle,
        permissionKey: tenantRolePermission.permissionKey,
      })
      .from(tenantRoleAssignment)
      .innerJoin(tenantRole, and(eq(tenantRole.tenantId, tenantRoleAssignment.tenantId), eq(tenantRole.id, tenantRoleAssignment.roleId)))
      .leftJoin(tenantRolePermission, and(eq(tenantRolePermission.tenantId, tenantRole.tenantId), eq(tenantRolePermission.roleId, tenantRole.id)))
      .where(and(eq(tenantRoleAssignment.userId, userId), eq(tenantRoleAssignment.tenantId, tenantId)));

    const assignments = new Map<string, { assignmentId: string; assignmentState: string; roleId: string; roleLifecycle: string; permissionKeys: string[] }>();
    for (const row of assignmentRows) {
      const assignmentId = row.assignmentId;
      const assignment = assignments.get(assignmentId) ?? {
        assignmentId,
        assignmentState: row.assignmentState,
        roleId: row.roleId,
        roleLifecycle: row.roleLifecycle,
        permissionKeys: [],
      };
      if (row.permissionKey !== null) assignment.permissionKeys.push(row.permissionKey);
      assignments.set(assignmentId, assignment);
    }

    return {
      schoolAdminAuthorityStates: authorityRows.map((row) => row.authorityState),
      assignments: [...assignments.values()].map((assignment) => ({
        ...assignment,
        permissionKeys: [...new Set(assignment.permissionKeys)].sort(),
      })),
      hiddenMenuKeys: [],
    };
  },

  async loadRollout(tenantId) {
    const [row] = await db
      .select({
        httpMode: tenantRbacRollout.httpMode,
        workerMode: tenantRbacRollout.workerMode,
        epoch: tenantRbacRollout.epoch,
        resolverVersion: tenantRbacRollout.resolverVersion,
        registryVersion: tenantRbacRollout.registryVersion,
        operationMapVersion: tenantRbacRollout.operationMapVersion,
        overlayHash: tenantRbacRollout.overlayHash,
        overlayPolicyVersion: tenantRbacRollout.overlayPolicyVersion,
        overlayDeniedOperationIds: tenantRbacRollout.overlayDeniedOperationIds,
        overlayDeniedPermissionKeys: tenantRbacRollout.overlayDeniedPermissionKeys,
        overlayDenyMutations: tenantRbacRollout.overlayDenyMutations,
        overlayReviewAt: tenantRbacRollout.overlayReviewAt,
        overlayExpiresAt: tenantRbacRollout.overlayExpiresAt,
      })
      .from(tenantRbacRollout)
      .where(eq(tenantRbacRollout.tenantId, tenantId))
      .limit(1);

    if (!row) return null;

    const jsonArray = (value: unknown): readonly string[] => {
      const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) throw new Error("invalid-emergency-overlay");
      return parsed;
    };

    const emergencyOverlay = row.overlayHash === null ? null : validateEmergencyOverlay({
      overlayHash: row.overlayHash,
      deniedOperationIds: jsonArray(row.overlayDeniedOperationIds),
      deniedPermissionKeys: jsonArray(row.overlayDeniedPermissionKeys),
      denyMutations: row.overlayDenyMutations ?? false,
      policyVersion: row.overlayPolicyVersion ?? "",
      reviewAt: date(row.overlayReviewAt) ?? new Date(Number.NaN),
      expiresAt: date(row.overlayExpiresAt) ?? new Date(Number.NaN),
    });

    return {
      httpMode: row.httpMode,
      workerMode: row.workerMode,
      epoch: row.epoch,
      resolverVersion: row.resolverVersion,
      registryVersion: row.registryVersion,
      operationMapVersion: row.operationMapVersion,
      emergencyOverlay,
    };
  },
};

export function createWorkerTenantAuthorizationEvaluator(actorUserId: string) {
  const evaluator = createTenantAuthorizationEvaluator({ store: tenantAuthorizationStore });
  return Object.freeze({
    evaluate(request: Omit<Parameters<typeof evaluator.evaluate>[0], "sessionUserId">) {
      return evaluator.evaluate({ ...request, sessionUserId: actorUserId, surface: "worker" });
    },
  });
}

export async function closeWorkerTenantAuthorizationPool() {
  // Pool is now managed globally via db/index.ts
}
