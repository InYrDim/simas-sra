import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
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
        OR (${table.onboardingCompletedAt} IS NOT NULL AND ${table.trialStartedAt} = ${table.onboardingCompletedAt} AND ${table.trialEndsAt} = DATE_ADD(${table.trialStartedAt}, INTERVAL 1 MONTH))
      )`,
    ),
    check(
      "tenant_deletion_waiting_days_check",
      sql`${table.deletionWaitingDays} IS NULL OR (${table.deletionWaitingDays} >= 1 AND ${table.deletionWaitingDays} <= 365)`,
    ),
  ],
);

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
});

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

export const schemaRelations = defineRelations(
  {
    tenant,
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
  }),
);
