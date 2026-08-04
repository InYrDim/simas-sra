"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createQuizSessionService, type QuizAttendanceStatus, type QuizQuestionInput, type QuizSessionMode } from "@/lib/quiz/quiz";
import { quizSessionStore } from "@/lib/quiz/quiz-data";
import { listEffectiveTeachingAssignmentsForUser } from "@/lib/academic/teaching-assignment-data";
import { DEMO_QUIZ_QUESTIONS } from "@/lib/quiz/quiz-demo";
import { enforceTenantFeatureAccess, enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";

const sessionService = createQuizSessionService({ store: quizSessionStore });

async function enforceQuizOperation(domain: string, operationId: string, principal: Awaited<ReturnType<typeof enforceTenantFeatureAccess>>, sessionId: string, permissions?: readonly string[]) {
  const session = (await quizSessionStore.list(principal.tenantId)).find((candidate) => candidate.id === sessionId);
  return enforceTenantOperation(domain, operationId, permissions, {
    policy: "assigned",
    async evaluate(current) {
      if (current.schoolAdmin) return { allowed: true, arm: "assigned" as const };
      if (!session) return { allowed: false };
      const assignments = await listEffectiveTeachingAssignmentsForUser(current.tenantId, current.userId, new Date().toISOString().slice(0, 10));
      return {
        allowed: assignments.some((assignment) => assignment.academicYearId === session.academicYearId && assignment.subjectId === session.subjectId && assignment.classGroupId === session.classGroupId),
        arm: "assigned" as const,
      };
    },
  });
}

function finish(path: string, result: { ok: boolean; code?: string }): never {
  revalidatePath(path);
  redirect(`${path}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function createSessionAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const classGroupId = String(formData.get("classGroupId") ?? "");
  await enforceTenantOperation(domain, "quizzes.sessions.create", undefined, {
    policy: "assigned",
    async evaluate(current) {
      if (current.schoolAdmin) return { allowed: true, arm: "assigned" as const };
      const assignments = await listEffectiveTeachingAssignmentsForUser(current.tenantId, current.userId, new Date().toISOString().slice(0, 10));
      return { allowed: assignments.some((assignment) => assignment.academicYearId === academicYearId && assignment.subjectId === subjectId && assignment.classGroupId === classGroupId), arm: "assigned" as const };
    },
  });
  const result = await sessionService.create(principal, {
    academicYearId,
    subjectId,
    classGroupId,
    mode: String(formData.get("mode") ?? "luring") as QuizSessionMode,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationMinutes: Number(formData.get("durationMinutes")) || undefined,
  });
  if (result.ok && "session" in result) {
    redirect(`/${domain}/ulangan/${result.session.id}`);
  }
  finish(`/${domain}/ulangan`, result);
}

export async function activateSessionAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.sessions.publish", principal, sessionId);
  const result = await sessionService.activate(principal, sessionId);
  finish(`/${domain}/ulangan/${sessionId}`, result);
}

export type EndSessionActionState =
  | { status: "idle" }
  | { status: "incomplete"; missingStudentIds: string[] }
  | { status: "error"; code: string };

export async function endSessionAction(
  domain: string,
  _previousState: EndSessionActionState,
  formData: FormData,
): Promise<EndSessionActionState> {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.sessions.close", principal, sessionId, ["quizzes.sessions.close", "quizzes.attendance.adjust"]);
  const studentIds = parseStringArray(formData.get("studentIds"));
  const fillMissingAbsent = formData.get("fillMissingAbsent") === "true";
  const result = await sessionService.end(principal, sessionId, studentIds, fillMissingAbsent);
  if (!result.ok) {
    if (result.code === "attendance-incomplete" && "missingStudentIds" in result) {
      return { status: "incomplete", missingStudentIds: [...result.missingStudentIds] };
    }
    return { status: "error", code: result.code };
  }
  finish(`/${domain}/ulangan/${sessionId}`, result);
}

export type OfflineScoreActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; code: string };

export async function saveOfflineScoresAction(
  domain: string,
  _previousState: OfflineScoreActionState,
  formData: FormData,
): Promise<OfflineScoreActionState> {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.grades.adjust", principal, sessionId);
  const studentIds = parseStringArray(formData.get("studentIds"));
  const rawScores = parseStringArray(formData.get("scores"));
  if (studentIds.length === 0 || studentIds.length !== rawScores.length) return { status: "error", code: "invalid-input" };
  const entries = studentIds.map((studentId, index) => ({ studentId, score: Number(rawScores[index]) }));
  const result = await sessionService.saveOfflineScores(principal, sessionId, entries);
  if (!result.ok) return { status: "error", code: result.code };
  revalidatePath(`/${domain}/ulangan/${sessionId}/penilaian`);
  return { status: "saved" };
}

export async function prepareOfflineGradingAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.grades.execute", principal, sessionId);
  const result = await sessionService.prepareOfflineGrading(principal, sessionId);
  finish(`/${domain}/ulangan/${sessionId}/penilaian`, result);
}

export async function finalizeOfflineGradingAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.grades.execute", principal, sessionId);
  const result = await sessionService.finalizeOfflineGrading(principal, sessionId);
  finish(`/${domain}/ulangan/${sessionId}/penilaian`, result);
}

export async function gradeSessionAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.grades.execute", principal, sessionId);
  const result = await sessionService.grade(principal, sessionId);
  finish(`/${domain}/ulangan/${sessionId}/penilaian`, result);
}

export async function addDemoQuestionsAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.questions.create", principal, sessionId);
  const result = await sessionService.addQuestions(principal, sessionId, DEMO_QUIZ_QUESTIONS);
  revalidatePath(`/${domain}/ulangan/${sessionId}`);
  redirect(`/${domain}/ulangan/${sessionId}?result=${result.ok ? "demo-questions-added" : result.code ?? "error"}`);
}

export async function addQuestionAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.questions.create", principal, sessionId);
  const questionType = String(formData.get("questionType") ?? "multiple_choice") as QuizQuestionInput["questionType"];
  let options: string[] | undefined;
  if (questionType === "multiple_choice") {
    options = [
      String(formData.get("optionA") ?? ""),
      String(formData.get("optionB") ?? ""),
      String(formData.get("optionC") ?? ""),
      String(formData.get("optionD") ?? ""),
    ].filter((o) => o.trim().length > 0);
  } else if (questionType === "true_false") {
    options = ["Benar", "Salah"];
  }

  const result = await sessionService.addQuestion(principal, sessionId, {
    questionText: String(formData.get("questionText") ?? ""),
    questionType,
    options,
    correctAnswer: String(formData.get("correctAnswer") ?? ""),
    points: Number(formData.get("points")) || 1,
  });
  revalidatePath(`/${domain}/ulangan/${sessionId}`);
  redirect(`/${domain}/ulangan/${sessionId}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export async function removeQuestionAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.questions.remove", principal, sessionId);
  const questionId = String(formData.get("questionId") ?? "");
  const result = await sessionService.removeQuestion(principal, sessionId, questionId);
  revalidatePath(`/domain}/ulangan/${sessionId}`);
  redirect(`/domain}/ulangan/${sessionId}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

export type SaveAttendanceActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; code: string };

function parseStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function saveAttendanceBatchAction(
  domain: string,
  _previousState: SaveAttendanceActionState,
  formData: FormData,
): Promise<SaveAttendanceActionState> {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.attendance.adjust", principal, sessionId);
  const studentIds = parseStringArray(formData.get("studentIds"));
  const statuses = parseStringArray(formData.get("statuses"));
  if (studentIds.length === 0 || studentIds.length !== statuses.length) return { status: "error", code: "invalid-input" };
  const entries = studentIds.map((studentId, index) => ({
    studentId,
    status: statuses[index] as QuizAttendanceStatus,
  }));
  const result = await sessionService.saveAttendanceBatch(principal, sessionId, entries);
  if (!result.ok) return { status: "error", code: result.code };
  revalidatePath(`/${domain}/ulangan/${sessionId}`);
  return { status: "saved" };
}

export async function markAttendanceAction(domain: string, formData: FormData) {
  const principal = await enforceTenantFeatureAccess(domain, "ulanganWrite", "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  await enforceQuizOperation(domain, "quizzes.attendance.adjust", principal, sessionId);
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "present") as QuizAttendanceStatus;
  const notes = String(formData.get("notes") ?? "");
  await sessionService.markAttendance(principal, sessionId, studentId, status, notes || undefined);
  revalidatePath(`/${domain}/ulangan/${sessionId}`);
}
