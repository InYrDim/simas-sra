import { defineRelations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  date,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  timestamp,
  unique,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";

export const tenant = mysqlTable(
  "tenant",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    npsn: varchar("npsn", { length: 20 }).notNull().unique(),
    sourceApplicationId: varchar("source_application_id", { length: 36 })
      .notNull()
      .unique()
      .references((): AnyMySqlColumn => simasApplication.id),
    approvedAt: timestamp("approved_at", { fsp: 3 }).notNull(),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { fsp: 3 }),
    trialStartedAt: timestamp("trial_started_at", { fsp: 3 }),
    trialEndsAt: timestamp("trial_ends_at", { fsp: 3 }),
    settings: json("settings"),
    operationalStatus: mysqlEnum("operational_status", ["active", "suspended", "closed"]),
    reconciliationStatus: mysqlEnum("reconciliation_status", [
      "not_required",
      "needs_reconciliation",
    ]),
    deletionWaitingDays: int("deletion_waiting_days"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "tenant_onboarding_trial_state_check",
      sql`(
        (${table.onboardingCompletedAt} IS NULL AND ${table.trialStartedAt} IS NULL AND ${table.trialEndsAt} IS NULL)
        OR (${table.onboardingCompletedAt} IS NOT NULL AND ${table.trialStartedAt} = ${table.onboardingCompletedAt} AND ${table.trialEndsAt} IS NOT NULL AND ${table.trialEndsAt} > ${table.trialStartedAt})
      )`,
    ),
    check(
      "tenant_deletion_waiting_days_check",
      sql`${table.deletionWaitingDays} IS NULL OR (${table.deletionWaitingDays} >= 1 AND ${table.deletionWaitingDays} <= 365)`,
    ),
  ],
);

export const schoolProfile = mysqlTable(
  "school_profile",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    addressStreet: varchar("address_street", { length: 255 }).default("").notNull(),
    addressVillage: varchar("address_village", { length: 255 }).default("").notNull(),
    addressDistrict: varchar("address_district", { length: 255 }).default("").notNull(),
    addressCity: varchar("address_city", { length: 255 }).default("").notNull(),
    addressProvince: varchar("address_province", { length: 255 }).default("").notNull(),
    addressPostalCode: varchar("address_postal_code", { length: 5 }).default("").notNull(),
    institutionalEmail: varchar("institutional_email", { length: 255 }),
    institutionalPhone: varchar("institutional_phone", { length: 32 }),
    website: varchar("website", { length: 2048 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    description: text("description"),
    logoAssetId: varchar("logo_asset_id", { length: 36 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    unique("school_profile_tenant_id_unique").on(table.tenantId),
    unique("school_profile_tenant_id_id_unique").on(table.tenantId, table.id),
    check("school_profile_version_check", sql`${table.version} > 0`),
    check("school_profile_latitude_check", sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`),
    check("school_profile_longitude_check", sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`),
    check("school_profile_coordinates_check", sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`),
  ],
);

export const schoolAsset = mysqlTable(
  "school_asset",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    storageKey: varchar("storage_key", { length: 700 }).notNull(),
    mimeType: mysqlEnum("mime_type", ["image/png", "image/jpeg", "image/webp"]).notNull(),
    byteSize: int("byte_size").notNull(),
    width: int("width").notNull(),
    height: int("height").notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull().references(() => user.id),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("school_asset_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("school_asset_storage_key_unique").on(table.storageKey),
    check("school_asset_size_check", sql`${table.byteSize} > 0 AND ${table.byteSize} <= 2097152`),
    check("school_asset_dimensions_check", sql`${table.width} >= 256 AND ${table.height} >= 256 AND ${table.width} = ${table.height}`),
  ],
);

export const schoolAccreditation = mysqlTable(
  "school_accreditation",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    profileId: varchar("profile_id", { length: 36 }).notNull().references(() => schoolProfile.id),
    rating: mysqlEnum("rating", ["A", "B", "C", "Terakreditasi", "Tidak Terakreditasi"]).notNull(),
    certificateNumber: varchar("certificate_number", { length: 100 }).notNull(),
    issuingInstitution: varchar("issuing_institution", { length: 150 }).notNull(),
    determinationDate: varchar("determination_date", { length: 10 }).notNull(),
    expiryDate: varchar("expiry_date", { length: 10 }),
    supersedesId: varchar("supersedes_id", { length: 36 }),
    correctionId: varchar("correction_id", { length: 36 }),
    invalidationReason: varchar("invalidation_reason", { length: 500 }),
    invalidatedAt: timestamp("invalidated_at", { fsp: 3 }),
    createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull().references(() => user.id),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("school_accreditation_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({ columns: [table.tenantId, table.profileId], foreignColumns: [schoolProfile.tenantId, schoolProfile.id], name: "school_accreditation_tenant_profile_fkey" }),
    foreignKey({ columns: [table.tenantId, table.supersedesId], foreignColumns: [table.tenantId, table.id], name: "school_accreditation_tenant_supersedes_fkey" }),
    foreignKey({ columns: [table.tenantId, table.correctionId], foreignColumns: [table.tenantId, table.id], name: "school_accreditation_tenant_correction_fkey" }),
    index("school_accreditation_tenant_period_idx").on(table.tenantId, table.determinationDate, table.expiryDate),
    check("school_accreditation_period_check", sql`${table.expiryDate} IS NULL OR ${table.expiryDate} >= ${table.determinationDate}`),
  ],
);

export const schoolProfileAudit = mysqlTable(
  "school_profile_audit",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    profileId: varchar("profile_id", { length: 36 }).notNull().references(() => schoolProfile.id),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id),
    operation: varchar("operation", { length: 100 }).notNull(),
    fromVersion: int("from_version").notNull(),
    toVersion: int("to_version").notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    index("school_profile_audit_tenant_profile_idx").on(table.tenantId, table.profileId, table.occurredAt),
    check("school_profile_audit_version_check", sql`${table.fromVersion} > 0 AND ${table.toVersion} = ${table.fromVersion} + 1`),
  ],
);

export const academicYear = mysqlTable(
  "academic_year",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    label: varchar("label", { length: 100 }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    lifecycle: mysqlEnum("lifecycle", ["draft", "active", "closed", "cancelled"]).default("draft").notNull(),
    archived: boolean("archived").default(false).notNull(),
    activeSlot: varchar("active_slot", { length: 36 }).generatedAlwaysAs(sql`CASE WHEN lifecycle = 'active' AND archived = false THEN tenant_id ELSE NULL END`),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("academic_year_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("academic_year_tenant_label_unique").on(table.tenantId, table.label),
    unique("academic_year_active_slot_unique").on(table.activeSlot),
    index("academic_year_tenant_period_idx").on(table.tenantId, table.startDate, table.endDate),
    check("academic_year_period_check", sql`${table.startDate} < ${table.endDate}`),
    check("academic_year_version_check", sql`${table.version} > 0`),
  ],
);

export const academicSemester = mysqlTable(
  "academic_semester",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull(),
    kind: mysqlEnum("kind", ["odd", "even"]).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["pending", "active", "completed"]).default("pending").notNull(),
    activeSlot: varchar("active_slot", { length: 36 }).generatedAlwaysAs(sql`CASE WHEN status = 'active' THEN tenant_id ELSE NULL END`),
  },
  (table) => [
    unique("academic_semester_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("academic_semester_year_kind_unique").on(table.academicYearId, table.kind),
    unique("academic_semester_active_slot_unique").on(table.activeSlot),
    foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "academic_semester_tenant_year_fkey" }),
    check("academic_semester_period_check", sql`${table.startDate} <= ${table.endDate}`),
  ],
);

export const academicYearHistory = mysqlTable(
  "academic_year_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id),
    operation: varchar("operation", { length: 50 }).notNull(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
    fromLifecycle: mysqlEnum("from_lifecycle", ["draft", "active", "closed", "cancelled"]),
    toLifecycle: mysqlEnum("to_lifecycle", ["draft", "active", "closed", "cancelled"]).notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "academic_year_history_tenant_year_fkey" }),
    index("academic_year_history_tenant_year_idx").on(table.tenantId, table.academicYearId, table.occurredAt),
  ],
);

export const classGroup = mysqlTable(
  "class_group",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull(),
    educationLevel: mysqlEnum("education_level", ["SD", "SMP", "SMA", "SMK"]).notNull(),
    grade: int("grade").notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    normalizedGroupName: varchar("normalized_group_name", { length: 100 }).notNull(),
    code: varchar("code", { length: 30 }),
    normalizedCode: varchar("normalized_code", { length: 30 }),
    capacity: int("capacity"),
    primaryLocationId: varchar("primary_location_id", { length: 36 }),
    lifecycle: mysqlEnum("lifecycle", ["draft", "active", "closed", "cancelled"]).default("draft").notNull(),
    archived: boolean("archived").default(false).notNull(),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    archiveReason: varchar("archive_reason", { length: 1000 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("class_group_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("class_group_tenant_id_year_unique").on(table.tenantId, table.id, table.academicYearId),
    unique("class_group_year_name_unique").on(table.tenantId, table.academicYearId, table.normalizedGroupName),
    unique("class_group_tenant_code_unique").on(table.tenantId, table.normalizedCode),
    foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "class_group_tenant_year_fkey" }),
    foreignKey({ columns: [table.tenantId, table.primaryLocationId], foreignColumns: [location.tenantId, location.id], name: "class_group_tenant_location_fkey" }),
    index("class_group_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedGroupName),
    check("class_group_grade_check", sql`${table.grade} BETWEEN 1 AND 12`),
    check("class_group_capacity_check", sql`${table.capacity} IS NULL OR (${table.capacity} BETWEEN 1 AND 999)`),
    check("class_group_version_check", sql`${table.version} > 0`),
  ],
);

export const classGroupHistory = mysqlTable(
  "class_group_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), classGroupId: varchar("class_group_id", { length: 36 }).notNull(), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: varchar("operation", { length: 50 }).notNull(), fromVersion: int("from_version").notNull(), toVersion: int("to_version").notNull(), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [foreignKey({ columns: [table.tenantId, table.classGroupId], foreignColumns: [classGroup.tenantId, classGroup.id], name: "class_group_history_tenant_group_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "class_group_history_tenant_actor_fkey" }), index("class_group_history_tenant_group_idx").on(table.tenantId, table.classGroupId, table.occurredAt), check("class_group_history_version_check", sql`${table.fromVersion} >= 0 AND ${table.toVersion} = ${table.fromVersion} + 1`)],
);

export const classGroupRelationship = mysqlTable(
  "class_group_relationship",
  { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), classGroupId: varchar("class_group_id", { length: 36 }).notNull(), kind: varchar("kind", { length: 50 }).notNull(), label: varchar("label", { length: 255 }).notNull(), active: boolean("active").default(true).notNull() },
  (table) => [foreignKey({ columns: [table.tenantId, table.classGroupId], foreignColumns: [classGroup.tenantId, classGroup.id], name: "class_group_relationship_tenant_group_fkey" }), index("class_group_relationship_tenant_active_idx").on(table.tenantId, table.classGroupId, table.active)],
);

export const location = mysqlTable(
  "location",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id), name: varchar("name", { length: 150 }).notNull(), normalizedName: varchar("normalized_name", { length: 150 }).notNull(), code: varchar("code", { length: 30 }).notNull(), normalizedCode: varchar("normalized_code", { length: 30 }).notNull(), type: mysqlEnum("type", ["site", "building", "floor", "room", "outdoor", "other"]).notNull(), capacity: int("capacity"), description: text("description"), parentId: varchar("parent_id", { length: 36 }), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 1000 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [unique("location_tenant_id_id_unique").on(table.tenantId, table.id), unique("location_tenant_code_unique").on(table.tenantId, table.normalizedCode), foreignKey({ columns: [table.tenantId, table.parentId], foreignColumns: [table.tenantId, table.id], name: "location_tenant_parent_fkey" }), index("location_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedName), check("location_capacity_check", sql`${table.capacity} IS NULL OR (${table.capacity} BETWEEN 1 AND 100000)`), check("location_version_check", sql`${table.version} > 0`), check("location_not_self_parent_check", sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`)],
);
export const locationHistory = mysqlTable("location_history", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), locationId: varchar("location_id", { length: 36 }).notNull(), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: varchar("operation", { length: 50 }).notNull(), fromVersion: int("from_version").notNull(), toVersion: int("to_version").notNull(), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.locationId], foreignColumns: [location.tenantId, location.id], name: "location_history_tenant_location_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "location_history_tenant_actor_fkey" }), index("location_history_tenant_location_idx").on(table.tenantId, table.locationId, table.occurredAt), check("location_history_version_check", sql`${table.fromVersion} >= 0 AND ${table.toVersion} = ${table.fromVersion} + 1`)]);
export const locationReference = mysqlTable("location_reference", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), locationId: varchar("location_id", { length: 36 }).notNull(), label: varchar("label", { length: 255 }).notNull(), active: boolean("active").default(true).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.locationId], foreignColumns: [location.tenantId, location.id], name: "location_reference_tenant_location_fkey" }), index("location_reference_tenant_active_idx").on(table.tenantId, table.locationId, table.active)]);

