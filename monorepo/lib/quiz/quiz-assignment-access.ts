import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";
import type { QuizSession } from "@/lib/quiz/quiz";
import { listEffectiveTeachingAssignmentsForUser } from "@/lib/academic/teaching-assignment-data";

export async function canAccessQuizSession(principal: Pick<MasterDataPrincipal, "userId" | "tenantId" | "schoolAdmin">, session: Pick<QuizSession, "academicYearId" | "subjectId" | "classGroupId">) {
  if (principal.schoolAdmin) return true;
  const assignments = await listEffectiveTeachingAssignmentsForUser(principal.tenantId, principal.userId, new Date().toISOString().slice(0, 10));
  return assignments.some((assignment) => assignment.academicYearId === session.academicYearId && assignment.subjectId === session.subjectId && assignment.classGroupId === session.classGroupId);
}
