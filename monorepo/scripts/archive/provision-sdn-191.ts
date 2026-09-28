// Idempotent provisioning of RBAC test data for tenant SDN 191 in the dev DB.
//
// - Creates tenant `uptd-sdn-191-inpres-batunapara` (RBAC rollout, full feature
//   flags, completed onboarding), its school-admin/guru/siswa users with
//   better-auth credential accounts, guru/siswa custom roles + assignments +
//   permission sets, and the active school-admin authority.
// - Passwords come only from non-committed env vars (never literals, never
//   printed, never written to git).
// - Each step is lookup-then-insert (or update) so re-running is a no-op and no
//   row hits a duplicate-key error (ER_DUP_ENTRY).
// - Scoped strictly to SDN 191: no other tenant's rows are created or modified.
//
// Run: pnpm db:provision:sdn191   (from monorepo/)

import "dotenv/config";

import { type Connection, type RowDataPacket } from "mysql2/promise";
import mysql from "mysql2/promise";
import { hashPassword } from "better-auth/crypto";

import { TENANT_FEATURES } from "@/config/tenant-features";
import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
} from "@/lib/authorization/tenant-rbac-contract";
import { TENANT_AUTHORIZATION_RESOLVER_VERSION } from "@/lib/authorization/tenant-authorization";
import {
  GURU_ROLE_PERMISSIONS,
  SISWA_ROLE_PERMISSIONS,
  validateSdn191RolePermissionPlan,
} from "./sdn191-rbac-permissions";

// --- SDN 191 identity constants (dev data, not secrets) -------------------------

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
const DOMAIN = "uptd-sdn-191-inpres-batunapara";
const SCHOOL_NAME = "SDN 191 Inpres Batunapara";
const NPSN_DEFAULT = "68819101";

const SCHOOL_ADMIN_USER_ID = "sdn19100-0000-4000-8000-000000000010";
const GURU_USER_ID = "sdn19100-0000-4000-8000-000000000011";
const SISWA_USER_ID = "sdn19100-0000-4000-8000-000000000012";

const BINDING_ID = "sdn19100-0000-4000-8000-000000000021";
const APPLICATION_ID = "sdn19100-0000-4000-8000-000000000031";

const GURU_ROLE_ID = "sdn19100-0000-4000-8000-000000000041";
const SISWA_ROLE_ID = "sdn19100-0000-4000-8000-000000000042";
const GURU_ASSIGNMENT_ID = "sdn19100-0000-4000-8000-000000000051";
const SISWA_ASSIGNMENT_ID = "sdn19100-0000-4000-8000-000000000052";
const AUTHORITY_ID = "sdn19100-0000-4000-8000-000000000061";

const TENANT_FEATURE_SET: Record<string, boolean> = Object.fromEntries(
  TENANT_FEATURES.map((feature) => [feature.key, true]),
);
const EMAIL_SUFFIX = "@uptd-sdn-191-inpres-batunapara.simas.test";