export const inventoryAsset = mysqlTable("inventory_asset", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id), inventoryCode: varchar("inventory_code", { length: 50 }).notNull(), normalizedInventoryCode: varchar("normalized_inventory_code", { length: 50 }).notNull(), name: varchar("name", { length: 150 }).notNull(), normalizedName: varchar("normalized_name", { length: 150 }).notNull(), category: varchar("category", { length: 100 }).notNull(), trackingMode: mysqlEnum("tracking_mode", ["grouped", "individual"]).notNull(), condition: mysqlEnum("condition", ["good", "damaged", "maintenance", "lost"]).notNull(), quantity: int("quantity").notNull(), locationId: varchar("location_id", { length: 36 }), acquisitionDate: date("acquisition_date", { mode: "string" }), acquisitionCost: int("acquisition_cost"), acquisitionSource: varchar("acquisition_source", { length: 150 }), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 1000 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull() }, table => [unique("inventory_asset_tenant_id_id_unique").on(table.tenantId, table.id), unique("inventory_asset_tenant_code_unique").on(table.tenantId, table.normalizedInventoryCode), foreignKey({ columns: [table.tenantId, table.locationId], foreignColumns: [location.tenantId, location.id], name: "inventory_asset_tenant_location_fkey" }), index("inventory_asset_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedName), check("inventory_asset_quantity_check", sql`${table.quantity} >= 0 AND (${table.trackingMode} = 'grouped' OR ${table.quantity} = 1)`), check("inventory_asset_cost_check", sql`${table.acquisitionCost} IS NULL OR ${table.acquisitionCost} >= 0`), check("inventory_asset_version_check", sql`${table.version} > 0`)]);
export const inventoryAssetHistory = mysqlTable("inventory_asset_history", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), assetId: varchar("asset_id", { length: 36 }).notNull(), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: varchar("operation", { length: 50 }).notNull(), before: json("before"), after: json("after").notNull(), reason: varchar("reason", { length: 1000 }).notNull(), fromVersion: int("from_version").notNull(), toVersion: int("to_version").notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, table => [foreignKey({ columns: [table.tenantId, table.assetId], foreignColumns: [inventoryAsset.tenantId, inventoryAsset.id], name: "inventory_history_tenant_asset_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "inventory_history_tenant_actor_fkey" }), index("inventory_history_tenant_asset_idx").on(table.tenantId, table.assetId, table.occurredAt), check("inventory_history_version_check", sql`${table.fromVersion} >= 0 AND ${table.toVersion} = ${table.fromVersion} + 1`)]);
export const inventoryAssetReference = mysqlTable("inventory_asset_reference", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), assetId: varchar("asset_id", { length: 36 }).notNull(), label: varchar("label", { length: 255 }).notNull(), active: boolean("active").default(true).notNull() }, table => [foreignKey({ columns: [table.tenantId, table.assetId], foreignColumns: [inventoryAsset.tenantId, inventoryAsset.id], name: "inventory_reference_tenant_asset_fkey" }), index("inventory_reference_tenant_active_idx").on(table.tenantId, table.assetId, table.active)]);

export const subject = mysqlTable(
  "subject",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    code: varchar("code", { length: 30 }).notNull(),
    normalizedCode: varchar("normalized_code", { length: 30 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 150 }).notNull(),
    educationLevels: varchar("education_levels", { length: 50 }).notNull(),
    description: text("description"),
    archived: boolean("archived").default(false).notNull(),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("subject_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("subject_tenant_normalized_code_unique").on(table.tenantId, table.normalizedCode),
    unique("subject_tenant_normalized_name_unique").on(table.tenantId, table.normalizedName),
    index("subject_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedName),
    check("subject_version_check", sql`${table.version} > 0`),
  ],
);

export const subjectHistory = mysqlTable(
  "subject_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    subjectId: varchar("subject_id", { length: 36 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id),
    operation: mysqlEnum("operation", ["created", "edited", "archived", "reactivated"]).notNull(),
    fromVersion: int("from_version").notNull(),
    toVersion: int("to_version").notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.tenantId, table.subjectId], foreignColumns: [subject.tenantId, subject.id], name: "subject_history_tenant_subject_fkey" }),
    index("subject_history_tenant_subject_idx").on(table.tenantId, table.subjectId, table.occurredAt),
    check("subject_history_version_check", sql`${table.fromVersion} >= 0 AND ${table.toVersion} = ${table.fromVersion} + 1`),
  ],
);

export const schoolPerson = mysqlTable(
  "school_person",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 150 }).notNull(),
    preferredName: varchar("preferred_name", { length: 150 }),
    birthPlace: varchar("birth_place", { length: 100 }).notNull(),
    normalizedBirthPlace: varchar("normalized_birth_place", { length: 100 }).notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    gender: mysqlEnum("gender", ["male", "female"]).notNull(),
    nik: varchar("nik", { length: 16 }),
    nip: varchar("nip", { length: 18 }),
    religion: varchar("religion", { length: 50 }),
    street: varchar("street", { length: 255 }).notNull(),
    village: varchar("village", { length: 100 }),
    district: varchar("district", { length: 100 }),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),
    postalCode: varchar("postal_code", { length: 10 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    accountUserId: varchar("account_user_id", { length: 36 }),
    archived: boolean("archived").default(false).notNull(),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("school_person_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("school_person_tenant_nik_unique").on(table.tenantId, table.nik),
    unique("school_person_tenant_nip_unique").on(table.tenantId, table.nip),
    unique("school_person_tenant_account_unique").on(table.tenantId, table.accountUserId),
    index("school_person_tenant_name_idx").on(table.tenantId, table.normalizedName),
    foreignKey({ columns: [table.tenantId, table.accountUserId], foreignColumns: [user.tenantId, user.id], name: "school_person_tenant_account_fkey" }),
    check("school_person_nik_check", sql`${table.nik} IS NULL OR ${table.nik} REGEXP '^[0-9]{16}$'`),
    check("school_person_nip_check", sql`${table.nip} IS NULL OR ${table.nip} REGEXP '^[0-9]{18}$'`),
    check("school_person_version_check", sql`${table.version} > 0`),
  ],
);

export const schoolPersonAudit = mysqlTable(
  "school_person_audit",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    personId: varchar("person_id", { length: 36 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull(),
    operation: mysqlEnum("operation", ["archived"]).notNull(),
    affectedProfiles: json("affected_profiles").notNull(),
    fromVersion: int("from_version").notNull(),
    toVersion: int("to_version").notNull(),
    sensitiveBefore: json("sensitive_before"),
    sensitiveAfter: json("sensitive_after"),
    reason: varchar("reason", { length: 1000 }),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "school_person_audit_tenant_person_fkey" }),
    foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "school_person_audit_tenant_actor_fkey" }),
    index("school_person_audit_tenant_person_idx").on(table.tenantId, table.personId, table.occurredAt),
  ],
);

export const studentProfile = mysqlTable(
  "student_profile",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    personId: varchar("person_id", { length: 36 }).notNull(),
    nis: varchar("nis", { length: 50 }).notNull(),
    normalizedNis: varchar("normalized_nis", { length: 50 }).notNull(),
    nisn: varchar("nisn", { length: 10 }),
    externalStudentId: varchar("external_student_id", { length: 100 }),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["active", "graduated", "transferred", "withdrawn"]).default("active").notNull(),
    archived: boolean("archived").default(false).notNull(),
    archivedAt: timestamp("archived_at", { fsp: 3 }),
    archiveReason: varchar("archive_reason", { length: 500 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("student_profile_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("student_profile_tenant_person_unique").on(table.tenantId, table.personId),
    unique("student_profile_tenant_nis_unique").on(table.tenantId, table.normalizedNis),
    unique("student_profile_tenant_nisn_unique").on(table.tenantId, table.nisn),
    foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "student_profile_tenant_person_fkey" }),
    index("student_profile_tenant_status_archive_idx").on(table.tenantId, table.status, table.archived),
    check("student_profile_nisn_check", sql`${table.nisn} IS NULL OR ${table.nisn} REGEXP '^[0-9]{10}$'`),
    check("student_profile_version_check", sql`${table.version} > 0`),
  ],
);

export const attendanceSession = mysqlTable(
  "attendance_session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    layer: mysqlEnum("layer", ["gerbang", "kelas"]).notNull(),
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    plannedStart: time("planned_start", { fsp: 0 }).notNull(),
    plannedEnd: time("planned_end", { fsp: 0 }).notNull(),
    openedAt: timestamp("opened_at", { fsp: 3 }).notNull(),
    closedAt: timestamp("closed_at", { fsp: 3 }),
    openedByUserId: varchar("opened_by_user_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", ["open", "closed"]).notNull(),
    notes: varchar("notes", { length: 500 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("attendance_session_tenant_layer_date_unique").on(table.tenantId, table.layer, table.sessionDate),
    unique("attendance_session_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({ columns: [table.tenantId, table.openedByUserId], foreignColumns: [user.tenantId, user.id], name: "attendance_session_tenant_actor_fkey" }),
    check("attendance_session_version_check", sql`${table.version} > 0`),
    check("attendance_session_window_check", sql`${table.plannedEnd} > ${table.plannedStart}`),
  ],
);

export const attendanceRecord = mysqlTable(
  "attendance_record",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    sessionId: varchar("session_id", { length: 36 }),
    layer: mysqlEnum("layer", ["gerbang", "kelas"]).notNull(),
    mode: mysqlEnum("mode", ["manual", "qr", "kartu"]).notNull(),
    recordedAt: timestamp("recorded_at", { fsp: 3 }).notNull(),
    status: mysqlEnum("status", ["masuk", "keluar", "hadir", "izin", "sakit", "alpa"]).notNull(),
    recordedByUserId: varchar("recorded_by_user_id", { length: 36 }).notNull(),
    outOfSession: boolean("out_of_session").default(false).notNull(),
    notes: varchar("notes", { length: 500 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("attendance_record_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "attendance_record_tenant_student_fkey" }),
    foreignKey({ columns: [table.tenantId, table.recordedByUserId], foreignColumns: [user.tenantId, user.id], name: "attendance_record_tenant_actor_fkey" }),
    foreignKey({ columns: [table.tenantId, table.sessionId], foreignColumns: [attendanceSession.tenantId, attendanceSession.id], name: "attendance_record_tenant_session_fkey" }),
    index("attendance_record_tenant_student_layer_recorded_idx").on(table.tenantId, table.studentId, table.layer, table.recordedAt),
    index("attendance_record_tenant_session_idx").on(table.tenantId, table.sessionId),
    check("attendance_record_version_check", sql`${table.version} > 0`),
    check(
      "attendance_record_layer_status_check",
      sql`(
        (${table.layer} = 'gerbang' AND ${table.status} IN ('masuk', 'keluar', 'izin', 'sakit'))
        OR (${table.layer} = 'kelas' AND ${table.status} IN ('hadir', 'izin', 'sakit', 'alpa'))
      )`,
    ),
  ],
);

export const studentLifecyclePeriod = mysqlTable(
  "student_lifecycle_period",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }).notNull(), status: mysqlEnum("status", ["active", "graduated", "transferred", "withdrawn"]).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 500 }).notNull(), notes: text("notes"), corrected: boolean("corrected").default(false).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "student_lifecycle_period_tenant_student_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "student_lifecycle_period_tenant_actor_fkey" }), index("student_lifecycle_period_tenant_student_idx").on(table.tenantId, table.studentId, table.startedAt), check("student_lifecycle_period_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)],
);

export const studentRelationship = mysqlTable(
  "student_relationship",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    active: boolean("active").default(true).notNull(),
    phone: varchar("phone", { length: 32 }),
  },
  (table) => [foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "student_relationship_tenant_student_fkey" }), index("student_relationship_tenant_student_active_idx").on(table.tenantId, table.studentId, table.active)],
);

export const studentAudit = mysqlTable(
  "student_audit",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), personId: varchar("person_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id),
    operation: mysqlEnum("operation", ["created-person", "created-student", "attached-student", "edited", "status-transitioned", "graduation-corrected", "archive-denied", "archived", "reactivated"]).notNull(), fromPersonVersion: int("from_person_version").notNull(), toPersonVersion: int("to_person_version").notNull(), fromStudentVersion: int("from_student_version").notNull(), toStudentVersion: int("to_student_version").notNull(), sensitiveBefore: json("sensitive_before"), sensitiveAfter: json("sensitive_after"), lifecycleBefore: json("lifecycle_before"), lifecycleAfter: json("lifecycle_after"), reason: varchar("reason", { length: 1000 }), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "student_audit_tenant_person_fkey" }), foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "student_audit_tenant_student_fkey" }), index("student_audit_tenant_student_idx").on(table.tenantId, table.studentId, table.occurredAt)],
);

export const teacherProfile = mysqlTable(
  "teacher_profile",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id), personId: varchar("person_id", { length: 36 }).notNull(), teacherNumber: varchar("teacher_number", { length: 50 }).notNull(), normalizedTeacherNumber: varchar("normalized_teacher_number", { length: 50 }).notNull(), nuptk: varchar("nuptk", { length: 16 }), employmentType: mysqlEnum("employment_type", ["civil-servant", "government-contract", "foundation-permanent", "foundation-contract", "honorary"]).notNull(), serviceStartDate: date("service_start_date", { mode: "string" }).notNull(), status: mysqlEnum("status", ["active", "leave", "ended"]).default("active").notNull(), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 500 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [unique("teacher_profile_tenant_id_id_unique").on(table.tenantId, table.id), unique("teacher_profile_tenant_person_unique").on(table.tenantId, table.personId), unique("teacher_profile_tenant_number_unique").on(table.tenantId, table.normalizedTeacherNumber), unique("teacher_profile_tenant_nuptk_unique").on(table.tenantId, table.nuptk), foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "teacher_profile_tenant_person_fkey" }), index("teacher_profile_tenant_status_archive_idx").on(table.tenantId, table.status, table.archived), check("teacher_profile_nuptk_check", sql`${table.nuptk} IS NULL OR ${table.nuptk} REGEXP '^[0-9]{16}$'`), check("teacher_profile_version_check", sql`${table.version} > 0`)],
);

