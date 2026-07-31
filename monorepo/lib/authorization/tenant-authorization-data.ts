import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  applicant,
  providerAdmin,
  schoolAdminAuthority,
  temporaryCredentialActivation,
  tenant,
  tenantAccountSecurity,
  tenantRbacRollout,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
  user,
} from "@/db/schema";
import {
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationComparisonRecorder,
  type TenantAuthorizationRequest,
  type TenantAuthorizationStore,
} from "@/lib/authorization/tenant-authorization";
import { auth } from "@/lib/platform/auth";

export const tenantAuthorizationStore: TenantAuthorizationStore = {
  async loadAccount(userId) {
    const [row] = await db
      .select({
        userId: user.id,
        tenantId: user.tenantId,
        legacyRole: user.tenantRole,
        accountLifecycle: tenantAccountSecurity.lifecycle,
        providerAdminUserId: providerAdmin.userId,
        applicantUserId: applicant.userId,
        activationUserId: temporaryCredentialActivation.userId,
        firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
        passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
        passwordChangedAt: temporaryCredentialActivation.passwordChangedAt,
      })
      .from(user)
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
      legacyRole: row.legacyRole,
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
    const [authorityRows, assignmentRows] = await Promise.all([
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

    return {
      schoolAdminAuthorityStates: authorityRows.map((row) => row.state),
      assignments: [...assignments.values()].map((assignment) => ({
        ...assignment,
        permissionKeys: [...new Set(assignment.permissionKeys)].sort(),
      })),
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
      })
      .from(tenantRbacRollout)
      .where(eq(tenantRbacRollout.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  },
};

export const tenantAuthorizationComparisonRecorder: TenantAuthorizationComparisonRecorder = {
  record(comparison) {
    console.info({ event: "tenant_authorization_shadow_comparison", ...comparison });
  },
};

export function createPersistedTenantAuthorizationEvaluator() {
  return createTenantAuthorizationEvaluator({
    store: tenantAuthorizationStore,
    comparisonRecorder: tenantAuthorizationComparisonRecorder,
  });
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
