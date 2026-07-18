import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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
    npsn: varchar("npsn", { length: 20 }).unique(),
    sourceApplicationId: varchar("source_application_id", { length: 36 })
      .unique()
      .references((): AnyMySqlColumn => simasApplication.id),
    approvedAt: timestamp("approved_at", { fsp: 3 }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { fsp: 3 }),
    trialStartedAt: timestamp("trial_started_at", { fsp: 3 }),
    trialEndsAt: timestamp("trial_ends_at", { fsp: 3 }),
    settings: json("settings"),
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
  },
  (table) => [
    unique("simas_application_approved_tenant_id_unique").on(
      table.approvedTenantId,
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

export const schoolAdminActivation = mysqlTable(
  "school_admin_activation",
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
      "school_admin_activation_password_state_check",
      sql`((${table.passwordChangeRequired} = true AND ${table.passwordChangedAt} IS NULL) OR (${table.passwordChangeRequired} = false AND ${table.passwordChangedAt} IS NOT NULL))`,
    ),
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
    simasApplication,
    schoolAdminActivation,
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
      schoolAdminActivations: r.many.schoolAdminActivation(),
    },
    user: {
      tenant: r.one.tenant({ from: r.user.tenantId, to: r.tenant.id }),
      providerAdmin: r.one.providerAdmin({
        from: r.user.id,
        to: r.providerAdmin.userId,
      }),
      schoolAdminActivation: r.one.schoolAdminActivation({
        from: r.user.id,
        to: r.schoolAdminActivation.userId,
      }),
      sessions: r.many.session(),
      accounts: r.many.account(),
    },
    providerAdmin: {
      user: r.one.user({ from: r.providerAdmin.userId, to: r.user.id }),
      decidedApplications: r.many.simasApplication(),
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
    },
    schoolAdminActivation: {
      user: r.one.user({
        from: r.schoolAdminActivation.userId,
        to: r.user.id,
      }),
      tenant: r.one.tenant({
        from: r.schoolAdminActivation.tenantId,
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