export const teacherServicePeriod = mysqlTable(
  "teacher_service_period",
  { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teacherId: varchar("teacher_id", { length: 36 }).notNull(), status: mysqlEnum("status", ["active", "leave", "ended"]).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 500 }).notNull(), notes: text("notes"), corrected: boolean("corrected").default(false).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() },
  (table) => [foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "teacher_service_period_tenant_teacher_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "teacher_service_period_tenant_actor_fkey" }), index("teacher_service_period_tenant_teacher_idx").on(table.tenantId, table.teacherId, table.startedAt), check("teacher_service_period_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)],
);

export const teacherRelationship = mysqlTable("teacher_relationship", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teacherId: varchar("teacher_id", { length: 36 }).notNull(), kind: varchar("kind", { length: 50 }).notNull(), label: varchar("label", { length: 255 }).notNull(), active: boolean("active").default(true).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "teacher_relationship_tenant_teacher_fkey" }), index("teacher_relationship_tenant_teacher_active_idx").on(table.tenantId, table.teacherId, table.active)]);

export const teacherAudit = mysqlTable("teacher_audit", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), personId: varchar("person_id", { length: 36 }).notNull(), teacherId: varchar("teacher_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id), operation: mysqlEnum("operation", ["created-person", "created-teacher", "attached-teacher", "edited", "status-transitioned", "service-corrected", "archive-denied", "archived", "reactivated"]).notNull(), fromPersonVersion: int("from_person_version").notNull(), toPersonVersion: int("to_person_version").notNull(), fromTeacherVersion: int("from_teacher_version").notNull(), toTeacherVersion: int("to_teacher_version").notNull(), sensitiveBefore: json("sensitive_before"), sensitiveAfter: json("sensitive_after"), lifecycleBefore: json("lifecycle_before"), lifecycleAfter: json("lifecycle_after"), reason: varchar("reason", { length: 1000 }), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "teacher_audit_tenant_person_fkey" }), foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "teacher_audit_tenant_teacher_fkey" }), index("teacher_audit_tenant_teacher_idx").on(table.tenantId, table.teacherId, table.occurredAt)]);

export const headmasterAssignment = mysqlTable("headmaster_assignment", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teacherId: varchar("teacher_id", { length: 36 }).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), openSlot: varchar("open_slot", { length: 7 }).generatedAlwaysAs(sql`CASE WHEN ended_at IS NULL THEN 'current' ELSE NULL END`),
}, (table) => [unique("headmaster_assignment_open_unique").on(table.tenantId, table.openSlot), unique("headmaster_assignment_tenant_id_id_unique").on(table.tenantId, table.id), foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "headmaster_assignment_tenant_teacher_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "headmaster_assignment_tenant_actor_fkey" }), index("headmaster_assignment_tenant_history_idx").on(table.tenantId, table.startedAt), check("headmaster_assignment_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)]);

export const headmasterAssignmentAudit = mysqlTable("headmaster_assignment_audit", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), assignmentId: varchar("assignment_id", { length: 36 }).notNull(), previousAssignmentId: varchar("previous_assignment_id", { length: 36 }), teacherId: varchar("teacher_id", { length: 36 }).notNull(), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: mysqlEnum("operation", ["assigned", "replaced"]).notNull(), effectiveDate: date("effective_date", { mode: "string" }).notNull(), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
}, (table) => [foreignKey({ columns: [table.tenantId, table.assignmentId], foreignColumns: [headmasterAssignment.tenantId, headmasterAssignment.id], name: "headmaster_audit_tenant_assignment_fkey" }), foreignKey({ columns: [table.tenantId, table.previousAssignmentId], foreignColumns: [headmasterAssignment.tenantId, headmasterAssignment.id], name: "headmaster_audit_tenant_previous_fkey" }), foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "headmaster_audit_tenant_teacher_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "headmaster_audit_tenant_actor_fkey" }), index("headmaster_audit_tenant_assignment_idx").on(table.tenantId, table.assignmentId, table.occurredAt)]);

export const classMembership = mysqlTable("class_membership", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }).notNull(), classGroupId: varchar("class_group_id", { length: 36 }).notNull(), academicYearId: varchar("academic_year_id", { length: 36 }).notNull(), planned: boolean("planned").notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  activeStudentSlot: varchar("active_student_slot", { length: 36 }).generatedAlwaysAs(sql`CASE WHEN ended_at IS NULL AND planned = false THEN student_id ELSE NULL END`), plannedStudentSlot: varchar("planned_student_slot", { length: 36 }).generatedAlwaysAs(sql`CASE WHEN ended_at IS NULL AND planned = true THEN student_id ELSE NULL END`),
}, (table) => [unique("class_membership_open_active_unique").on(table.tenantId, table.activeStudentSlot), unique("class_membership_open_planned_unique").on(table.tenantId, table.plannedStudentSlot), foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "class_membership_tenant_student_fkey" }), foreignKey({ columns: [table.tenantId, table.classGroupId], foreignColumns: [classGroup.tenantId, classGroup.id], name: "class_membership_tenant_group_fkey" }), foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "class_membership_tenant_year_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "class_membership_tenant_actor_fkey" }), index("class_membership_tenant_student_history_idx").on(table.tenantId, table.studentId, table.startedAt), index("class_membership_tenant_group_history_idx").on(table.tenantId, table.classGroupId, table.startedAt), check("class_membership_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)]);

export const homeroomAssignment = mysqlTable("homeroom_assignment", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teacherId: varchar("teacher_id", { length: 36 }).notNull(), classGroupId: varchar("class_group_id", { length: 36 }).notNull(), academicYearId: varchar("academic_year_id", { length: 36 }).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), openGroupSlot: varchar("open_group_slot", { length: 36 }).generatedAlwaysAs(sql`CASE WHEN ended_at IS NULL THEN class_group_id ELSE NULL END`), openTeacherYearSlot: varchar("open_teacher_year_slot", { length: 73 }).generatedAlwaysAs(sql`CASE WHEN ended_at IS NULL THEN CONCAT(teacher_id, ':', academic_year_id) ELSE NULL END`),
}, (table) => [unique("homeroom_open_group_unique").on(table.tenantId, table.openGroupSlot), unique("homeroom_open_teacher_year_unique").on(table.tenantId, table.openTeacherYearSlot), foreignKey({ columns: [table.tenantId, table.teacherId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "homeroom_tenant_teacher_fkey" }), foreignKey({ columns: [table.tenantId, table.classGroupId], foreignColumns: [classGroup.tenantId, classGroup.id], name: "homeroom_tenant_group_fkey" }), foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "homeroom_tenant_year_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "homeroom_tenant_actor_fkey" }), index("homeroom_tenant_group_history_idx").on(table.tenantId, table.classGroupId, table.startedAt), index("homeroom_tenant_teacher_history_idx").on(table.tenantId, table.teacherId, table.startedAt), check("homeroom_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)]);

export const teachingAssignment = mysqlTable("teaching_assignment", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teacherProfileId: varchar("teacher_profile_id", { length: 36 }).notNull(), subjectId: varchar("subject_id", { length: 36 }).notNull(), classGroupId: varchar("class_group_id", { length: 36 }).notNull(), academicYearId: varchar("academic_year_id", { length: 36 }).notNull(), startsOn: date("starts_on", { mode: "string" }).notNull(), endsOn: date("ends_on", { mode: "string" }), status: mysqlEnum("status", ["planned", "active", "ended", "cancelled"]).default("planned").notNull(), reason: varchar("reason", { length: 1000 }).notNull(), version: int("version").default(1).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
}, (table) => [unique("teaching_assignment_tenant_id_unique").on(table.tenantId, table.id), foreignKey({ columns: [table.tenantId, table.teacherProfileId], foreignColumns: [teacherProfile.tenantId, teacherProfile.id], name: "teaching_assignment_teacher_fkey" }), foreignKey({ columns: [table.tenantId, table.subjectId], foreignColumns: [subject.tenantId, subject.id], name: "teaching_assignment_subject_fkey" }), foreignKey({ columns: [table.tenantId, table.classGroupId, table.academicYearId], foreignColumns: [classGroup.tenantId, classGroup.id, classGroup.academicYearId], name: "teaching_assignment_class_group_fkey" }), foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "teaching_assignment_academic_year_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "teaching_assignment_actor_fkey" }), index("teaching_assignment_scope_idx").on(table.tenantId, table.teacherProfileId, table.subjectId, table.classGroupId, table.academicYearId, table.status, table.startsOn, table.endsOn), check("teaching_assignment_version_check", sql`${table.version} > 0`), check("teaching_assignment_range_check", sql`${table.endsOn} IS NULL OR ${table.endsOn} > ${table.startsOn}`)]);

export const teachingAssignmentEvent = mysqlTable("teaching_assignment_event", {
  id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), teachingAssignmentId: varchar("teaching_assignment_id", { length: 36 }).notNull(), replacementAssignmentId: varchar("replacement_assignment_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: mysqlEnum("operation", ["created", "planned-updated", "activated", "ended", "cancelled", "replaced"]).notNull(), fromVersion: int("from_version").notNull(), toVersion: int("to_version").notNull(), effectiveOn: date("effective_on", { mode: "string" }).notNull(), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
}, (table) => [foreignKey({ columns: [table.tenantId, table.teachingAssignmentId], foreignColumns: [teachingAssignment.tenantId, teachingAssignment.id], name: "teaching_assignment_event_assignment_fkey" }), foreignKey({ columns: [table.tenantId, table.replacementAssignmentId], foreignColumns: [teachingAssignment.tenantId, teachingAssignment.id], name: "teaching_assignment_event_replacement_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "teaching_assignment_event_actor_fkey" }), index("teaching_assignment_event_scope_idx").on(table.tenantId, table.teachingAssignmentId, table.occurredAt), check("teaching_assignment_event_version_check", sql`${table.fromVersion} >= 0 AND ${table.toVersion} = ${table.fromVersion} + 1`)]);

export const classRelationshipEvent = mysqlTable("class_relationship_event", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), kind: mysqlEnum("kind", ["membership", "homeroom"]).notNull(), relationshipId: varchar("relationship_id", { length: 36 }).notNull(), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: mysqlEnum("operation", ["opened", "transferred", "assigned", "replaced"]).notNull(), effectiveDate: date("effective_date", { mode: "string" }).notNull(), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "class_relationship_event_tenant_actor_fkey" }), index("class_relationship_event_tenant_relationship_idx").on(table.tenantId, table.kind, table.relationshipId, table.occurredAt)]);

export const studentOrganization = mysqlTable("student_organization", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), name: varchar("name", { length: 150 }).notNull(), normalizedName: varchar("normalized_name", { length: 150 }).notNull(), abbreviation: varchar("abbreviation", { length: 30 }), code: varchar("code", { length: 30 }).notNull(), normalizedCode: varchar("normalized_code", { length: 30 }).notNull(), description: text("description"), foundingDate: date("founding_date", { mode: "string" }), secretariatLocationId: varchar("secretariat_location_id", { length: 36 }), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 1000 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull() }, (table) => [unique("student_organization_tenant_id_unique").on(table.tenantId, table.id), unique("student_organization_tenant_code_unique").on(table.tenantId, table.normalizedCode), foreignKey({ columns: [table.tenantId], foreignColumns: [tenant.id], name: "student_organization_tenant_fkey" }), foreignKey({ columns: [table.tenantId, table.secretariatLocationId], foreignColumns: [location.tenantId, location.id], name: "student_organization_location_fkey" }), index("student_organization_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedName), check("student_organization_version_check", sql`${table.version} > 0`)]);
export const organizationPeriod = mysqlTable("organization_period", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), organizationId: varchar("organization_id", { length: 36 }).notNull(), name: varchar("name", { length: 100 }).notNull(), status: mysqlEnum("status", ["planned", "active", "completed"]).default("planned").notNull(), startDate: date("start_date", { mode: "string" }).notNull(), endDate: date("end_date", { mode: "string" }).notNull(), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull() }, (table) => [unique("organization_period_tenant_id_unique").on(table.tenantId, table.id), foreignKey({ columns: [table.tenantId, table.organizationId], foreignColumns: [studentOrganization.tenantId, studentOrganization.id], name: "organization_period_organization_fkey" }), index("organization_period_history_idx").on(table.tenantId, table.organizationId, table.startDate), check("organization_period_range_check", sql`${table.endDate} >= ${table.startDate}`)]);
export const organizationMembership = mysqlTable("organization_membership", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), organizationId: varchar("organization_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.organizationId], foreignColumns: [studentOrganization.tenantId, studentOrganization.id], name: "organization_membership_organization_fkey" }), foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "organization_membership_student_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "organization_membership_actor_fkey" }), index("organization_membership_history_idx").on(table.tenantId, table.organizationId, table.studentId, table.startedAt), check("organization_membership_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)]);
export const organizationLeadership = mysqlTable("organization_leadership", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), periodId: varchar("period_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }).notNull(), positionName: varchar("position_name", { length: 100 }).notNull(), normalizedPositionName: varchar("normalized_position_name", { length: 100 }).notNull(), allowsMultipleHolders: boolean("allows_multiple_holders").notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.periodId], foreignColumns: [organizationPeriod.tenantId, organizationPeriod.id], name: "organization_leadership_period_fkey" }), foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "organization_leadership_student_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "organization_leadership_actor_fkey" }), index("organization_leadership_history_idx").on(table.tenantId, table.periodId, table.normalizedPositionName, table.startedAt), check("organization_leadership_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)]);
export const organizationEvent = mysqlTable("organization_event", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), organizationId: varchar("organization_id", { length: 36 }).notNull(), periodId: varchar("period_id", { length: 36 }), relationshipId: varchar("relationship_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: varchar("operation", { length: 50 }).notNull(), effectiveDate: date("effective_date", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.organizationId], foreignColumns: [studentOrganization.tenantId, studentOrganization.id], name: "organization_event_organization_fkey" }), foreignKey({ columns: [table.tenantId, table.periodId], foreignColumns: [organizationPeriod.tenantId, organizationPeriod.id], name: "organization_event_period_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "organization_event_actor_fkey" }), index("organization_event_history_idx").on(table.tenantId, table.organizationId, table.occurredAt)]);

