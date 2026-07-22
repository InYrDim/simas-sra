import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { quizAnswer, quizAnswerSheet, quizAttendance, quizQuestion, quizSession, tenant } from "@/db/schema";
import type {
  QuizAnswer,
  QuizAnswerSheet,
  QuizAttendance,
  QuizQuestion,
  QuizSession,
  QuizSessionStore,
} from "@/lib/quiz";

function toSession(record: typeof quizSession.$inferSelect): QuizSession {
  return {
    id: record.id,
    tenantId: record.tenantId,
    academicYearId: record.academicYearId,
    subjectId: record.subjectId,
    classGroupId: record.classGroupId,
    mode: record.mode,
    title: record.title,
    description: record.description,
    status: record.status,
    durationMinutes: record.durationMinutes,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toQuestion(record: typeof quizQuestion.$inferSelect): QuizQuestion {
  return {
    id: record.id,
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    questionText: record.questionText,
    questionType: record.questionType,
    options: (record.options as string[] | null) ?? null,
    correctAnswer: record.correctAnswer,
    points: record.points,
    orderIndex: record.orderIndex,
    createdAt: record.createdAt,
  };
}

function toAnswerSheet(record: typeof quizAnswerSheet.$inferSelect): QuizAnswerSheet {
  return {
    id: record.id,
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    studentId: record.studentId,
    status: record.status,
    totalScore: record.totalScore,
    maxScore: record.maxScore,
    submittedAt: record.submittedAt,
    gradedAt: record.gradedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toAnswer(record: typeof quizAnswer.$inferSelect): QuizAnswer {
  return {
    id: record.id,
    tenantId: record.tenantId,
    answerSheetId: record.answerSheetId,
    questionId: record.questionId,
    answerText: record.answerText,
    isCorrect: record.isCorrect,
    score: record.score,
    createdAt: record.createdAt,
  };
}

function toAttendance(record: typeof quizAttendance.$inferSelect): QuizAttendance {
  return {
    id: record.id,
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    studentId: record.studentId,
    status: record.status,
    notes: record.notes,
    createdAt: record.createdAt,
  };
}

async function listWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<QuizSession[]> {
  const rows = await executor.select().from(quizSession).where(eq(quizSession.tenantId, tenantId));
  return rows.map(toSession);
}

async function listQuestionsWith(executor: Pick<typeof db, "select">, tenantId: string, sessionId: string): Promise<QuizQuestion[]> {
  const rows = await executor
    .select()
    .from(quizQuestion)
    .where(and(eq(quizQuestion.tenantId, tenantId), eq(quizQuestion.sessionId, sessionId)));
  return rows.map(toQuestion);
}

async function listAnswerSheetsWith(executor: Pick<typeof db, "select">, tenantId: string, sessionId: string): Promise<QuizAnswerSheet[]> {
  const rows = await executor
    .select()
    .from(quizAnswerSheet)
    .where(and(eq(quizAnswerSheet.tenantId, tenantId), eq(quizAnswerSheet.sessionId, sessionId)));
  return rows.map(toAnswerSheet);
}

async function findAnswerSheetWith(executor: Pick<typeof db, "select">, tenantId: string, answerSheetId: string): Promise<QuizAnswerSheet | null> {
  const [row] = await executor
    .select()
    .from(quizAnswerSheet)
    .where(and(eq(quizAnswerSheet.tenantId, tenantId), eq(quizAnswerSheet.id, answerSheetId)))
    .limit(1);
  return row ? toAnswerSheet(row) : null;
}

async function listAttendanceWith(executor: Pick<typeof db, "select">, tenantId: string, sessionId: string): Promise<QuizAttendance[]> {
  const rows = await executor
    .select()
    .from(quizAttendance)
    .where(and(eq(quizAttendance.tenantId, tenantId), eq(quizAttendance.sessionId, sessionId)));
  return rows.map(toAttendance);
}

async function findAttendanceWith(executor: Pick<typeof db, "select">, tenantId: string, sessionId: string, studentId: string): Promise<QuizAttendance | null> {
  const [row] = await executor
    .select()
    .from(quizAttendance)
    .where(and(eq(quizAttendance.tenantId, tenantId), eq(quizAttendance.sessionId, sessionId), eq(quizAttendance.studentId, studentId)))
    .limit(1);
  return row ? toAttendance(row) : null;
}

async function listAnswersWith(executor: Pick<typeof db, "select">, tenantId: string, answerSheetId: string): Promise<QuizAnswer[]> {
  const rows = await executor
    .select()
    .from(quizAnswer)
    .where(and(eq(quizAnswer.tenantId, tenantId), eq(quizAnswer.answerSheetId, answerSheetId)));
  return rows.map(toAnswer);
}

export const quizSessionStore: QuizSessionStore = {
  list(tenantId) {
    return listWith(db, tenantId);
  },
  transaction(tenantId, work) {
    return db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      return work({
        list: () => listWith(transaction, tenantId),
        async save(session) {
          if (session.tenantId !== tenantId) throw new Error("Cross-Tenant quiz session write denied");
          const [existing] = await transaction
            .select({ id: quizSession.id })
            .from(quizSession)
            .where(and(eq(quizSession.tenantId, tenantId), eq(quizSession.id, session.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(quizSession).values({
              id: session.id,
              tenantId,
              academicYearId: session.academicYearId,
              subjectId: session.subjectId,
              classGroupId: session.classGroupId,
              mode: session.mode,
              title: session.title,
              description: session.description,
              status: session.status,
              durationMinutes: session.durationMinutes,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              version: session.version,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
            });
            return;
          }
          await transaction
            .update(quizSession)
            .set({
              academicYearId: session.academicYearId,
              subjectId: session.subjectId,
              classGroupId: session.classGroupId,
              mode: session.mode,
              title: session.title,
              description: session.description,
              status: session.status,
              durationMinutes: session.durationMinutes,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              version: session.version,
              updatedAt: session.updatedAt,
            })
            .where(and(eq(quizSession.tenantId, tenantId), eq(quizSession.id, session.id)));
        },
        listQuestions: (sessionId) => listQuestionsWith(transaction, tenantId, sessionId),
        async saveQuestion(question) {
          if (question.tenantId !== tenantId) throw new Error("Cross-Tenant quiz question write denied");
          const [existing] = await transaction
            .select({ id: quizQuestion.id })
            .from(quizQuestion)
            .where(and(eq(quizQuestion.tenantId, tenantId), eq(quizQuestion.id, question.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(quizQuestion).values({
              id: question.id,
              tenantId,
              sessionId: question.sessionId,
              questionText: question.questionText,
              questionType: question.questionType,
              options: question.options,
              correctAnswer: question.correctAnswer,
              points: question.points,
              orderIndex: question.orderIndex,
              createdAt: question.createdAt,
            });
            return;
          }
          await transaction
            .update(quizQuestion)
            .set({
              questionText: question.questionText,
              questionType: question.questionType,
              options: question.options,
              correctAnswer: question.correctAnswer,
              points: question.points,
              orderIndex: question.orderIndex,
            })
            .where(and(eq(quizQuestion.tenantId, tenantId), eq(quizQuestion.id, question.id)));
        },
        async deleteQuestion(questionId) {
          await transaction
            .delete(quizQuestion)
            .where(and(eq(quizQuestion.tenantId, tenantId), eq(quizQuestion.id, questionId)));
        },
        listAnswerSheets: (sessionId) => listAnswerSheetsWith(transaction, tenantId, sessionId),
        findAnswerSheet: (answerSheetId) => findAnswerSheetWith(transaction, tenantId, answerSheetId),
        async saveAnswerSheet(sheet) {
          if (sheet.tenantId !== tenantId) throw new Error("Cross-Tenant quiz answer sheet write denied");
          const [existing] = await transaction
            .select({ id: quizAnswerSheet.id })
            .from(quizAnswerSheet)
            .where(and(eq(quizAnswerSheet.tenantId, tenantId), eq(quizAnswerSheet.id, sheet.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(quizAnswerSheet).values({
              id: sheet.id,
              tenantId,
              sessionId: sheet.sessionId,
              studentId: sheet.studentId,
              status: sheet.status,
              totalScore: sheet.totalScore,
              maxScore: sheet.maxScore,
              submittedAt: sheet.submittedAt,
              gradedAt: sheet.gradedAt,
              createdAt: sheet.createdAt,
              updatedAt: sheet.updatedAt,
            });
            return;
          }
          await transaction
            .update(quizAnswerSheet)
            .set({
              status: sheet.status,
              totalScore: sheet.totalScore,
              maxScore: sheet.maxScore,
              submittedAt: sheet.submittedAt,
              gradedAt: sheet.gradedAt,
              updatedAt: sheet.updatedAt,
            })
            .where(and(eq(quizAnswerSheet.tenantId, tenantId), eq(quizAnswerSheet.id, sheet.id)));
        },
        listAnswers: (answerSheetId) => listAnswersWith(transaction, tenantId, answerSheetId),
        async saveAnswer(answer) {
          if (answer.tenantId !== tenantId) throw new Error("Cross-Tenant quiz answer write denied");
          const [existing] = await transaction
            .select({ id: quizAnswer.id })
            .from(quizAnswer)
            .where(and(eq(quizAnswer.tenantId, tenantId), eq(quizAnswer.id, answer.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(quizAnswer).values({
              id: answer.id,
              tenantId,
              answerSheetId: answer.answerSheetId,
              questionId: answer.questionId,
              answerText: answer.answerText,
              isCorrect: answer.isCorrect,
              score: answer.score,
              createdAt: answer.createdAt,
            });
            return;
          }
          await transaction
            .update(quizAnswer)
            .set({
              answerText: answer.answerText,
              isCorrect: answer.isCorrect,
              score: answer.score,
            })
            .where(and(eq(quizAnswer.tenantId, tenantId), eq(quizAnswer.id, answer.id)));
        },
        listAttendance: (sessionId) => listAttendanceWith(transaction, tenantId, sessionId),
        findAttendance: (sessionId, studentId) => findAttendanceWith(transaction, tenantId, sessionId, studentId),
        async saveAttendance(record) {
          if (record.tenantId !== tenantId) throw new Error("Cross-Tenant quiz attendance write denied");
          const [existing] = await transaction
            .select({ id: quizAttendance.id })
            .from(quizAttendance)
            .where(and(eq(quizAttendance.tenantId, tenantId), eq(quizAttendance.id, record.id)))
            .limit(1);
          if (!existing) {
            await transaction.insert(quizAttendance).values({
              id: record.id,
              tenantId,
              sessionId: record.sessionId,
              studentId: record.studentId,
              status: record.status,
              notes: record.notes,
              createdAt: record.createdAt,
            });
            return;
          }
          await transaction
            .update(quizAttendance)
            .set({
              status: record.status,
              notes: record.notes,
              createdAt: record.createdAt,
            })
            .where(and(eq(quizAttendance.tenantId, tenantId), eq(quizAttendance.id, record.id)));
        },
      });
    });
  },
};
