import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { TenantAuthorizationResult } from "@/lib/authorization/tenant-authorization";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";
import { alias } from "drizzle-orm/mysql-core";
import { and, eq, gt, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { academicYear, classGroup, classMembership, schoolPerson, studentProfile, teacherProfile, teachingAssignment } from "@/db/schema";
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
      write: !principal.readOnly && (operation.operationalGate === "write" || principal.schoolAdmin),
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
      .innerJoin(classGroup, and(eq(classGroup.tenantId, teachingAssignment.tenantId), eq(classGroup.id, teachingAssignment.classGroupId), eq(classGroup.academicYearId, teachingAssignment.academicYearId)))
      .innerJoin(academicYear, and(eq(academicYear.tenantId, teachingAssignment.tenantId), eq(academicYear.id, teachingAssignment.academicYearId)))
      .where(and(eq(teachingAssignment.tenantId, tenantId), eq(schoolPerson.accountUserId, userId), eq(teachingAssignment.status, "active"), eq(teacherProfile.status, "active"), eq(teacherProfile.archived, false), eq(schoolPerson.archived, false), eq(classGroup.archived, false), eq(academicYear.archived, false), lte(academicYear.startDate, today), gte(academicYear.endDate, today), lte(teachingAssignment.startsOn, today), or(isNull(teachingAssignment.endsOn), gt(teachingAssignment.endsOn, today)))),
    db.select({ personId: schoolPerson.id }).from(classMembership)
      .innerJoin(teachingAssignment, and(eq(teachingAssignment.tenantId, classMembership.tenantId), eq(teachingAssignment.classGroupId, classMembership.classGroupId), eq(teachingAssignment.academicYearId, classMembership.academicYearId)))
      .innerJoin(teacherProfile, and(eq(teacherProfile.tenantId, teachingAssignment.tenantId), eq(teacherProfile.id, teachingAssignment.teacherProfileId)))
      .innerJoin(teacherPerson, and(eq(teacherPerson.tenantId, teacherProfile.tenantId), eq(teacherPerson.id, teacherProfile.personId)))
      .innerJoin(studentProfile, and(eq(studentProfile.tenantId, classMembership.tenantId), eq(studentProfile.id, classMembership.studentId)))
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId)))
      .innerJoin(classGroup, and(eq(classGroup.tenantId, classMembership.tenantId), eq(classGroup.id, classMembership.classGroupId), eq(classGroup.academicYearId, classMembership.academicYearId)))
      .innerJoin(academicYear, and(eq(academicYear.tenantId, classMembership.tenantId), eq(academicYear.id, classMembership.academicYearId)))
      .where(and(eq(classMembership.tenantId, tenantId), eq(classMembership.planned, false), eq(teacherPerson.accountUserId, userId), eq(teachingAssignment.status, "active"), eq(teacherProfile.status, "active"), eq(teacherProfile.archived, false), eq(teacherPerson.archived, false), eq(studentProfile.status, "active"), eq(studentProfile.archived, false), eq(schoolPerson.archived, false), eq(classGroup.archived, false), eq(academicYear.archived, false), lte(academicYear.startDate, today), gte(academicYear.endDate, today), lte(teachingAssignment.startsOn, today), or(isNull(teachingAssignment.endsOn), gt(teachingAssignment.endsOn, today)), lte(classMembership.startedAt, today), or(isNull(classMembership.endedAt), gt(classMembership.endedAt, today)))),
  ]);
  return new Set([...teacherRows, ...studentRows].map(({ personId }) => personId));
}