export const extracurricular = mysqlTable("extracurricular", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id), name: varchar("name", { length: 150 }).notNull(), normalizedName: varchar("normalized_name", { length: 150 }).notNull(), code: varchar("code", { length: 30 }).notNull(), normalizedCode: varchar("normalized_code", { length: 30 }).notNull(), description: text("description"), defaultLocationId: varchar("default_location_id", { length: 36 }), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 1000 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull() }, table => [unique("extracurricular_tenant_id_unique").on(table.tenantId, table.id), unique("extracurricular_tenant_code_unique").on(table.tenantId, table.normalizedCode), foreignKey({ columns: [table.tenantId, table.defaultLocationId], foreignColumns: [location.tenantId, location.id], name: "extracurricular_location_fkey" }), index("extracurricular_tenant_archive_name_idx").on(table.tenantId, table.archived, table.normalizedName), check("extracurricular_version_check", sql`${table.version}>0`)]);
export const activityGroup = mysqlTable("activity_group", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), extracurricularId: varchar("extracurricular_id", { length: 36 }).notNull(), academicYearId: varchar("academic_year_id", { length: 36 }).notNull(), name: varchar("name", { length: 150 }).notNull(), startDate: date("start_date", { mode: "string" }).notNull(), endDate: date("end_date", { mode: "string" }).notNull(), capacity: int("capacity").notNull(), locationId: varchar("location_id", { length: 36 }), scheduleText: varchar("schedule_text", { length: 500 }).notNull(), lifecycle: mysqlEnum("lifecycle", ["planned", "active", "completed", "cancelled"]).default("planned").notNull(), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull() }, table => [unique("activity_group_tenant_id_unique").on(table.tenantId, table.id), foreignKey({ columns: [table.tenantId, table.extracurricularId], foreignColumns: [extracurricular.tenantId, extracurricular.id], name: "activity_group_extracurricular_fkey" }), foreignKey({ columns: [table.tenantId, table.academicYearId], foreignColumns: [academicYear.tenantId, academicYear.id], name: "activity_group_year_fkey" }), foreignKey({ columns: [table.tenantId, table.locationId], foreignColumns: [location.tenantId, location.id], name: "activity_group_location_fkey" }), index("activity_group_history_idx").on(table.tenantId, table.extracurricularId, table.academicYearId, table.startDate), check("activity_group_range_check", sql`${table.endDate}>=${table.startDate}`), check("activity_group_capacity_check", sql`${table.capacity}>0`)]);
export const activityAdvisor = mysqlTable("activity_advisor", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), groupId: varchar("group_id", { length: 36 }).notNull(), advisorKind: mysqlEnum("advisor_kind", ["teacher", "staff"]).notNull(), advisorId: varchar("advisor_id", { length: 36 }).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() }, table => [foreignKey({ columns: [table.tenantId, table.groupId], foreignColumns: [activityGroup.tenantId, activityGroup.id], name: "activity_advisor_group_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "activity_advisor_actor_fkey" }), index("activity_advisor_history_idx").on(table.tenantId, table.groupId, table.advisorId, table.startedAt), check("activity_advisor_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt}>=${table.startedAt}`)]);
export const activityParticipant = mysqlTable("activity_participant", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), groupId: varchar("group_id", { length: 36 }).notNull(), studentId: varchar("student_id", { length: 36 }).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() }, table => [foreignKey({ columns: [table.tenantId, table.groupId], foreignColumns: [activityGroup.tenantId, activityGroup.id], name: "activity_participant_group_fkey" }), foreignKey({ columns: [table.tenantId, table.studentId], foreignColumns: [studentProfile.tenantId, studentProfile.id], name: "activity_participant_student_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "activity_participant_actor_fkey" }), index("activity_participant_capacity_idx").on(table.tenantId, table.groupId, table.startedAt, table.endedAt), check("activity_participant_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt}>=${table.startedAt}`)]);
export const activityEvent = mysqlTable("activity_event", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), extracurricularId: varchar("extracurricular_id", { length: 36 }).notNull(), groupId: varchar("group_id", { length: 36 }), relationshipId: varchar("relationship_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull(), operation: varchar("operation", { length: 50 }).notNull(), effectiveDate: date("effective_date", { mode: "string" }), reason: varchar("reason", { length: 1000 }).notNull(), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, table => [foreignKey({ columns: [table.tenantId, table.extracurricularId], foreignColumns: [extracurricular.tenantId, extracurricular.id], name: "activity_event_extracurricular_fkey" }), foreignKey({ columns: [table.tenantId, table.groupId], foreignColumns: [activityGroup.tenantId, activityGroup.id], name: "activity_event_group_fkey" }), foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "activity_event_actor_fkey" }), index("activity_event_history_idx").on(table.tenantId, table.extracurricularId, table.occurredAt)]);

export const staffProfile = mysqlTable(
  "staff_profile",
  {
    id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id), personId: varchar("person_id", { length: 36 }).notNull(), staffNumber: varchar("staff_number", { length: 50 }).notNull(), normalizedStaffNumber: varchar("normalized_staff_number", { length: 50 }).notNull(), position: mysqlEnum("position", ["administration", "finance", "library", "laboratory", "security", "cleaning", "other"]).notNull(), positionOther: varchar("position_other", { length: 100 }), employmentType: mysqlEnum("employment_type", ["civil-servant", "government-contract", "foundation-permanent", "foundation-contract", "honorary", "other"]).notNull(), employmentTypeOther: varchar("employment_type_other", { length: 100 }), serviceStartDate: date("service_start_date", { mode: "string" }).notNull(), status: mysqlEnum("status", ["active", "leave", "ended"]).default("active").notNull(), archived: boolean("archived").default(false).notNull(), archivedAt: timestamp("archived_at", { fsp: 3 }), archiveReason: varchar("archive_reason", { length: 500 }), version: int("version").default(1).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull(), updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [unique("staff_profile_tenant_id_id_unique").on(table.tenantId, table.id), unique("staff_profile_tenant_person_unique").on(table.tenantId, table.personId), unique("staff_profile_tenant_number_unique").on(table.tenantId, table.normalizedStaffNumber), foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "staff_profile_tenant_person_fkey" }), index("staff_profile_tenant_status_archive_idx").on(table.tenantId, table.status, table.archived), check("staff_profile_position_other_check", sql`${table.position} <> "other" OR ${table.positionOther} IS NOT NULL`), check("staff_profile_employment_other_check", sql`${table.employmentType} <> "other" OR ${table.employmentTypeOther} IS NOT NULL`), check("staff_profile_version_check", sql`${table.version} > 0`)],
);

export const staffPositionAssignment = mysqlTable(
  "staff_position_assignment",
  { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), staffId: varchar("staff_id", { length: 36 }).notNull(), position: mysqlEnum("position", ["administration", "finance", "library", "laboratory", "security", "cleaning", "other"]).notNull(), positionOther: varchar("position_other", { length: 100 }), workUnit: varchar("work_unit", { length: 150 }), notes: text("notes"), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() },
  (table) => [foreignKey({ columns: [table.tenantId, table.staffId], foreignColumns: [staffProfile.tenantId, staffProfile.id], name: "staff_position_assignment_tenant_staff_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "staff_position_assignment_tenant_actor_fkey" }), index("staff_position_assignment_tenant_staff_idx").on(table.tenantId, table.staffId, table.startedAt), check("staff_position_assignment_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`), check("staff_position_assignment_other_check", sql`${table.position} <> 'other' OR ${table.positionOther} IS NOT NULL`)],
);

export const staffServicePeriod = mysqlTable(
  "staff_service_period",
  { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), staffId: varchar("staff_id", { length: 36 }).notNull(), status: mysqlEnum("status", ["active", "leave", "ended"]).notNull(), startedAt: date("started_at", { mode: "string" }).notNull(), endedAt: date("ended_at", { mode: "string" }), reason: varchar("reason", { length: 500 }).notNull(), notes: text("notes"), corrected: boolean("corrected").default(false).notNull(), createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(), createdAt: timestamp("created_at", { fsp: 3 }).notNull() },
  (table) => [foreignKey({ columns: [table.tenantId, table.staffId], foreignColumns: [staffProfile.tenantId, staffProfile.id], name: "staff_service_period_tenant_staff_fkey" }), foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [user.tenantId, user.id], name: "staff_service_period_tenant_actor_fkey" }), index("staff_service_period_tenant_staff_idx").on(table.tenantId, table.staffId, table.startedAt), check("staff_service_period_range_check", sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`)],
);

export const staffRelationship = mysqlTable("staff_relationship", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), staffId: varchar("staff_id", { length: 36 }).notNull(), kind: varchar("kind", { length: 50 }).notNull(), label: varchar("label", { length: 255 }).notNull(), active: boolean("active").default(true).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.staffId], foreignColumns: [staffProfile.tenantId, staffProfile.id], name: "staff_relationship_tenant_staff_fkey" }), index("staff_relationship_tenant_staff_active_idx").on(table.tenantId, table.staffId, table.active)]);

export const staffAudit = mysqlTable("staff_audit", { id: varchar("id", { length: 36 }).primaryKey(), tenantId: varchar("tenant_id", { length: 36 }).notNull(), personId: varchar("person_id", { length: 36 }).notNull(), staffId: varchar("staff_id", { length: 36 }), actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => user.id), operation: mysqlEnum("operation", ["created-person", "created-staff", "attached-staff", "edited", "status-transitioned", "service-corrected", "archive-denied", "archived", "reactivated"]).notNull(), fromPersonVersion: int("from_person_version").notNull(), toPersonVersion: int("to_person_version").notNull(), fromStaffVersion: int("from_staff_version").notNull(), toStaffVersion: int("to_staff_version").notNull(), sensitiveBefore: json("sensitive_before"), sensitiveAfter: json("sensitive_after"), lifecycleBefore: json("lifecycle_before"), lifecycleAfter: json("lifecycle_after"), reason: varchar("reason", { length: 1000 }), occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull() }, (table) => [foreignKey({ columns: [table.tenantId, table.personId], foreignColumns: [schoolPerson.tenantId, schoolPerson.id], name: "staff_audit_tenant_person_fkey" }), foreignKey({ columns: [table.tenantId, table.staffId], foreignColumns: [staffProfile.tenantId, staffProfile.id], name: "staff_audit_tenant_staff_fkey" }), index("staff_audit_tenant_staff_idx").on(table.tenantId, table.staffId, table.occurredAt)]);

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
  tenantRole: mysqlEnum("tenant_role", [
    "school-admin",
    "pimpinan",
    "staff",
    "guru",
    "siswa",
    "guest",
  ]),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
}, (table) => [unique("user_tenant_id_id_unique").on(table.tenantId, table.id)]);

export const academicOperationPreview = mysqlTable(
  "academic_operation_preview",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull(),
    operationId: varchar("operation_id", { length: 128 }).notNull(),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull(),
    intentDigest: varchar("intent_digest", { length: 64 }).notNull(),
    normalizedIntent: json("normalized_intent").notNull(),
    state: mysqlEnum("state", ["pending", "committed", "invalidated", "expired", "cancelled"]).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    outcome: json("outcome"),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    committedAt: timestamp("committed_at", { fsp: 3 }),
    invalidatedAt: timestamp("invalidated_at", { fsp: 3 }),
  },
  (table) => [
    unique("academic_preview_token_digest_unique").on(table.tokenDigest),
    unique("academic_preview_actor_idempotency_unique").on(table.tenantId, table.actorUserId, table.idempotencyKey),
    foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [user.tenantId, user.id], name: "academic_preview_tenant_actor_fkey" }),
    index("academic_preview_tenant_state_expiry_idx").on(table.tenantId, table.state, table.expiresAt),
  ],
);

export const providerAdmin = mysqlTable("provider_admin", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
});

export const applicant = mysqlTable("applicant", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
});

export const applicantSchoolBinding = mysqlTable("applicant_school_binding", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique("applicant_school_binding_user_id_unique")
    .references(() => user.id),
  canonicalNpsn: varchar("canonical_npsn", { length: 8 })
    .notNull()
    .unique("applicant_school_binding_canonical_npsn_unique"),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
});

