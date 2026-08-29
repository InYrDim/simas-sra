import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  applicant,
  providerAdmin,
  schoolAdminAuthority,
  schoolPerson,
  temporaryCredentialActivation,
  tenant,
  tenantAccountSecurity,
  tenantRbacRollout,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
  tenantRoleMenuVisibility,
  user,
} from "@/db/schema";
import {
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationRequest,
  type TenantAuthorizationStore,
} from "@/lib/authorization/tenant-authorization";
import { validateEmergencyOverlay } from "@/lib/authorization/tenant-rbac-rollout";
import { auth } from "@/lib/platform/auth";

export const tenantAuthorizationStore: TenantAuthorizationStore = {
  async loadAccount(userId) {
    const [row] = await db
      .select({
        userId: user.id,
        tenantId: user.tenantId,
        selfPersonId: schoolPerson.id,
        accountLifecycle: tenantAccountSecurity.lifecycle,
        providerAdminUserId: providerAdmin.userId,
        applicantUserId: applicant.userId,
        activationUserId: temporaryCredentialActivation.userId,
        firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
        passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
        passwordChangedAt: temporaryCredentialActivation.passwordChangedAt,
      })
      .from(user)
      .leftJoin(schoolPerson, and(eq(schoolPerson.tenantId, user.tenantId), eq(schoolPerson.accountUserId, user.id)))
      .leftJoin(tenantAccountSecurity, eq(tenantAccountSecurity.userId, user.id))
      .leftJoin(providerAdmin, eq(providerAdmin.userId, user.id))
      .leftJoin(applicant, eq(applicant.userId, user.id))
      .leftJoin(temporaryCredentialActivation, eq(temporaryCredentialActivation.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) return null;
    const activationComplete = row.activationUserId === null || (
      row.firstAuthenticatedAt !== null &&
      row.passwordChangeRequired === false &&
      row.passwordChangedAt !== null
    );
    return {
      userId: row.userId,
      tenantId: row.tenantId,
      selfPersonId: row.selfPersonId ?? null,
      accountLifecycle: row.accountLifecycle,
      providerAdmin: row.providerAdminUserId !== null,
      applicant: row.applicantUserId !== null,
      activationComplete,
    };
  },

  async loadTenantByDomain(domain) {
    const [row] = await db
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
    return row ?? null;
  },

  async loadAuthority(userId, tenantId) {
    const [authorityRows, assignmentRows, menuVisibilityRows] = await Promise.all([
      db
        .select({ state: schoolAdminAuthority.authorityState })
        .from(schoolAdminAuthority)
        .where(and(
          eq(schoolAdminAuthority.userId, userId),
          eq(schoolAdminAuthority.tenantId, tenantId),
        )),
      db
        .select({
          assignmentId: tenantRoleAssignment.id,
          assignmentState: tenantRoleAssignment.state,
          roleId: tenantRole.id,
          roleLifecycle: tenantRole.lifecycle,
          permissionKey: tenantRolePermission.permissionKey,
        })
        .from(tenantRoleAssignment)
        .innerJoin(tenantRole, and(
          eq(tenantRole.id, tenantRoleAssignment.roleId),
          eq(tenantRole.tenantId, tenantRoleAssignment.tenantId),
        ))
        .leftJoin(tenantRolePermission, and(
          eq(tenantRolePermission.roleId, tenantRole.id),
          eq(tenantRolePermission.tenantId, tenantRole.tenantId),
        ))
        .where(and(
          eq(tenantRoleAssignment.userId, userId),
          eq(tenantRoleAssignment.tenantId, tenantId),
        )),
      db
        .select({
          roleId: tenantRoleMenuVisibility.roleId,
          menuKey: tenantRoleMenuVisibility.menuKey,
          visible: tenantRoleMenuVisibility.visible,
        })
        .from(tenantRoleMenuVisibility)
        .innerJoin(tenantRoleAssignment, and(
          eq(tenantRoleAssignment.roleId, tenantRoleMenuVisibility.roleId),
          eq(tenantRoleAssignment.tenantId, tenantRoleMenuVisibility.tenantId),
        ))
        .where(and(
          eq(tenantRoleAssignment.userId, userId),
          eq(tenantRoleAssignment.tenantId, tenantId),
          eq(tenantRoleAssignment.state, "active"),
        )),
    ]);

    const assignments = new Map<string, {
      assignmentId: string;
      assignmentState: string;
      roleId: string;
      roleLifecycle: string;
      permissionKeys: string[];
    }>();
    for (const row of assignmentRows) {
      let assignment = assignments.get(row.assignmentId);
      if (!assignment) {
        assignment = {
          assignmentId: row.assignmentId,
          assignmentState: row.assignmentState,
          roleId: row.roleId,
          roleLifecycle: row.roleLifecycle,
          permissionKeys: [],
        };
        assignments.set(row.assignmentId, assignment);
      }
      if (row.permissionKey !== null) assignment.permissionKeys.push(row.permissionKey);
    }

    // A menu key is hidden for the user when any active role assignment marks
    // it not visible. Absent rows default to visible, so the hidden set only
    // ever grows from explicit `visible = false` rows.
    const hiddenMenuKeys = new Set<string>();
    for (const row of menuVisibilityRows) {
      if (row.visible === false) hiddenMenuKeys.add(row.menuKey);
    }

    return {
      schoolAdminAuthorityStates: authorityRows.map((row) => row.state),
      assignments: [...assignments.values()].map((assignment) => ({
        ...assignment,
        permissionKeys: [...new Set(assignment.permissionKeys)].sort(),
      })),
      hiddenMenuKeys: [...hiddenMenuKeys].sort(),
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
    const emergencyOverlay = row.overlayHash === null ? null : validateEmergencyOverlay({
      overlayHash: row.overlayHash,
      deniedOperationIds: row.overlayDeniedOperationIds ?? [],
      deniedPermissionKeys: row.overlayDeniedPermissionKeys ?? [],
      denyMutations: row.overlayDenyMutations ?? false,
      policyVersion: row.overlayPolicyVersion ?? "",
      reviewAt: row.overlayReviewAt ?? new Date(Number.NaN),
      expiresAt: row.overlayExpiresAt ?? new Date(Number.NaN),
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

export function createPersistedTenantAuthorizationEvaluator() {
  return createTenantAuthorizationEvaluator({ store: tenantAuthorizationStore });
}

type AuthenticatedTenantAuthorizationRequest = Omit<TenantAuthorizationRequest, "sessionUserId">;

/**
 * Creates one evaluator for one HTTP request. Reuse the returned object within
 * that request to share only its in-memory reads; never retain it globally.
 */
export async function createHttpTenantAuthorizationEvaluator() {
  const session = await auth.api.getSession({ headers: await headers() });
  const evaluator = createPersistedTenantAuthorizationEvaluator();
  return Object.freeze({
    evaluate(request: AuthenticatedTenantAuthorizationRequest) {
      return evaluator.evaluate({ ...request, sessionUserId: session?.user.id ?? null });
    },
  });
}

/** Workers pass the persisted actor ID from the job and must also pass the enqueue epoch. */
export function createWorkerTenantAuthorizationEvaluator(actorUserId: string) {
  const evaluator = createPersistedTenantAuthorizationEvaluator();
  return Object.freeze({
    evaluate(request: Omit<AuthenticatedTenantAuthorizationRequest, "surface">) {
      return evaluator.evaluate({ ...request, sessionUserId: actorUserId, surface: "worker" });
    },
  });
}
