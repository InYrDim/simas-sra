import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { subject, subjectHistory, tenant, user } from "@/db/schema";
import { SUBJECT_EDUCATION_LEVELS, type Subject, type SubjectCatalogStore, type SubjectEducationLevel } from "@/lib/subject-catalog";

function decodeEducationLevels(value: string): SubjectEducationLevel[] {
  return value.split(",").filter((level): level is SubjectEducationLevel => SUBJECT_EDUCATION_LEVELS.includes(level as SubjectEducationLevel));
}

async function listWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<Subject[]> {
  const rows = await executor.select().from(subject).where(eq(subject.tenantId, tenantId)).orderBy(asc(subject.normalizedName));
  return rows.map((row) => ({ ...row, educationLevels: decodeEducationLevels(row.educationLevels) }));
}

export const subjectCatalogStore: SubjectCatalogStore = {
  list(tenantId) { return listWith(db, tenantId); },
  transaction(tenantId, work) {
    return db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      return work({
        list: () => listWith(transaction, tenantId),
        async save(value, expectedVersion) {
          if (value.tenantId !== tenantId) throw new Error("Cross-Tenant subject write denied");
          const educationLevels = value.educationLevels.join(",");
          if (expectedVersion === null) {
            await transaction.insert(subject).values({ ...value, educationLevels });
            return true;
          }
          const result = await transaction.update(subject).set({ code: value.code, normalizedCode: value.normalizedCode, name: value.name, normalizedName: value.normalizedName, educationLevels, description: value.description, archived: value.archived, archivedAt: value.archivedAt, version: value.version, updatedAt: value.updatedAt }).where(and(eq(subject.tenantId, tenantId), eq(subject.id, value.id), eq(subject.version, expectedVersion)));
          return result[0].affectedRows === 1;
        },
        async appendHistory(event) {
          if (event.tenantId !== tenantId) throw new Error("Cross-Tenant subject history write denied");
          const [actor] = await transaction.select({ id: user.id }).from(user).where(and(eq(user.id, event.actorUserId), eq(user.tenantId, tenantId))).limit(1);
          if (!actor) throw new Error("Subject history actor is not a Tenant member");
          await transaction.insert(subjectHistory).values(event);
        },
      });
    });
  },
};