export const simasApplication = mysqlTable(
  "simas_application",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    schoolName: varchar("school_name", { length: 255 }).notNull(),
    npsn: varchar("npsn", { length: 20 }).notNull(),
    educationLevel: varchar("education_level", { length: 64 }).notNull(),
    address: text("address").notNull(),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactPosition: varchar("contact_position", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactWhatsapp: varchar("contact_whatsapp", { length: 32 }).notNull(),
    needsNote: text("needs_note"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .default("pending")
      .notNull(),
    submittedAt: timestamp("submitted_at", { fsp: 3 }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { fsp: 3 }),
    decidedByProviderAdminId: varchar("decided_by_provider_admin_id", {
      length: 36,
    }).references(() => providerAdmin.userId),
    rejectionReason: text("rejection_reason"),
    approvedTenantId: varchar("approved_tenant_id", { length: 36 }).references(
      (): AnyMySqlColumn => tenant.id,
    ),
    ownerUserId: varchar("owner_user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    bindingId: varchar("binding_id", { length: 36 })
      .notNull()
      .references(() => applicantSchoolBinding.id),
    attemptNumber: int("attempt_number").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    pendingBindingId: varchar("pending_binding_id", { length: 36 })
      .generatedAlwaysAs(
        sql`CASE WHEN status = 'pending' THEN binding_id ELSE NULL END`,
      ),
  },
  (table) => [
    unique("simas_application_approved_tenant_id_unique").on(
      table.approvedTenantId,
    ),
    unique("simas_application_binding_attempt_unique").on(
      table.bindingId,
      table.attemptNumber,
    ),
    unique("simas_application_owner_idempotency_unique").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
    unique("simas_application_pending_binding_unique").on(
      table.pendingBindingId,
    ),
    check(
      "simas_application_attempt_number_check",
      sql`${table.attemptNumber} > 0`,
    ),
    check(
      "simas_application_decision_state_check",
      sql`(
        (${table.status} = 'pending' AND ${table.decidedAt} IS NULL AND ${table.decidedByProviderAdminId} IS NULL AND ${table.rejectionReason} IS NULL AND ${table.approvedTenantId} IS NULL)
        OR (${table.status} = 'approved' AND ${table.decidedAt} IS NOT NULL AND ${table.decidedByProviderAdminId} IS NOT NULL AND ${table.rejectionReason} IS NULL AND ${table.approvedTenantId} IS NOT NULL)
        OR (${table.status} = 'rejected' AND ${table.decidedAt} IS NOT NULL AND ${table.decidedByProviderAdminId} IS NOT NULL AND CHAR_LENGTH(TRIM(${table.rejectionReason})) > 0 AND ${table.approvedTenantId} IS NULL)
      )`,
    ),
  ],
);

export const temporaryCredentialActivation = mysqlTable(
  "temporary_credential_activation",
  {
    userId: varchar("user_id", { length: 36 })
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    temporaryCredentialIssuedAt: timestamp("temporary_credential_issued_at", {
      fsp: 3,
    }).notNull(),
    firstAuthenticatedAt: timestamp("first_authenticated_at", { fsp: 3 }),
    passwordChangeRequired: boolean("password_change_required")
      .default(true)
      .notNull(),
    passwordChangedAt: timestamp("password_changed_at", { fsp: 3 }),
  },
  (table) => [
    check(
      "temporary_credential_activation_password_state_check",
      sql`((${table.passwordChangeRequired} = true AND ${table.passwordChangedAt} IS NULL) OR (${table.passwordChangeRequired} = false AND ${table.passwordChangedAt} IS NOT NULL))`,
    ),
  ],
);

export const tenantOperationalMigrationCheckpoint = mysqlTable(
  "tenant_operational_migration_checkpoint",
  {
    migrationKey: varchar("migration_key", { length: 100 }).primaryKey(),
    lastTenantId: varchar("last_tenant_id", { length: 36 }),
    examinedCount: int("examined_count").default(0).notNull(),
    migratedCount: int("migrated_count").default(0).notNull(),
    reconciliationCount: int("reconciliation_count").default(0).notNull(),
    accessDifferenceCount: int("access_difference_count").default(0).notNull(),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    check("tenant_operational_migration_examined_check", sql`${table.examinedCount} >= 0`),
    check("tenant_operational_migration_migrated_check", sql`${table.migratedCount} >= 0`),
    check("tenant_operational_migration_reconciliation_check", sql`${table.reconciliationCount} >= 0`),
    check("tenant_operational_migration_access_difference_check", sql`${table.accessDifferenceCount} >= 0`),
  ],
);

export const transactionalOutbox = mysqlTable(
  "transactional_outbox",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 64 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 36 }).notNull(),
    eventIdentity: varchar("event_identity", { length: 255 })
      .default("legacy")
      .notNull(),
    payload: json("payload").notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    attempts: int("attempts").default(0).notNull(),
    lastError: text("last_error"),
  },
  (table) => [
    unique("transactional_outbox_event_identity_unique").on(
      table.eventType,
      table.aggregateType,
      table.aggregateId,
      table.eventIdentity,
    ),
    index("transactional_outbox_pending_idx").on(
      table.publishedAt,
      table.occurredAt,
    ),
    check("transactional_outbox_attempts_check", sql`${table.attempts} >= 0`),
  ],
);

export const tenantRole = mysqlTable(
  "tenant_role",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    name: varchar("name", { length: 150 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 150 }).notNull(),
    description: text("description"),
    lifecycle: mysqlEnum("lifecycle", ["draft", "active", "archived"]).default("draft").notNull(),
    origin: mysqlEnum("origin", ["scratch", "template", "copy", "legacy-migration"]).notNull(),
    templateKey: varchar("template_key", { length: 100 }),
    templateVersion: varchar("template_version", { length: 64 }),
    copiedFromRoleId: varchar("copied_from_role_id", { length: 36 }),
    legacyRole: mysqlEnum("legacy_role", ["pimpinan", "staff", "guru", "siswa", "guest"]),
    migrationRunId: varchar("migration_run_id", { length: 36 }),
    migrationVersion: varchar("migration_version", { length: 64 }),
    migrationVerification: mysqlEnum("migration_verification", ["pending", "verified", "mismatch"]),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_role_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("tenant_role_tenant_name_unique").on(table.tenantId, table.normalizedName),
    foreignKey({ columns: [table.tenantId, table.copiedFromRoleId], foreignColumns: [table.tenantId, table.id], name: "tenant_role_tenant_copy_fkey" }),
    index("tenant_role_tenant_lifecycle_idx").on(table.tenantId, table.lifecycle, table.normalizedName),
    check("tenant_role_name_check", sql`CHAR_LENGTH(TRIM(${table.name})) > 0 AND CHAR_LENGTH(TRIM(${table.normalizedName})) > 0`),
    check("tenant_role_version_check", sql`${table.version} > 0`),
    check("tenant_role_provenance_check", sql`(
      (${table.origin} = 'scratch' AND ${table.templateKey} IS NULL AND ${table.templateVersion} IS NULL AND ${table.copiedFromRoleId} IS NULL AND ${table.legacyRole} IS NULL AND ${table.migrationRunId} IS NULL AND ${table.migrationVersion} IS NULL AND ${table.migrationVerification} IS NULL)
      OR (${table.origin} = 'template' AND ${table.templateKey} IS NOT NULL AND ${table.templateVersion} IS NOT NULL AND ${table.copiedFromRoleId} IS NULL AND ${table.legacyRole} IS NULL AND ${table.migrationRunId} IS NULL AND ${table.migrationVersion} IS NULL AND ${table.migrationVerification} IS NULL)
      OR (${table.origin} = 'copy' AND ${table.templateKey} IS NULL AND ${table.templateVersion} IS NULL AND ${table.copiedFromRoleId} IS NOT NULL AND ${table.legacyRole} IS NULL AND ${table.migrationRunId} IS NULL AND ${table.migrationVersion} IS NULL AND ${table.migrationVerification} IS NULL)
      OR (${table.origin} = 'legacy-migration' AND ${table.templateKey} IS NULL AND ${table.templateVersion} IS NULL AND ${table.copiedFromRoleId} IS NULL AND ${table.legacyRole} IS NOT NULL AND ${table.migrationRunId} IS NOT NULL AND ${table.migrationVersion} IS NOT NULL AND ${table.migrationVerification} IS NOT NULL)
    )`),
  ],
);

