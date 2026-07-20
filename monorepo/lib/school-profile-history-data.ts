import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { schoolAccreditation, schoolAsset, schoolProfile, schoolProfileAudit } from "@/db/schema";
import type { SchoolAccreditation, SchoolAccreditationStore } from "@/lib/school-accreditation";
import type { SchoolAssetStore } from "@/lib/school-profile-assets";

function mapAccreditation(row: typeof schoolAccreditation.$inferSelect): SchoolAccreditation {
  return {
    id: row.id, tenantId: row.tenantId, rating: row.rating,
    certificateNumber: row.certificateNumber, issuingInstitution: row.issuingInstitution,
    determinationDate: row.determinationDate, expiryDate: row.expiryDate,
    supersedesId: row.supersedesId, correctionId: row.correctionId,
    invalidationReason: row.invalidationReason, invalidatedAt: row.invalidatedAt,
    createdByUserId: row.createdByUserId, createdAt: row.createdAt,
  };
}

async function listAccreditations(executor: Pick<typeof db, "select">, tenantId: string) {
  return (await executor.select().from(schoolAccreditation)
    .where(eq(schoolAccreditation.tenantId, tenantId))
    .orderBy(desc(schoolAccreditation.determinationDate), desc(schoolAccreditation.createdAt)))
    .map(mapAccreditation);
}

export const schoolAssetStore: SchoolAssetStore = {
  transaction(work) {
    return db.transaction(async (transaction) => work({
      async findCurrentLogo(tenantId) {
        const [row] = await transaction.select({ asset: schoolAsset }).from(schoolProfile)
          .innerJoin(schoolAsset, and(eq(schoolAsset.id, schoolProfile.logoAssetId), eq(schoolAsset.tenantId, schoolProfile.tenantId)))
          .where(eq(schoolProfile.tenantId, tenantId)).limit(1);
        return row?.asset ?? null;
      },
      async saveLogo(asset) {
        const [profile] = await transaction.select({ id: schoolProfile.id, version: schoolProfile.version }).from(schoolProfile)
          .where(eq(schoolProfile.tenantId, asset.tenantId)).for("update").limit(1);
        if (!profile) throw new Error("School profile not found");
        await transaction.insert(schoolAsset).values(asset);
        const result = await transaction.update(schoolProfile).set({ logoAssetId: asset.id, version: sql`${schoolProfile.version} + 1`, updatedAt: asset.createdAt })
          .where(eq(schoolProfile.tenantId, asset.tenantId));
        if (result[0].affectedRows !== 1) throw new Error("School profile not found");
        await transaction.insert(schoolProfileAudit).values({
          id: crypto.randomUUID(), tenantId: asset.tenantId, profileId: profile.id,
          actorUserId: asset.createdByUserId, operation: "school-profile.logo-replaced",
          fromVersion: profile.version, toVersion: profile.version + 1, occurredAt: asset.createdAt,
        });
      },
    }));
  },
};

export const schoolAccreditationStore: SchoolAccreditationStore = {
  list: (tenantId) => listAccreditations(db, tenantId),
  transaction(work) {
    return db.transaction(async (transaction) => work({
      async list(tenantId) {
        await transaction.execute(sql`SELECT ${schoolProfile.id} FROM ${schoolProfile} WHERE ${schoolProfile.tenantId} = ${tenantId} FOR UPDATE`);
        return listAccreditations(transaction, tenantId);
      },
      async append(record) {
        const [profile] = await transaction.select({ id: schoolProfile.id }).from(schoolProfile)
          .where(eq(schoolProfile.tenantId, record.tenantId)).limit(1);
        if (!profile) throw new Error("School profile not found");
        await transaction.insert(schoolAccreditation).values({ ...record, profileId: profile.id });
      },
      async invalidate(tenantId, id, correctionId, reason, invalidatedAt) {
        const result = await transaction.update(schoolAccreditation).set({ correctionId, invalidationReason: reason, invalidatedAt })
          .where(and(eq(schoolAccreditation.tenantId, tenantId), eq(schoolAccreditation.id, id), isNull(schoolAccreditation.invalidatedAt)));
        return result[0].affectedRows === 1;
      },
    }));
  },
};