type CredentialInfo = Readonly<{
  id: string;
  name: string;
  email: string;
  password: string;
  tenantRole: "school-admin" | "guru" | "siswa";
}>;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required env var ${name}`);
  return value;
}

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  return value?.trim() ? value : fallback;
}

function loadCredentials(): readonly CredentialInfo[] {
  return [
    {
      id: SCHOOL_ADMIN_USER_ID,
      name: "Admin SDN 191",
      email: envOrDefault("SDN191_SCHOOL_ADMIN_EMAIL", `school-admin${EMAIL_SUFFIX}`),
      password: requiredEnv("SDN191_SCHOOL_ADMIN_PASSWORD"),
      tenantRole: "school-admin",
    },
    {
      id: GURU_USER_ID,
      name: "Guru SDN 191",
      email: envOrDefault("SDN191_GURU_EMAIL", `guru${EMAIL_SUFFIX}`),
      password: requiredEnv("SDN191_GURU_PASSWORD"),
      tenantRole: "guru",
    },
    {
      id: SISWA_USER_ID,
      name: "Siswa SDN 191",
      email: envOrDefault("SDN191_SISWA_EMAIL", `siswa${EMAIL_SUFFIX}`),
      password: requiredEnv("SDN191_SISWA_PASSWORD"),
      tenantRole: "siswa",
    },
  ];
}

async function findOne(connection: Connection, sql: string, params: readonly unknown[]): Promise<RowDataPacket | undefined> {
  const [rows] = await connection.query<RowDataPacket[]>(sql, params as never);
  return rows[0];
}

async function run(connection: Connection, sql: string, params: readonly unknown[]): Promise<void> {
  await connection.execute(sql, params as never);
}

async function findProviderAdmin(connection: Connection): Promise<string> {
  const row = await findOne(connection, "SELECT user_id AS userId FROM provider_admin ORDER BY created_at LIMIT 1", []);
  if (!row) throw new Error("No provider_admin available to approve the SDN 191 application");
  return row.userId as string;
}

async function ensureIdentity(connection: Connection, cred: CredentialInfo): Promise<string> {
  const existing = await findOne(connection, "SELECT id FROM user WHERE email = ? LIMIT 1", [cred.email]);
  if (existing) return existing.id as string;
  const now = new Date();
  await run(
    connection,
    "INSERT INTO user (id, tenant_id, tenant_role, name, email, email_verified, created_at, updated_at) VALUES (?, NULL, NULL, ?, ?, true, ?, ?)",
    [cred.id, cred.name, cred.email, now, now],
  );
  return cred.id;
}

async function attachUserToTenant(connection: Connection, userId: string, tenantRole: string, tenantId: string): Promise<void> {
  await run(
    connection,
    "UPDATE user SET tenant_id = ?, tenant_role = ?, email_verified = true, updated_at = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = ?)",
    [tenantId, tenantRole, new Date(), userId, tenantId],
  );
}

async function ensureBinding(
  connection: Connection,
  npsn: string,
  ownerUserId: string,
): Promise<string> {
  const existing = await findOne(connection, "SELECT id FROM applicant_school_binding WHERE canonical_npsn = ? LIMIT 1", [npsn]);
  if (existing) return existing.id as string;
  await run(
    connection,
    "INSERT INTO applicant_school_binding (id, user_id, canonical_npsn, created_at) VALUES (?, ?, ?, ?)",
    [BINDING_ID, ownerUserId, npsn, new Date()],
  );
  return BINDING_ID;
}

async function ensureApplicationPending(
  connection: Connection,
  npsn: string,
  bindingId: string,
  ownerUserId: string,
): Promise<string> {
  const existing = await findOne(connection, "SELECT id FROM simas_application WHERE id = ? LIMIT 1", [APPLICATION_ID]);
  if (!existing) {
    const idempotencyKey = `${APPLICATION_ID}-${npsn}`;
    await run(
      connection,
      "INSERT INTO simas_application (id, school_name, npsn, education_level, address, contact_name, contact_position, contact_email, contact_whatsapp, status, submitted_at, owner_user_id, binding_id, attempt_number, idempotency_key, payload_hash) VALUES (?, ?, ?, 'SD', 'Batunapara', 'Kepala Sekolah', 'Kepala Sekolah', ?, '0812', 'pending', ?, ?, ?, 1, ?, REPEAT('e', 64))",
      [APPLICATION_ID, SCHOOL_NAME, npsn, `${ownerUserId}@sdn191.example`, new Date(), ownerUserId, bindingId, idempotencyKey],
    );
  }
  return APPLICATION_ID;
}

async function approveApplication(
  connection: Connection,
  tenantId: string,
  providerAdminUserId: string,
): Promise<void> {
  await run(
    connection,
    "UPDATE simas_application SET status = 'approved', decided_at = ?, decided_by_provider_admin_id = ?, approved_tenant_id = ?, rejection_reason = NULL WHERE id = ?",
    [new Date(), providerAdminUserId, tenantId, APPLICATION_ID],
  );
}

async function ensureTenant(
  connection: Connection,
  tenantId: string,
  applicationId: string,
  npsn: string,
): Promise<void> {
  const existing = await findOne(connection, "SELECT id FROM tenant WHERE domain = ? LIMIT 1", [DOMAIN]);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const settings = JSON.stringify({ features: TENANT_FEATURE_SET });
  if (existing) {
    await run(
      connection,
      "UPDATE tenant SET name = ?, npsn = ?, source_application_id = ?, approved_at = ?, operational_status = 'active', onboarding_completed_at = ?, trial_started_at = ?, trial_ends_at = ?, settings = ?, reconciliation_status = 'not_required', deletion_waiting_days = 30, updated_at = ? WHERE id = ?",
      [SCHOOL_NAME, npsn, applicationId, now, now, now, trialEndsAt, settings, now, existing.id],
    );
    return;
  }
  await run(
    connection,
    "INSERT INTO tenant (id, name, domain, npsn, source_application_id, approved_at, onboarding_completed_at, trial_started_at, trial_ends_at, settings, operational_status, reconciliation_status, deletion_waiting_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'not_required', 30, ?, ?)",
    [tenantId, SCHOOL_NAME, DOMAIN, npsn, applicationId, now, now, now, trialEndsAt, settings, now, now],
  );
}

async function ensureAccount(connection: Connection, userId: string, password: string): Promise<void> {
  const existing = await findOne(
    connection,
    "SELECT id FROM account WHERE provider_id = 'credential' AND user_id = ? LIMIT 1",
    [userId],
  );
  const now = new Date();
  const passwordHash = await hashPassword(password);
  if (existing) {
    await run(connection, "UPDATE account SET password = ?, updated_at = ? WHERE id = ?", [passwordHash, now, existing.id]);
    return;
  }
  // Convention: credential account_id = user.id (see tenant-account-lifecycle-data).
  await run(
    connection,
    "INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
    [userId, userId, userId, passwordHash, now, now],
  );
}

async function ensureTenantAccountSecurity(connection: Connection, tenantId: string, userId: string): Promise<void> {
  const existing = await findOne(
    connection,
    "SELECT lifecycle FROM tenant_account_security WHERE tenant_id = ? AND user_id = ? LIMIT 1",
    [tenantId, userId],
  );
  const now = new Date();
  if (existing) {
    if (existing.lifecycle !== "active") {
      await run(
        connection,
        "UPDATE tenant_account_security SET lifecycle = 'active', activated_at = ?, deactivated_at = NULL, updated_at = ? WHERE tenant_id = ? AND user_id = ?",
        [now, now, tenantId, userId],
      );
    }
    return;
  }
  await run(
    connection,
    "INSERT INTO tenant_account_security (tenant_id, user_id, lifecycle, version, assignment_version, activated_at, created_at, updated_at) VALUES (?, ?, 'active', 1, 1, ?, ?, ?)",
    [tenantId, userId, now, now, now],
  );
}

async function ensureRollout(connection: Connection, tenantId: string): Promise<void> {
  const existing = await findOne(connection, "SELECT tenant_id FROM tenant_rbac_rollout WHERE tenant_id = ? LIMIT 1", [tenantId]);
  if (existing) {
    await run(
      connection,
      "UPDATE tenant_rbac_rollout SET http_mode = 'rbac', worker_mode = 'rbac', epoch = 1, resolver_version = ?, registry_version = ?, operation_map_version = ?, overlay_hash = NULL, overlay_policy_version = NULL, overlay_denied_operation_ids = NULL, overlay_denied_permission_keys = NULL, overlay_deny_mutations = NULL, overlay_review_at = NULL, overlay_expires_at = NULL, updated_at = ? WHERE tenant_id = ?",
      [TENANT_AUTHORIZATION_RESOLVER_VERSION, PERMISSION_REGISTRY_VERSION, OPERATION_MAP_VERSION, new Date(), tenantId],
    );
    return;
  }
  await run(
    connection,
    "INSERT INTO tenant_rbac_rollout (tenant_id, http_mode, worker_mode, epoch, resolver_version, registry_version, operation_map_version, version, updated_at) VALUES (?, 'rbac', 'rbac', 1, ?, ?, ?, 1, ?)",
    [tenantId, TENANT_AUTHORIZATION_RESOLVER_VERSION, PERMISSION_REGISTRY_VERSION, OPERATION_MAP_VERSION, new Date()],
  );
}

async function ensureAuthority(connection: Connection, tenantId: string, userId: string): Promise<void> {
  const existing = await findOne(
    connection,
    "SELECT authority_state FROM school_admin_authority WHERE tenant_id = ? AND user_id = ? LIMIT 1",
    [tenantId, userId],
  );
  const now = new Date();
  if (existing) {
    if (existing.authority_state !== "active") {
      await run(
        connection,
        "UPDATE school_admin_authority SET authority_state = 'active', granted_at = ?, disabled_at = NULL, updated_at = ? WHERE tenant_id = ? AND user_id = ?",
        [now, now, tenantId, userId],
      );
    }
    return;
  }
  await run(
    connection,
    "INSERT INTO school_admin_authority (id, tenant_id, user_id, authority_state, version, granted_at, created_at, updated_at) VALUES (?, ?, ?, 'active', 1, ?, ?, ?)",
    [AUTHORITY_ID, tenantId, userId, now, now, now],
  );
}

async function ensureRole(
  connection: Connection,
  roleId: string,
  name: string,
  normalizedName: string,
  tenantId: string,
): Promise<string> {
  const existing = await findOne(connection, "SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = ? LIMIT 1", [tenantId, normalizedName]);
  const now = new Date();
  if (existing) {
    await run(
      connection,
      "UPDATE tenant_role SET name = ?, lifecycle = 'active', origin = 'scratch', template_key = NULL, template_version = NULL, copied_from_role_id = NULL, legacy_role = NULL, migration_run_id = NULL, migration_version = NULL, migration_verification = NULL, updated_at = ? WHERE id = ?",
      [name, now, existing.id],
    );
    return existing.id as string;
  }
  await run(
    connection,
    "INSERT INTO tenant_role (id, tenant_id, name, normalized_name, lifecycle, origin, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'scratch', 1, ?, ?)",
    [roleId, tenantId, name, normalizedName, now, now],
  );
  return roleId;
}

async function ensureRolePermissions(
  connection: Connection,
  roleId: string,
  permissionKeys: readonly string[],
  tenantId: string,
): Promise<void> {
  const now = new Date();
  for (const key of permissionKeys) {
    const exists = await findOne(
      connection,
      "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ? AND permission_key = ? LIMIT 1",
      [tenantId, roleId, key],
    );
    if (!exists) {
      await run(connection, "INSERT INTO tenant_role_permission (tenant_id, role_id, permission_key, created_at) VALUES (?, ?, ?, ?)", [tenantId, roleId, key, now]);
    }
  }
}

async function ensureAssignment(
  connection: Connection,
  assignmentId: string,
  tenantId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  const existing = await findOne(
    connection,
    "SELECT state FROM tenant_role_assignment WHERE tenant_id = ? AND user_id = ? AND role_id = ? LIMIT 1",
    [tenantId, userId, roleId],
  );
  const now = new Date();
  if (existing) {
    if (existing.state !== "active") {
      await run(connection, "UPDATE tenant_role_assignment SET state = 'active', suspended_at = NULL, updated_at = ? WHERE tenant_id = ? AND user_id = ? AND role_id = ?", [now, tenantId, userId, roleId]);
    }
    return;
  }
  await run(
    connection,
    "INSERT INTO tenant_role_assignment (id, tenant_id, user_id, role_id, state, version, assigned_at, updated_at) VALUES (?, ?, ?, ?, 'active', 1, ?, ?)",
    [assignmentId, tenantId, userId, roleId, now, now],
  );
}

async function countSdn191Records(connection: Connection): Promise<Record<string, number>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT " +
      "(SELECT COUNT(*) FROM tenant WHERE domain = ?) tenant, " +
      "(SELECT COUNT(*) FROM tenant_rbac_rollout WHERE tenant_id = ?) rollout, " +
      "(SELECT COUNT(*) FROM user WHERE tenant_id = ?) users, " +
      "(SELECT COUNT(*) FROM tenant_role WHERE tenant_id = ?) roles, " +
      "(SELECT COUNT(*) FROM tenant_role_assignment WHERE tenant_id = ?) assignments, " +
      "(SELECT COUNT(*) FROM tenant_role_permission WHERE tenant_id = ?) role_permissions, " +
      "(SELECT COUNT(*) FROM school_admin_authority WHERE tenant_id = ?) authority, " +
      "(SELECT COUNT(*) FROM account WHERE user_id IN (SELECT id FROM user WHERE tenant_id = ?)) accounts " +
      "FROM DUAL",
    [DOMAIN, TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID],
  );
  const row = rows[0];
  return {
    tenant: Number(row.tenant),
    rollout: Number(row.rollout),
    users: Number(row.users),
    roles: Number(row.roles),
    assignments: Number(row.assignments),
    role_permissions: Number(row.role_permissions),
    authority: Number(row.authority),
    accounts: Number(row.accounts),
  };
}

async function main(): Promise<void> {
  const planIssues = validateSdn191RolePermissionPlan();
  if (planIssues.length > 0) {
    console.error(JSON.stringify({ event: "sdn191_permission_plan_invalid", issues: planIssues }, null, 2));
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

  const credentials = loadCredentials();
  const npsn = envOrDefault("SDN191_NPSN", NPSN_DEFAULT);

  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    await connection.beginTransaction();

    const providerAdminUserId = await findProviderAdmin(connection);

    // Identities must exist before the binding/application reference them.
    const schoolAdminId = await ensureIdentity(connection, credentials[0]);
    const guruId = await ensureIdentity(connection, credentials[1]);
    const siswaId = await ensureIdentity(connection, credentials[2]);

    const bindingId = await ensureBinding(connection, npsn, schoolAdminId);
    // Create the application as pending first: tenant.source_application_id FK
    // must point to it before the tenant row is inserted.
    await ensureApplicationPending(connection, npsn, bindingId, schoolAdminId);

    await ensureTenant(connection, TENANT_ID, APPLICATION_ID, npsn);

    for (const cred of credentials) {
      const userId = cred.tenantRole === "school-admin" ? schoolAdminId : cred.tenantRole === "guru" ? guruId : siswaId;
      await attachUserToTenant(connection, userId, cred.tenantRole, TENANT_ID);
    }
    await approveApplication(connection, TENANT_ID, providerAdminUserId);

    for (const cred of credentials) {
      const userId = cred.tenantRole === "school-admin" ? schoolAdminId : cred.tenantRole === "guru" ? guruId : siswaId;
      await ensureAccount(connection, userId, cred.password);
      await ensureTenantAccountSecurity(connection, TENANT_ID, userId);
    }

    await ensureRollout(connection, TENANT_ID);
    await ensureAuthority(connection, TENANT_ID, schoolAdminId);

    const guruRoleId = await ensureRole(connection, GURU_ROLE_ID, "Guru", "guru", TENANT_ID);
    const siswaRoleId = await ensureRole(connection, SISWA_ROLE_ID, "Siswa", "siswa", TENANT_ID);
    await ensureRolePermissions(connection, guruRoleId, GURU_ROLE_PERMISSIONS, TENANT_ID);
    await ensureRolePermissions(connection, siswaRoleId, SISWA_ROLE_PERMISSIONS, TENANT_ID);
    await ensureAssignment(connection, GURU_ASSIGNMENT_ID, TENANT_ID, guruId, guruRoleId);
    await ensureAssignment(connection, SISWA_ASSIGNMENT_ID, TENANT_ID, siswaId, siswaRoleId);

    await connection.commit();
    const counts = await countSdn191Records(connection);
    console.log(JSON.stringify({ event: "sdn191_provisioned", tenantId: TENANT_ID, counts }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

void main();