export const tenantRolePermission = mysqlTable(
  "tenant_role_permission",
  {
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    permissionKey: varchar("permission_key", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_role_permission_unique").on(table.tenantId, table.roleId, table.permissionKey),
    foreignKey({ columns: [table.tenantId, table.roleId], foreignColumns: [tenantRole.tenantId, tenantRole.id], name: "tenant_role_permission_role_fkey" }),
    index("tenant_role_permission_key_idx").on(table.permissionKey, table.tenantId),
    check("tenant_role_permission_key_check", sql`${table.permissionKey} COLLATE utf8mb4_bin REGEXP '^[a-z0-9]+(-[a-z0-9]+)*\\.[a-z0-9]+(-[a-z0-9]+)*\\.[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

// Per-role sidebar menu visibility. A row with `visible = false` hides that
// menu key (and its sub-items) from every user holding the role. Absence of a
// row defaults to visible. This is independent of the Provider-owned
// `tenant.settings.menu` visibility and of RBAC permissions: a menu is shown
// only when the user has the required permission AND no active role hides it.
export const tenantRoleMenuVisibility = mysqlTable(
  "tenant_role_menu_visibility",
  {
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    menuKey: varchar("menu_key", { length: 100 }).notNull(),
    visible: boolean("visible").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_role_menu_visibility_unique").on(table.tenantId, table.roleId, table.menuKey),
    foreignKey({ columns: [table.tenantId, table.roleId], foreignColumns: [tenantRole.tenantId, tenantRole.id], name: "tenant_role_menu_visibility_role_fkey" }),
    index("tenant_role_menu_visibility_role_idx").on(table.tenantId, table.roleId),
  ],
);

export const tenantAccountSecurity = mysqlTable(
  "tenant_account_security",
  {
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    lifecycle: mysqlEnum("lifecycle", ["pending-activation", "active", "inactive"]).notNull(),
    version: int("version").default(1).notNull(),
    assignmentVersion: int("assignment_version").default(1).notNull(),
    activatedAt: timestamp("activated_at", { fsp: 3 }),
    deactivatedAt: timestamp("deactivated_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_account_security_user_unique").on(table.userId),
    unique("tenant_account_security_tenant_user_unique").on(table.tenantId, table.userId),
    foreignKey({ columns: [table.tenantId, table.userId], foreignColumns: [user.tenantId, user.id], name: "tenant_account_security_user_fkey" }),
    index("tenant_account_security_state_idx").on(table.tenantId, table.lifecycle, table.userId),
    check("tenant_account_security_version_check", sql`${table.version} > 0 AND ${table.assignmentVersion} > 0`),
    check("tenant_account_security_lifecycle_check", sql`(
      (${table.lifecycle} = 'pending-activation' AND ${table.activatedAt} IS NULL AND ${table.deactivatedAt} IS NULL)
      OR (${table.lifecycle} = 'active' AND ${table.activatedAt} IS NOT NULL AND ${table.deactivatedAt} IS NULL)
      OR (${table.lifecycle} = 'inactive' AND ${table.deactivatedAt} IS NOT NULL)
    )`),
  ],
);

export const tenantRoleAssignment = mysqlTable(
  "tenant_role_assignment",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    state: mysqlEnum("state", ["active", "suspended"]).default("active").notNull(),
    version: int("version").default(1).notNull(),
    assignedAt: timestamp("assigned_at", { fsp: 3 }).notNull(),
    suspendedAt: timestamp("suspended_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_role_assignment_tenant_id_unique").on(table.tenantId, table.id),
    unique("tenant_role_assignment_user_role_unique").on(table.tenantId, table.userId, table.roleId),
    foreignKey({ columns: [table.tenantId, table.userId], foreignColumns: [user.tenantId, user.id], name: "tenant_role_assignment_user_fkey" }),
    foreignKey({ columns: [table.tenantId, table.roleId], foreignColumns: [tenantRole.tenantId, tenantRole.id], name: "tenant_role_assignment_role_fkey" }),
    index("tenant_role_assignment_user_state_idx").on(table.tenantId, table.userId, table.state),
    index("tenant_role_assignment_role_state_idx").on(table.tenantId, table.roleId, table.state),
    check("tenant_role_assignment_version_check", sql`${table.version} > 0`),
    check("tenant_role_assignment_state_check", sql`(${table.state} = 'active' AND ${table.suspendedAt} IS NULL) OR (${table.state} = 'suspended' AND ${table.suspendedAt} IS NOT NULL)`),
  ],
);

export const tenantAccountLifecycleCase = mysqlTable(
  "tenant_account_lifecycle_case",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    kind: mysqlEnum("kind", ["activation", "recovery"]).notNull(),
    state: mysqlEnum("state", ["pending", "completed", "expired", "cancelled", "revoked"]).notNull(),
    deliveryChannel: mysqlEnum("delivery_channel", ["email", "temporary-credential"]).notNull(),
    secretDigest: varchar("secret_digest", { length: 128 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    consumedAt: timestamp("consumed_at", { fsp: 3 }),
    deliveryAttempts: int("delivery_attempts").default(0).notNull(),
    pendingSlot: boolean("pending_slot").generatedAlwaysAs(
      sql`CASE WHEN state = 'pending' THEN true ELSE NULL END`,
    ),
    version: int("version").default(1).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("tenant_account_case_tenant_id_unique").on(table.tenantId, table.id),
    unique("tenant_account_case_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    unique("tenant_account_case_pending_unique").on(
      table.tenantId,
      table.userId,
      table.kind,
      table.pendingSlot,
    ),
    foreignKey({ columns: [table.tenantId, table.userId], foreignColumns: [user.tenantId, user.id], name: "tenant_account_case_user_fkey" }),
    index("tenant_account_case_user_state_idx").on(table.tenantId, table.userId, table.kind, table.state),
    check("tenant_account_case_version_check", sql`${table.version} > 0 AND ${table.deliveryAttempts} >= 0`),
    check("tenant_account_case_material_check", sql`(${table.state} <> 'pending') OR (${table.secretDigest} IS NOT NULL AND ${table.expiresAt} IS NOT NULL AND ${table.consumedAt} IS NULL)`),
    check("tenant_account_case_consumed_check", sql`(${table.state} <> 'completed') OR ${table.consumedAt} IS NOT NULL`),
  ],
);

export const schoolAdminAuthority = mysqlTable(
  "school_admin_authority",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    authorityState: mysqlEnum("authority_state", ["none", "active", "disabled"]).default("none").notNull(),
    version: int("version").default(1).notNull(),
    grantedAt: timestamp("granted_at", { fsp: 3 }),
    disabledAt: timestamp("disabled_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("school_admin_authority_tenant_id_unique").on(table.tenantId, table.id),
    unique("school_admin_authority_tenant_user_unique").on(table.tenantId, table.userId),
    foreignKey({ columns: [table.tenantId, table.userId], foreignColumns: [user.tenantId, user.id], name: "school_admin_authority_user_fkey" }),
    index("school_admin_authority_roster_idx").on(table.tenantId, table.authorityState, table.userId),
    check("school_admin_authority_version_check", sql`${table.version} > 0`),
    check("school_admin_authority_state_check", sql`(
      (${table.authorityState} = 'none' AND ${table.grantedAt} IS NULL AND ${table.disabledAt} IS NULL)
      OR (${table.authorityState} = 'active' AND ${table.grantedAt} IS NOT NULL AND ${table.disabledAt} IS NULL)
      OR (${table.authorityState} = 'disabled' AND ${table.grantedAt} IS NOT NULL AND ${table.disabledAt} IS NOT NULL)
    )`),
  ],
);

export const schoolAdminProof = mysqlTable(
  "school_admin_proof",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    authorityId: varchar("authority_id", { length: 36 }).notNull(),
    caseId: varchar("case_id", { length: 36 }).notNull(),
    kind: mysqlEnum("kind", ["nomination", "recovery"]).notNull(),
    proofState: mysqlEnum("proof_state", ["pending", "completed", "expired", "cancelled"]).default("pending").notNull(),
    secretDigest: varchar("secret_digest", { length: 128 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    pendingSlot: boolean("pending_slot").generatedAlwaysAs(
      sql`CASE WHEN proof_state = 'pending' THEN true ELSE NULL END`,
    ),
    version: int("version").default(1).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("school_admin_proof_tenant_id_unique").on(table.tenantId, table.id),
    unique("school_admin_proof_case_unique").on(table.tenantId, table.caseId),
    unique("school_admin_proof_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    unique("school_admin_proof_pending_unique").on(
      table.tenantId,
      table.authorityId,
      table.kind,
      table.pendingSlot,
    ),
    foreignKey({ columns: [table.tenantId, table.authorityId], foreignColumns: [schoolAdminAuthority.tenantId, schoolAdminAuthority.id], name: "school_admin_proof_authority_fkey" }),
    index("school_admin_proof_authority_state_idx").on(table.tenantId, table.authorityId, table.proofState),
    check("school_admin_proof_version_check", sql`${table.version} > 0`),
    check("school_admin_proof_pending_check", sql`(${table.proofState} <> 'pending') OR (${table.secretDigest} IS NOT NULL AND ${table.expiresAt} IS NOT NULL AND ${table.completedAt} IS NULL)`),
    check("school_admin_proof_completed_check", sql`(${table.proofState} <> 'completed') OR ${table.completedAt} IS NOT NULL`),
  ],
);

export const securityCommand = mysqlTable(
  "security_command",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    commandName: varchar("command_name", { length: 128 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
    result: json("result"),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    completedAt: timestamp("completed_at", { fsp: 3 }),
  },
  (table) => [
    unique("security_command_context_id_unique").on(table.securityContextKind, table.contextId, table.id),
    unique("security_command_idempotency_unique").on(table.securityContextKind, table.contextId, table.idempotencyKey),
    index("security_command_status_idx").on(table.status, table.createdAt),
    check("security_command_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
    check("security_command_fingerprint_check", sql`${table.fingerprint} REGEXP '^[a-f0-9]{64}$'`),
    check("security_command_completion_check", sql`(${table.status} = 'pending' AND ${table.completedAt} IS NULL) OR (${table.status} <> 'pending' AND ${table.completedAt} IS NOT NULL)`),
  ],
);

export const securityOutbox = mysqlTable(
  "security_outbox",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    commandId: varchar("command_id", { length: 36 }).notNull(),
    eventKey: varchar("event_key", { length: 160 }).notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    payload: json("payload").notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
    availableAt: timestamp("available_at", { fsp: 3 }).notNull(),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    attempts: int("attempts").default(0).notNull(),
    lastError: text("last_error"),
  },
  (table) => [
    unique("security_outbox_event_unique").on(table.securityContextKind, table.contextId, table.eventKey),
    foreignKey({ columns: [table.securityContextKind, table.contextId, table.commandId], foreignColumns: [securityCommand.securityContextKind, securityCommand.contextId, securityCommand.id], name: "security_outbox_command_fkey" }),
    index("security_outbox_pending_idx").on(table.publishedAt, table.availableAt),
    check("security_outbox_attempts_check", sql`${table.attempts} >= 0`),
    check("security_outbox_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
  ],
);

export const tenantRbacRollout = mysqlTable(
  "tenant_rbac_rollout",
  {
    tenantId: varchar("tenant_id", { length: 36 }).primaryKey().references(() => tenant.id),
    httpMode: mysqlEnum("http_mode", ["legacy", "intersection", "rbac", "rbac-emergency"]).default("legacy").notNull(),
    workerMode: mysqlEnum("worker_mode", ["legacy", "intersection", "rbac", "rbac-emergency"]).default("legacy").notNull(),
    epoch: bigint("epoch", { mode: "bigint", unsigned: true }).default(sql`1`).notNull(),
    resolverVersion: varchar("resolver_version", { length: 64 }).notNull(),
    registryVersion: varchar("registry_version", { length: 64 }).notNull(),
    operationMapVersion: varchar("operation_map_version", { length: 64 }).notNull(),
    overlayHash: varchar("overlay_hash", { length: 64 }),
    overlayPolicyVersion: varchar("overlay_policy_version", { length: 64 }),
    overlayDeniedOperationIds: json("overlay_denied_operation_ids").$type<readonly string[]>(),
    overlayDeniedPermissionKeys: json("overlay_denied_permission_keys").$type<readonly string[]>(),
    overlayDenyMutations: boolean("overlay_deny_mutations"),
    overlayReviewAt: timestamp("overlay_review_at", { fsp: 3 }),
    overlayExpiresAt: timestamp("overlay_expires_at", { fsp: 3 }),
    multiRoleAcceptedAt: timestamp("multi_role_accepted_at", { fsp: 3 }),
    version: int("version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    index("tenant_rbac_rollout_modes_idx").on(table.httpMode, table.workerMode, table.epoch),
    check("tenant_rbac_rollout_version_check", sql`${table.version} > 0 AND ${table.epoch} > 0`),
    check("tenant_rbac_rollout_emergency_check", sql`(
      (${table.httpMode} = 'rbac-emergency' AND ${table.workerMode} = 'rbac-emergency'
        AND ${table.overlayHash} REGEXP '^[a-f0-9]{64}$'
        AND ${table.overlayPolicyVersion} IS NOT NULL
        AND ${table.overlayDeniedOperationIds} IS NOT NULL
        AND ${table.overlayDeniedPermissionKeys} IS NOT NULL
        AND ${table.overlayDenyMutations} IS NOT NULL
        AND ${table.overlayReviewAt} IS NOT NULL
        AND ${table.overlayExpiresAt} IS NOT NULL
        AND ${table.overlayReviewAt} <= ${table.overlayExpiresAt})
      OR (${table.httpMode} <> 'rbac-emergency' AND ${table.workerMode} <> 'rbac-emergency'
        AND ${table.overlayHash} IS NULL
        AND ${table.overlayPolicyVersion} IS NULL
        AND ${table.overlayDeniedOperationIds} IS NULL
        AND ${table.overlayDeniedPermissionKeys} IS NULL
        AND ${table.overlayDenyMutations} IS NULL
        AND ${table.overlayReviewAt} IS NULL
        AND ${table.overlayExpiresAt} IS NULL)
    )`),
    check("tenant_rbac_rollout_rollback_check", sql`${table.multiRoleAcceptedAt} IS NULL OR (${table.httpMode} IN ('rbac', 'rbac-emergency') AND ${table.workerMode} IN ('rbac', 'rbac-emergency'))`),
  ],
);

export const securityMigrationCheckpoint = mysqlTable(
  "security_migration_checkpoint",
  {
    migrationKey: varchar("migration_key", { length: 128 }).notNull(),
    shardKey: varchar("shard_key", { length: 128 }).notNull(),
    state: mysqlEnum("state", ["pending", "running", "completed", "blocked"]).default("pending").notNull(),
    cursor: varchar("cursor", { length: 255 }),
    sourceWatermark: varchar("source_watermark", { length: 255 }),
    registryVersion: varchar("registry_version", { length: 64 }).notNull(),
    operationMapVersion: varchar("operation_map_version", { length: 64 }).notNull(),
    examinedCount: int("examined_count").default(0).notNull(),
    migratedCount: int("migrated_count").default(0).notNull(),
    findingCount: int("finding_count").default(0).notNull(),
    version: int("version").default(1).notNull(),
    startedAt: timestamp("started_at", { fsp: 3 }),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("security_migration_checkpoint_unique").on(table.migrationKey, table.shardKey),
    index("security_migration_checkpoint_state_idx").on(table.migrationKey, table.state, table.shardKey),
    check("security_migration_checkpoint_counts_check", sql`${table.examinedCount} >= 0 AND ${table.migratedCount} >= 0 AND ${table.findingCount} >= 0 AND ${table.version} > 0`),
    check("security_migration_checkpoint_state_check", sql`(
      (${table.state} = 'pending' AND ${table.startedAt} IS NULL AND ${table.completedAt} IS NULL)
      OR (${table.state} IN ('running', 'blocked') AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NULL)
      OR (${table.state} = 'completed' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NOT NULL)
    )`),
  ],
);

export const securityReconciliationFinding = mysqlTable(
  "security_reconciliation_finding",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    migrationKey: varchar("migration_key", { length: 128 }).notNull(),
    scopeKey: varchar("scope_key", { length: 128 }).notNull(),
    findingKey: varchar("finding_key", { length: 160 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
    userId: varchar("user_id", { length: 36 }),
    reasonCode: varchar("reason_code", { length: 100 }).notNull(),
    severity: mysqlEnum("severity", ["warning", "blocking"]).notNull(),
    state: mysqlEnum("state", ["open", "resolved", "accepted"]).default("open").notNull(),
    safeDetails: json("safe_details").notNull(),
    detectedAt: timestamp("detected_at", { fsp: 3 }).notNull(),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
  },
  (table) => [
    unique("security_reconciliation_finding_unique").on(table.migrationKey, table.scopeKey, table.findingKey),
    foreignKey({ columns: [table.tenantId, table.userId], foreignColumns: [user.tenantId, user.id], name: "security_reconciliation_user_fkey" }),
    index("security_reconciliation_state_idx").on(table.state, table.severity, table.detectedAt),
    index("security_reconciliation_tenant_idx").on(table.tenantId, table.state, table.reasonCode),
    check("security_reconciliation_scope_check", sql`${table.tenantId} IS NULL OR ${table.scopeKey} = ${table.tenantId}`),
    check("security_reconciliation_user_scope_check", sql`${table.userId} IS NULL OR ${table.tenantId} IS NOT NULL`),
    check("security_reconciliation_resolution_check", sql`(${table.state} = 'open' AND ${table.resolvedAt} IS NULL) OR (${table.state} <> 'open' AND ${table.resolvedAt} IS NOT NULL)`),
  ],
);

export const securityAuditRetentionPolicy = mysqlTable(
  "security_audit_retention_policy",
  {
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    retentionDays: int("retention_days").notNull(),
    version: int("version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("security_audit_retention_policy_partition_unique").on(table.securityContextKind, table.contextId),
    check("security_audit_retention_policy_days_check", sql`${table.retentionDays} >= 0 AND ${table.version} > 0`),
    check("security_audit_retention_policy_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
  ],
);

export const securityAuditLegalHold = mysqlTable(
  "security_audit_legal_hold",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    caseId: varchar("case_id", { length: 128 }).notNull(),
    reason: varchar("reason", { length: 1000 }).notNull(),
    state: mysqlEnum("state", ["active", "released"]).default("active").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    releasedAt: timestamp("released_at", { fsp: 3 }),
  },
  (table) => [
    unique("security_audit_legal_hold_case_unique").on(table.securityContextKind, table.contextId, table.caseId),
    index("security_audit_legal_hold_state_idx").on(table.securityContextKind, table.contextId, table.state),
    check("security_audit_legal_hold_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
    check("security_audit_legal_hold_release_check", sql`(${table.state} = 'active' AND ${table.releasedAt} IS NULL) OR (${table.state} = 'released' AND ${table.releasedAt} IS NOT NULL)`),
  ],
);

export const securityAuditRetentionCertificate = mysqlTable(
  "security_audit_retention_certificate",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    policyVersion: int("policy_version").notNull(),
    retentionDays: int("retention_days").notNull(),
    legalHold: boolean("legal_hold").notNull(),
    tenantDeleted: boolean("tenant_deleted").notNull(),
    retainedCount: int("retained_count").notNull(),
    minimizedCount: int("minimized_count").notNull(),
    disposalEligibleCount: int("disposal_eligible_count").notNull(),
    eventWatermark: varchar("event_watermark", { length: 64 }).notNull(),
    issuedAt: timestamp("issued_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("security_audit_retention_certificate_id_unique").on(table.securityContextKind, table.contextId, table.id),
    index("security_audit_retention_certificate_context_idx").on(table.securityContextKind, table.contextId, table.issuedAt),
    check("security_audit_retention_certificate_count_check", sql`${table.retentionDays} >= 0 AND ${table.policyVersion} > 0 AND ${table.retainedCount} >= 0 AND ${table.minimizedCount} >= 0 AND ${table.disposalEligibleCount} >= 0`),
    check("security_audit_retention_certificate_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
  ],
);

export const securityAuditHead = mysqlTable(
  "security_audit_head",
  {
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    nextSequence: bigint("next_sequence", { mode: "bigint", unsigned: true }).default(sql`1`).notNull(),
    headHash: varchar("head_hash", { length: 64 }).notNull(),
    version: int("version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("security_audit_head_partition_unique").on(table.securityContextKind, table.contextId),
    check("security_audit_head_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId})
    )`),
    check("security_audit_head_sequence_check", sql`${table.nextSequence} > 0 AND ${table.version} > 0`),
    check("security_audit_head_hash_check", sql`${table.headHash} REGEXP '^[a-f0-9]{64}$'`),
  ],
);

export const securityAuditEvent = mysqlTable(
  "security_audit_event",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    securityContextKind: mysqlEnum("security_context_kind", ["tenant", "provider"]).notNull(),
    contextId: varchar("context_id", { length: 36 }).notNull(),
    tenantId: varchar("tenant_id", { length: 36 }).references(() => tenant.id),
    providerContextId: varchar("provider_context_id", { length: 36 }),
    sequence: bigint("sequence", { mode: "bigint", unsigned: true }).notNull(),
    eventKey: varchar("event_key", { length: 160 }).notNull(),
    schemaVersion: int("schema_version").notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    outcome: mysqlEnum("outcome", ["succeeded", "annotated"]).notNull(),
    actorKind: mysqlEnum("actor_kind", ["tenant-user", "provider-admin", "system", "support-recovery"]).notNull(),
    actorTenantUserId: varchar("actor_tenant_user_id", { length: 36 }),
    actorProviderUserId: varchar("actor_provider_user_id", { length: 36 }),
    actorService: varchar("actor_service", { length: 128 }),
    commandId: varchar("command_id", { length: 36 }).notNull(),
    targetUserId: varchar("target_user_id", { length: 36 }),
    targetRoleId: varchar("target_role_id", { length: 36 }),
    targetAssignmentId: varchar("target_assignment_id", { length: 36 }),
    targetSchoolAdminAuthorityId: varchar("target_school_admin_authority_id", { length: 36 }),
    targetSchoolAdminProofId: varchar("target_school_admin_proof_id", { length: 36 }),
    correlationId: varchar("correlation_id", { length: 64 }).notNull(),
    requestId: varchar("request_id", { length: 64 }),
    reason: varchar("reason", { length: 1000 }),
    metadata: json("metadata").notNull(),
    canonicalPayloadDigest: varchar("canonical_payload_digest", { length: 64 }).notNull(),
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    eventHash: varchar("event_hash", { length: 64 }).notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("security_audit_event_sequence_unique").on(table.securityContextKind, table.contextId, table.sequence),
    unique("security_audit_event_key_unique").on(table.securityContextKind, table.contextId, table.eventKey),
    foreignKey({ columns: [table.securityContextKind, table.contextId, table.commandId], foreignColumns: [securityCommand.securityContextKind, securityCommand.contextId, securityCommand.id], name: "security_audit_event_command_fkey" }),
    foreignKey({ columns: [table.tenantId, table.actorTenantUserId], foreignColumns: [user.tenantId, user.id], name: "security_audit_event_tenant_actor_fkey" }),
    foreignKey({ columns: [table.actorProviderUserId], foreignColumns: [providerAdmin.userId], name: "security_audit_event_provider_actor_fkey" }),
    foreignKey({ columns: [table.tenantId, table.targetUserId], foreignColumns: [user.tenantId, user.id], name: "security_audit_event_target_user_fkey" }),
    foreignKey({ columns: [table.tenantId, table.targetRoleId], foreignColumns: [tenantRole.tenantId, tenantRole.id], name: "security_audit_event_target_role_fkey" }),
    foreignKey({ columns: [table.tenantId, table.targetAssignmentId], foreignColumns: [tenantRoleAssignment.tenantId, tenantRoleAssignment.id], name: "security_audit_event_target_assignment_fkey" }),
    foreignKey({ columns: [table.tenantId, table.targetSchoolAdminAuthorityId], foreignColumns: [schoolAdminAuthority.tenantId, schoolAdminAuthority.id], name: "security_audit_event_target_authority_fkey" }),
    foreignKey({ columns: [table.tenantId, table.targetSchoolAdminProofId], foreignColumns: [schoolAdminProof.tenantId, schoolAdminProof.id], name: "security_audit_event_target_proof_fkey" }),
    index("security_audit_event_type_idx").on(table.securityContextKind, table.contextId, table.eventType, table.occurredAt),
    index("security_audit_event_target_user_idx").on(table.tenantId, table.targetUserId, table.occurredAt),
    check("security_audit_event_context_check", sql`(
      (${table.securityContextKind} = 'tenant' AND ${table.tenantId} = ${table.contextId} AND ${table.providerContextId} IS NULL)
      OR (${table.securityContextKind} = 'provider' AND ${table.tenantId} IS NULL AND ${table.providerContextId} = ${table.contextId} AND ${table.targetUserId} IS NULL AND ${table.targetRoleId} IS NULL AND ${table.targetAssignmentId} IS NULL AND ${table.targetSchoolAdminAuthorityId} IS NULL AND ${table.targetSchoolAdminProofId} IS NULL)
    )`),
    check("security_audit_event_actor_check", sql`(
      (${table.actorKind} = 'tenant-user' AND ${table.actorTenantUserId} IS NOT NULL AND ${table.actorProviderUserId} IS NULL AND ${table.actorService} IS NULL)
      OR (${table.actorKind} IN ('provider-admin', 'support-recovery') AND ${table.actorTenantUserId} IS NULL AND ${table.actorProviderUserId} IS NOT NULL AND ${table.actorService} IS NULL)
      OR (${table.actorKind} = 'system' AND ${table.actorTenantUserId} IS NULL AND ${table.actorProviderUserId} IS NULL AND ${table.actorService} IS NOT NULL)
    )`),
    check("security_audit_event_hash_check", sql`${table.sequence} > 0 AND ${table.schemaVersion} > 0 AND ${table.canonicalPayloadDigest} REGEXP '^[a-f0-9]{64}$' AND ${table.previousHash} REGEXP '^[a-f0-9]{64}$' AND ${table.eventHash} REGEXP '^[a-f0-9]{64}$'`),
  ],
);

