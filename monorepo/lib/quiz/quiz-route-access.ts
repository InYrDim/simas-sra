import "server-only";

import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";
import { quizSessionStore } from "@/lib/quiz/quiz-data";
import { listEffectiveTeachingAssignmentsForUser } from "@/lib/academic/teaching-assignment-data";

const quizWritePermissions = new Set([
  "quizzes.sessions.create",
  "quizzes.sessions.publish",
  "quizzes.sessions.close",
  "quizzes.questions.create",
  "quizzes.questions.remove",
  "quizzes.attendance.adjust",
  "quizzes.grades.adjust",
  "quizzes.grades.execute",
]);

/**
 * Authorizes a quiz page through its exact operation-map entry. A non-admin
 * may only reach a page when a complete current teaching-assignment tuple
 * covers the requested session (or at least one visible session for a list).
 */
export async function enforceQuizPageAccess(
  domain: string,
  operationId: string,
  sessionId?: string,
): Promise<MasterDataPrincipal> {
  const principal = await enforceTenantOperation(domain, operationId, undefined, {
    policy: "assigned",
    async evaluate(current) {
      if (current.schoolAdmin) return { allowed: true, arm: "assigned" as const };
      const assignments = await listEffectiveTeachingAssignmentsForUser(
        current.tenantId,
        current.userId,
        new Date().toISOString().slice(0, 10),
      );
      if (!sessionId) return { allowed: assignments.length > 0, arm: "assigned" as const };
      const session = (await quizSessionStore.list(current.tenantId)).find((candidate) => candidate.id === sessionId);
      return {
        allowed: Boolean(session && assignments.some((assignment) =>
          assignment.academicYearId === session.academicYearId &&
          assignment.subjectId === session.subjectId &&
          assignment.classGroupId === session.classGroupId,
        )),
        arm: "assigned" as const,
      };
    },
  });

  return {
    userId: principal.userId,
    tenantId: principal.tenantId,
    role: "school-admin",
    capabilities: {
      read: true,
      write: !principal.readOnly && (principal.schoolAdmin || [...principal.permissions].some((permission) => quizWritePermissions.has(permission))),
      downloadTemplate: false,
    },
    schoolAdmin: principal.schoolAdmin,
    permissions: principal.permissions,
    selfPersonId: principal.selfPersonId,
  };
}
