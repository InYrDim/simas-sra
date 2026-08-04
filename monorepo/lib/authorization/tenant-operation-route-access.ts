import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantAuthorizationResult } from "@/lib/authorization/tenant-authorization";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";
import { alias } from "drizzle-orm/mysql-core";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { classMembership, schoolPerson, studentProfile, teacherProfile, teachingAssignment } from "@/db/schema";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

export function enforceAuthorizedTenantOperation(
  result: TenantAuthorizationResult,
  audit: Readonly<{ domain: string; operationId: string }>,
) {
  if (result.kind === "authorized") return result.principal;
  console.warn({
    event: "tenant_operation_denied",
    domain: audit.domain,
    operationId: audit.operationId,
    reason: result.internal.code,
  });
  if (result.external.status === 404) notFound();
  forbidden();
}

export async function enforceTenantMasterDataOperation(
  domain: string,
  operationId: string,
  requestedPermissions?: readonly string[],
): Promise<MasterDataPrincipal> {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operation = tenantOperationMap.find((candidate) => candidate.id === operationId);
  const result = await evaluator.evaluate({
    surface: "api",
    domain,
    operationId,
    requestedPermissions,
    context: operation && !["tenant-wide", "none", "school-admin-only"].includes(operation.contextualPolicy)
      ? {
        policy: operation.contextualPolicy,
        async evaluate(principal) {
          if (operation.contextualPolicy === "self") return { allowed: Boolean(principal.selfPersonId), arm: "self" as const };
          if (principal.selfPersonId) return { allowed: true, arm: "self" as const };
          const assigned = await loadAssignedPersonIds(principal.tenantId, principal.userId);
          return { allowed: assigned.size > 0, arm: "assigned" as const };
        },
      }
      : undefined,
  });
  const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });
  if (!operation) throw new Error(`Unknown Tenant operation: ${operationId}`);
  const assignedPersonIds = await loadAssignedPersonIds(principal.tenantId, principal.userId);
  return {
    userId: principal.userId,
    tenantId: principal.tenantId,
    role: "school-admin",
    capabilities: {
      read: true,
      write: operation.operationalGate === "write" || principal.schoolAdmin,
      downloadTemplate: false,
    },
    schoolAdmin: principal.schoolAdmin,
    permissions: principal.permissions,
    selfPersonId: principal.selfPersonId,
    assignedPersonIds,
  };
}

async function loadAssignedPersonIds(tenantId: string, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const teacherPerson = alias(schoolPerson, "assigned_teacher_person");
  const [teacherRows, studentRows] = await Promise.all([
    db.select({ personId: schoolPerson.id }).from(teachingAssignment)
      .innerJoin(teacherProfile, and(eq(teacherProfile.tenantId, teachingAssignment.tenantId), eq(teacherProfile.id, teachingAssignment.teacherProfileId)))
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)))
      .where(and(eq(teachingAssignment.tenantId, tenantId), eq(schoolPerson.accountUserId, userId), eq(teachingAssignment.status, "active"), lte(teachingAssignment.startsOn, today), or(isNull(teachingAssignment.endsOn), gt(teachingAssignment.endsOn, today)))) ,
    db.select({ personId: schoolPerson.id }).from(classMembership)
      .innerJoin(teachingAssignment, and(eq(teachingAssignment.tenantId, classMembership.tenantId), eq(teachingAssignment.classGroupId, classMembership.classGroupId)))
      .innerJoin(teacherProfile, and(eq(teacherProfile.tenantId, teachingAssignment.tenantId), eq(teacherProfile.id, teachingAssignment.teacherProfileId)))
      .innerJoin(teacherPerson, and(eq(teacherPerson.tenantId, teacherProfile.tenantId), eq(teacherPerson.id, teacherProfile.personId)))
      .innerJoin(studentProfile, and(eq(studentProfile.tenantId, classMembership.tenantId), eq(studentProfile.id, classMembership.studentId)))
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId)))
      .where(and(eq(classMembership.tenantId, tenantId), eq(teacherPerson.accountUserId, userId), eq(teachingAssignment.status, "active"), lte(teachingAssignment.startsOn, today), or(isNull(teachingAssignment.endsOn), gt(teachingAssignment.endsOn, today)), isNull(classMembership.endedAt))),
  ]);
  return new Set([...teacherRows, ...studentRows].map(({ personId }) => personId));
}