export const session = mysqlTable(
  "session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = mysqlTable(
  "account",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = mysqlTable(
  "verification",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// PPDB Feature Tables
// Sesi PPDB menyimpan snapshot Form publik dan draft terpisah agar perubahan admin tidak langsung terlihat publik.
export const ppdbSession = mysqlTable(
  "ppdb_session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "ended"]).default("draft").notNull(),
    fields: json("fields"),
    draftFields: json("draft_fields"),
    version: int("version").default(1).notNull(),
    publishedAt: timestamp("published_at", { fsp: 3 }),
    endedAt: timestamp("ended_at", { fsp: 3 }),
    acceptedFeedback: text("accepted_feedback"),
    acceptedNextSteps: text("accepted_next_steps"),
    rejectedFeedback: text("rejected_feedback"),
    rejectedNextSteps: text("rejected_next_steps"),
    whatsappGroupUrl: varchar("whatsapp_group_url", { length: 2048 }),
    resultsPublishedAt: timestamp("results_published_at", { fsp: 3 }),
    resultCheckClosedAt: timestamp("result_check_closed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    // Hanya satu Sesi PPDB boleh berstatus "published" per Tenant pada satu waktu.
    publishedSlot: varchar("published_slot", { length: 36 }).generatedAlwaysAs(
      sql`CASE WHEN status = 'published' THEN tenant_id ELSE NULL END`,
    ),
  },
  (table) => [
    unique("ppdb_session_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("ppdb_session_published_slot_unique").on(table.publishedSlot),
    foreignKey({
      columns: [table.tenantId, table.academicYearId],
      foreignColumns: [academicYear.tenantId, academicYear.id],
      name: "ppdb_session_tenant_year_fkey",
    }),
    index("ppdb_session_tenant_status_idx").on(table.tenantId, table.status),
    check("ppdb_session_version_check", sql`${table.version} > 0`),
  ],
);

export const ppdbSubmission = mysqlTable(
  "ppdb_submission",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    // ID pendaftaran publik yang ditunjukkan ke Calon Siswa untuk cek status (submission anonim, tanpa akun).
    registrationCode: varchar("registration_code", { length: 20 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull(),
    nisn: varchar("nisn", { length: 20 }).notNull(),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .default("pending")
      .notNull(),
    score: int("score"),
    formFields: json("form_fields"),
    formData: json("form_data"),
    version: int("version").default(1).notNull(),
    submittedAt: timestamp("submitted_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("ppdb_submission_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("ppdb_submission_tenant_registration_code_unique").on(table.tenantId, table.registrationCode),
    foreignKey({
      columns: [table.tenantId, table.sessionId],
      foreignColumns: [ppdbSession.tenantId, ppdbSession.id],
      name: "ppdb_submission_tenant_session_fkey",
    }),
    index("ppdb_submission_tenant_session_idx").on(table.tenantId, table.sessionId, table.submittedAt),
    check("ppdb_submission_version_check", sql`${table.version} > 0`),
  ],
);

export const ppdbSubmissionDocument = mysqlTable(
  "ppdb_submission_document",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    submissionId: varchar("submission_id", { length: 36 }).notNull(),
    fieldId: varchar("field_id", { length: 100 }).notNull(),
    storageKey: varchar("storage_key", { length: 700 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    mimeType: mysqlEnum("mime_type", ["application/pdf", "image/jpeg", "image/png"]).notNull(),
    byteSize: int("byte_size").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("ppdb_submission_document_storage_key_unique").on(table.storageKey),
    unique("ppdb_submission_document_field_unique").on(table.tenantId, table.submissionId, table.fieldId),
    foreignKey({
      columns: [table.tenantId, table.submissionId],
      foreignColumns: [ppdbSubmission.tenantId, ppdbSubmission.id],
      name: "ppdb_submission_document_submission_fkey",
    }),
    index("ppdb_submission_document_submission_idx").on(table.tenantId, table.submissionId),
    check("ppdb_submission_document_size_check", sql`${table.byteSize} > 0 AND ${table.byteSize} <= 2097152`),
  ],
);

export const quizSession = mysqlTable(
  "quiz_session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull(),
    subjectId: varchar("subject_id", { length: 36 }).notNull(),
    classGroupId: varchar("class_group_id", { length: 36 }).notNull(),
    mode: mysqlEnum("mode", ["daring", "luring"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "active", "ended", "graded"]).default("draft").notNull(),
    durationMinutes: int("duration_minutes"),
    startedAt: timestamp("started_at", { fsp: 3 }),
    endedAt: timestamp("ended_at", { fsp: 3 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("quiz_session_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.academicYearId],
      foreignColumns: [academicYear.tenantId, academicYear.id],
      name: "quiz_session_tenant_year_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.subjectId],
      foreignColumns: [subject.tenantId, subject.id],
      name: "quiz_session_tenant_subject_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.classGroupId],
      foreignColumns: [classGroup.tenantId, classGroup.id],
      name: "quiz_session_tenant_class_group_fkey",
    }),
    index("quiz_session_tenant_status_idx").on(table.tenantId, table.status),
    index("quiz_session_tenant_class_group_idx").on(table.tenantId, table.classGroupId),
    check("quiz_session_version_check", sql`${table.version} > 0`),
  ],
);

export const quizQuestion = mysqlTable(
  "quiz_question",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    questionText: text("question_text").notNull(),
    questionType: mysqlEnum("question_type", ["multiple_choice", "true_false", "essay"]).notNull(),
    options: json("options"),
    correctAnswer: varchar("correct_answer", { length: 500 }),
    points: int("points").default(1).notNull(),
    orderIndex: int("order_index").default(0).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    unique("quiz_question_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.sessionId],
      foreignColumns: [quizSession.tenantId, quizSession.id],
      name: "quiz_question_tenant_session_fkey",
    }),
    index("quiz_question_tenant_session_idx").on(table.tenantId, table.sessionId),
    check("quiz_question_points_check", sql`${table.points} > 0`),
  ],
);

export const quizAnswerSheet = mysqlTable(
  "quiz_answer_sheet",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", ["in_progress", "submitted", "graded"]).default("in_progress").notNull(),
    totalScore: int("total_score"),
    maxScore: int("max_score"),
    submittedAt: timestamp("submitted_at", { fsp: 3 }),
    gradedAt: timestamp("graded_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("quiz_answer_sheet_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("quiz_answer_sheet_tenant_session_student_unique").on(table.tenantId, table.sessionId, table.studentId),
    foreignKey({
      columns: [table.tenantId, table.sessionId],
      foreignColumns: [quizSession.tenantId, quizSession.id],
      name: "quiz_answer_sheet_tenant_session_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentProfile.tenantId, studentProfile.id],
      name: "quiz_answer_sheet_tenant_student_fkey",
    }),
    index("quiz_answer_sheet_tenant_session_idx").on(table.tenantId, table.sessionId),
  ],
);

export const quizAnswer = mysqlTable(
  "quiz_answer",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    answerSheetId: varchar("answer_sheet_id", { length: 36 }).notNull(),
    questionId: varchar("question_id", { length: 36 }).notNull(),
    answerText: varchar("answer_text", { length: 500 }),
    isCorrect: boolean("is_correct"),
    score: int("score"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    unique("quiz_answer_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("quiz_answer_sheet_question_unique").on(table.tenantId, table.answerSheetId, table.questionId),
    foreignKey({
      columns: [table.tenantId, table.answerSheetId],
      foreignColumns: [quizAnswerSheet.tenantId, quizAnswerSheet.id],
      name: "quiz_answer_tenant_sheet_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.questionId],
      foreignColumns: [quizQuestion.tenantId, quizQuestion.id],
      name: "quiz_answer_tenant_question_fkey",
    }),
    index("quiz_answer_tenant_sheet_idx").on(table.tenantId, table.answerSheetId),
  ],
);



export const quizAttendance = mysqlTable(
  "quiz_attendance",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", ["present", "absent", "late"]).notNull(),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    unique("quiz_attendance_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("quiz_attendance_tenant_session_student_unique").on(table.tenantId, table.sessionId, table.studentId),
    foreignKey({
      columns: [table.tenantId, table.sessionId],
      foreignColumns: [quizSession.tenantId, quizSession.id],
      name: "quiz_attendance_tenant_session_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.studentId],
      foreignColumns: [studentProfile.tenantId, studentProfile.id],
      name: "quiz_attendance_tenant_student_fkey",
    }),
    index("quiz_attendance_tenant_session_idx").on(table.tenantId, table.sessionId),
  ],
);

export const whatsappBotConnection = mysqlTable(
  "whatsapp_bot_connection",
  {
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    openwaSessionId: varchar("openwa_session_id", { length: 36 }).notNull(),
    openwaSessionName: varchar("openwa_session_name", { length: 128 }).notNull(),
    openwaWebhookId: varchar("openwa_webhook_id", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["connected", "error"]).default("connected").notNull(),
    botPhone: varchar("bot_phone", { length: 32 }),
    botPushName: varchar("bot_push_name", { length: 255 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("whatsapp_bot_connection_tenant_unique").on(table.tenantId),
    unique("whatsapp_bot_connection_session_id_unique").on(table.openwaSessionId),
    unique("whatsapp_bot_connection_session_name_unique").on(table.openwaSessionName),
    index("whatsapp_bot_connection_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const whatsappBotMessage = mysqlTable(
  "whatsapp_bot_message",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull(),
    openwaMessageId: varchar("openwa_message_id", { length: 128 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    event: varchar("event", { length: 64 }).default("message.received").notNull(),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).default("inbound").notNull(),
    chatId: varchar("chat_id", { length: 32 }).notNull(),
    fromWa: varchar("from_wa", { length: 32 }).notNull(),
    toWa: varchar("to_wa", { length: 32 }),
    body: text("body"),
    messageType: varchar("message_type", { length: 32 }),
    hasMedia: boolean("has_media").default(false).notNull(),
    isGroup: boolean("is_group").default(false).notNull(),
    kind: varchar("kind", { length: 32 }),
    metadata: json("metadata"),
    messageTimestamp: bigint("message_timestamp", { mode: "number" }),
    receivedAt: timestamp("received_at", { fsp: 3 }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { fsp: 3 }),
    deliveryStatus: varchar("delivery_status", { length: 32 }),
  },
  (table) => [
    unique("whatsapp_bot_message_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("whatsapp_bot_message_tenant_received_idx").on(table.tenantId, table.receivedAt),
  ],
);

export const tenantOpenWaCredential = mysqlTable(
  "tenant_openwa_credential",
  {
    tenantId: varchar("tenant_id", { length: 36 })
      .primaryKey()
      .references(() => tenant.id),
    apiBaseUrl: varchar("api_base_url", { length: 255 }),
    apiKeyCiphertext: varchar("api_key_ciphertext", { length: 512 }).notNull(),
    sessionKey: varchar("session_key", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
);

export const whatsappBotRequestStatus = [
  "pending",
  "approved",
  "fulfilled",
  "rejected",
] as const;
export type WhatsAppBotRequestStatus = (typeof whatsappBotRequestStatus)[number];

export const whatsappBotRequest = mysqlTable(
  "whatsapp_bot_request",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 })
      .notNull()
      .references(() => tenant.id),
    requestedPhone: varchar("requested_phone", { length: 16 }).notNull(),
    desiredSessionName: varchar("desired_session_name", { length: 50 }),
    picName: varchar("pic_name", { length: 128 }).notNull(),
    note: text("note"),
    status: mysqlEnum("status", whatsappBotRequestStatus).default("pending").notNull(),
    providerNote: text("provider_note"),
    resolutionMethod: mysqlEnum("resolution_method", ["self_service", "provider"]),
    openwaSessionId: varchar("openwa_session_id", { length: 36 }),
    resolvedAt: timestamp("resolved_at", { fsp: 3 }),
    resolvedBy: varchar("resolved_by", { length: 36 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("whatsapp_bot_request_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const schemaRelations = defineRelations(
  {
    tenant,
    quizSession,
    quizQuestion,
    quizAnswerSheet,
    quizAnswer,
    quizAttendance,
    schoolProfile,
    schoolAsset,
    schoolAccreditation,
    schoolProfileAudit,
    academicYear,
    academicSemester,
    academicYearHistory,
    classGroup,
    classGroupHistory,
    classGroupRelationship,
    studentProfile,
    attendanceRecord,
    subject,
    subjectHistory,
    user,
    providerAdmin,
    applicant,
    applicantSchoolBinding,
    simasApplication,
    temporaryCredentialActivation,
    tenantOperationalMigrationCheckpoint,
    transactionalOutbox,
    session,
    account,
  },
  (r) => ({
    tenant: {
      sourceApplication: r.one.simasApplication({
        from: r.tenant.sourceApplicationId,
        to: r.simasApplication.id,
      }),
      approvedApplication: r.one.simasApplication({
        from: r.tenant.id,
        to: r.simasApplication.approvedTenantId,
      }),
      users: r.many.user(),
      temporaryCredentialActivations: r.many.temporaryCredentialActivation(),
      schoolProfile: r.one.schoolProfile({ from: r.tenant.id, to: r.schoolProfile.tenantId }),
      schoolAssets: r.many.schoolAsset(),
      schoolAccreditations: r.many.schoolAccreditation(),
      schoolProfileAudits: r.many.schoolProfileAudit(),
    },
    schoolProfile: {
      tenant: r.one.tenant({ from: r.schoolProfile.tenantId, to: r.tenant.id }),
      logoAsset: r.one.schoolAsset({ from: [r.schoolProfile.tenantId, r.schoolProfile.logoAssetId], to: [r.schoolAsset.tenantId, r.schoolAsset.id] }),
      accreditations: r.many.schoolAccreditation(),
      audits: r.many.schoolProfileAudit(),
    },
    schoolAsset: {
      tenant: r.one.tenant({ from: r.schoolAsset.tenantId, to: r.tenant.id }),
      profile: r.one.schoolProfile({ from: [r.schoolAsset.tenantId, r.schoolAsset.id], to: [r.schoolProfile.tenantId, r.schoolProfile.logoAssetId] }),
      creator: r.one.user({ from: r.schoolAsset.createdByUserId, to: r.user.id }),
    },
    schoolAccreditation: {
      tenant: r.one.tenant({ from: r.schoolAccreditation.tenantId, to: r.tenant.id }),
      profile: r.one.schoolProfile({ from: r.schoolAccreditation.profileId, to: r.schoolProfile.id }),
      creator: r.one.user({ from: r.schoolAccreditation.createdByUserId, to: r.user.id }),
    },
    schoolProfileAudit: {
      tenant: r.one.tenant({ from: r.schoolProfileAudit.tenantId, to: r.tenant.id }),
      profile: r.one.schoolProfile({ from: r.schoolProfileAudit.profileId, to: r.schoolProfile.id }),
      actor: r.one.user({ from: r.schoolProfileAudit.actorUserId, to: r.user.id }),
    },
    user: {
      tenant: r.one.tenant({ from: r.user.tenantId, to: r.tenant.id }),
      providerAdmin: r.one.providerAdmin({
        from: r.user.id,
        to: r.providerAdmin.userId,
      }),
      applicant: r.one.applicant({
        from: r.user.id,
        to: r.applicant.userId,
      }),
      applicantSchoolBinding: r.one.applicantSchoolBinding({
        from: r.user.id,
        to: r.applicantSchoolBinding.userId,
      }),
      ownedApplications: r.many.simasApplication({
        from: r.user.id,
        to: r.simasApplication.ownerUserId,
      }),
      temporaryCredentialActivation: r.one.temporaryCredentialActivation({
        from: r.user.id,
        to: r.temporaryCredentialActivation.userId,
      }),
      sessions: r.many.session(),
      accounts: r.many.account(),
      attendanceRecords: r.many.attendanceRecord({
        from: [r.user.tenantId, r.user.id],
        to: [r.attendanceRecord.tenantId, r.attendanceRecord.recordedByUserId],
      }),
    },
    studentProfile: {
      tenant: r.one.tenant({ from: r.studentProfile.tenantId, to: r.tenant.id }),
      attendanceRecords: r.many.attendanceRecord({
        from: [r.studentProfile.tenantId, r.studentProfile.id],
        to: [r.attendanceRecord.tenantId, r.attendanceRecord.studentId],
      }),
    },
    providerAdmin: {
      user: r.one.user({ from: r.providerAdmin.userId, to: r.user.id }),
      decidedApplications: r.many.simasApplication(),
    },
    applicant: {
      user: r.one.user({ from: r.applicant.userId, to: r.user.id }),
    },
    applicantSchoolBinding: {
      user: r.one.user({
        from: r.applicantSchoolBinding.userId,
        to: r.user.id,
      }),
      applications: r.many.simasApplication(),
    },
    simasApplication: {
      decidedByProviderAdmin: r.one.providerAdmin({
        from: r.simasApplication.decidedByProviderAdminId,
        to: r.providerAdmin.userId,
      }),
      approvedTenant: r.one.tenant({
        from: r.simasApplication.approvedTenantId,
        to: r.tenant.id,
      }),
      sourceTenant: r.one.tenant({
        from: r.simasApplication.id,
        to: r.tenant.sourceApplicationId,
      }),
      owner: r.one.user({
        from: r.simasApplication.ownerUserId,
        to: r.user.id,
      }),
      binding: r.one.applicantSchoolBinding({
        from: r.simasApplication.bindingId,
        to: r.applicantSchoolBinding.id,
      }),
    },
    temporaryCredentialActivation: {
      user: r.one.user({
        from: r.temporaryCredentialActivation.userId,
        to: r.user.id,
      }),
      tenant: r.one.tenant({
        from: r.temporaryCredentialActivation.tenantId,
        to: r.tenant.id,
      }),
    },
    session: {
      user: r.one.user({ from: r.session.userId, to: r.user.id }),
    },
    account: {
      user: r.one.user({ from: r.account.userId, to: r.user.id }),
    },
    quizSession: {
      tenant: r.one.tenant({ from: r.quizSession.tenantId, to: r.tenant.id }),
      academicYear: r.one.academicYear({ from: [r.quizSession.tenantId, r.quizSession.academicYearId], to: [r.academicYear.tenantId, r.academicYear.id] }),
      subject: r.one.subject({ from: [r.quizSession.tenantId, r.quizSession.subjectId], to: [r.subject.tenantId, r.subject.id] }),
      classGroup: r.one.classGroup({ from: [r.quizSession.tenantId, r.quizSession.classGroupId], to: [r.classGroup.tenantId, r.classGroup.id] }),
      questions: r.many.quizQuestion(),
      answerSheets: r.many.quizAnswerSheet(),
    },
    quizQuestion: {
      tenant: r.one.tenant({ from: r.quizQuestion.tenantId, to: r.tenant.id }),
      session: r.one.quizSession({ from: [r.quizQuestion.tenantId, r.quizQuestion.sessionId], to: [r.quizSession.tenantId, r.quizSession.id] }),
      answers: r.many.quizAnswer(),
    },
    quizAnswerSheet: {
      tenant: r.one.tenant({ from: r.quizAnswerSheet.tenantId, to: r.tenant.id }),
      session: r.one.quizSession({ from: [r.quizAnswerSheet.tenantId, r.quizAnswerSheet.sessionId], to: [r.quizSession.tenantId, r.quizSession.id] }),
      student: r.one.studentProfile({ from: [r.quizAnswerSheet.tenantId, r.quizAnswerSheet.studentId], to: [r.studentProfile.tenantId, r.studentProfile.id] }),
      answers: r.many.quizAnswer(),
    },
    quizAnswer: {
      tenant: r.one.tenant({ from: r.quizAnswer.tenantId, to: r.tenant.id }),
      answerSheet: r.one.quizAnswerSheet({ from: [r.quizAnswer.tenantId, r.quizAnswer.answerSheetId], to: [r.quizAnswerSheet.tenantId, r.quizAnswerSheet.id] }),
      question: r.one.quizQuestion({ from: [r.quizAnswer.tenantId, r.quizAnswer.questionId], to: [r.quizQuestion.tenantId, r.quizQuestion.id] }),
    },
    quizAttendance: {
      tenant: r.one.tenant({ from: r.quizAttendance.tenantId, to: r.tenant.id }),
      session: r.one.quizSession({ from: [r.quizAttendance.tenantId, r.quizAttendance.sessionId], to: [r.quizSession.tenantId, r.quizSession.id] }),
      student: r.one.studentProfile({ from: [r.quizAttendance.tenantId, r.quizAttendance.studentId], to: [r.studentProfile.tenantId, r.studentProfile.id] }),
    },
  }),
);

export const providerSettings = mysqlTable("provider_settings", {
  id: int("id").primaryKey(),
  defaultTrialDays: int("default_trial_days").default(31).notNull(),
});
