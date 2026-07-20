

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { schoolProfile, schoolProfileAudit, simasApplication, tenant } from "@/db/schema";
import type { SchoolProfile, SchoolProfileStore } from "@/lib/school-profile";

const selection = {
  id: schoolProfile.id,
  tenantId: schoolProfile.tenantId,
  displayName: schoolProfile.displayName,
  addressStreet: schoolProfile.addressStreet,
  addressVillage: schoolProfile.addressVillage,
  addressDistrict: schoolProfile.addressDistrict,
  addressCity: schoolProfile.addressCity,
  addressProvince: schoolProfile.addressProvince,
  addressPostalCode: schoolProfile.addressPostalCode,
  institutionalEmail: schoolProfile.institutionalEmail,
  institutionalPhone: schoolProfile.institutionalPhone,
  website: schoolProfile.website,
  latitude: schoolProfile.latitude,
  longitude: schoolProfile.longitude,
  description: schoolProfile.description,
  version: schoolProfile.version,
  createdAt: schoolProfile.createdAt,
  updatedAt: schoolProfile.updatedAt,
  npsn: tenant.npsn,
  officialName: simasApplication.schoolName,
  educationLevel: simasApplication.educationLevel,
  domain: tenant.domain,
};

type ProfileRow = Awaited<ReturnType<typeof selectProfile>>[number];

function mapProfile(row: ProfileRow): SchoolProfile {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: { tenantId: row.tenantId, npsn: row.npsn, officialName: row.officialName, educationLevel: row.educationLevel, domain: row.domain },
    displayName: row.displayName,
    address: {
      street: row.addressStreet, village: row.addressVillage, district: row.addressDistrict,
      city: row.addressCity, province: row.addressProvince, postalCode: row.addressPostalCode,
    },
    institutionalEmail: row.institutionalEmail,
    institutionalPhone: row.institutionalPhone,
    website: row.website,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    description: row.description,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function selectProfile(executor: Pick<typeof db, "select">, tenantId: string) {
  return executor.select(selection).from(schoolProfile)
    .innerJoin(tenant, eq(tenant.id, schoolProfile.tenantId))
    .innerJoin(simasApplication, eq(simasApplication.id, tenant.sourceApplicationId))
    .where(and(eq(schoolProfile.tenantId, tenantId), eq(tenant.id, tenantId))).limit(1);
}

export const schoolProfileStore: SchoolProfileStore = {
  async findProviderIdentity(tenantId) {
    const [row] = await db.select({
      tenantId: tenant.id, npsn: tenant.npsn, officialName: simasApplication.schoolName,
      educationLevel: simasApplication.educationLevel, domain: tenant.domain,
    }).from(tenant).innerJoin(simasApplication, eq(simasApplication.id, tenant.sourceApplicationId))
      .where(eq(tenant.id, tenantId)).limit(1);
    return row ?? null;
  },
  transaction(work) {
    return db.transaction(async (transaction) => work({
      async findProfile(tenantId) {
        await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
        const [row] = await selectProfile(transaction, tenantId);
        return row ? mapProfile(row) : null;
      },
      async createProfile(profile) {
        await transaction.insert(schoolProfile).values({
          id: profile.id, tenantId: profile.tenantId, displayName: profile.displayName,
          addressStreet: profile.address.street, addressVillage: profile.address.village,
          addressDistrict: profile.address.district, addressCity: profile.address.city,
          addressProvince: profile.address.province, addressPostalCode: profile.address.postalCode,
          institutionalEmail: profile.institutionalEmail, institutionalPhone: profile.institutionalPhone,
          website: profile.website, latitude: profile.latitude?.toString(), longitude: profile.longitude?.toString(),
          description: profile.description, version: profile.version,
          createdAt: profile.createdAt, updatedAt: profile.updatedAt,
        }).onDuplicateKeyUpdate({ set: { id: sql`${schoolProfile.id}` } });
        const [row] = await selectProfile(transaction, profile.tenantId);
        if (!row) throw new Error("School profile was not created");
        return mapProfile(row);
      },
      async updateProfile(tenantId, expectedVersion, values) {
        const updated = await transaction.update(schoolProfile).set({
          displayName: values.displayName,
          addressStreet: values.address.street, addressVillage: values.address.village,
          addressDistrict: values.address.district, addressCity: values.address.city,
          addressProvince: values.address.province, addressPostalCode: values.address.postalCode,
          institutionalEmail: values.institutionalEmail, institutionalPhone: values.institutionalPhone,
          website: values.website, latitude: values.latitude?.toString() ?? null,
          longitude: values.longitude?.toString() ?? null, description: values.description,
          version: sql`${schoolProfile.version} + 1`, updatedAt: values.updatedAt,
        }).where(and(eq(schoolProfile.tenantId, tenantId), eq(schoolProfile.version, expectedVersion)));
        if (updated[0].affectedRows !== 1) return null;
        const [row] = await selectProfile(transaction, tenantId);
        return row?.version === expectedVersion + 1 ? mapProfile(row) : null;
      },
      async appendAudit(event) {
        await transaction.insert(schoolProfileAudit).values(event);
      },
    }));
  },
};
