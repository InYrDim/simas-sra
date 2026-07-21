import mysql, { type Connection } from "mysql2/promise";

import { createPublicRegistration } from "@/lib/public-registration";
import { e2e } from "./fixtures";

const tenantIds = [e2e.alpha.tenantId, e2e.beta.tenantId];
const userIds = [e2e.alpha.adminId, e2e.alpha.staffId, e2e.beta.adminId, e2e.providerId];
const applicationIds = [e2e.alpha.applicationId, e2e.beta.applicationId];
const bindingIds = [e2e.alpha.bindingId, e2e.beta.bindingId];

async function fixturePasswordHash() {
  let passwordHash = "";
  const register = createPublicRegistration({
    createId: () => "unused-e2e-id",
    store: {
      async createIdentity(values) {
        passwordHash = values.passwordHash;
      },
    },
  });
  const result = await register({ name: "E2E", email: "hash@e2e.invalid", password: e2e.password });
  if (!result.ok || !passwordHash) throw new Error("Unable to hash the E2E fixture password.");
  return passwordHash;
}

async function cleanup(connection: Connection) {
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  try {
    await connection.query("DELETE FROM session WHERE user_id IN (?)", [userIds]);
    await connection.query("DELETE FROM account WHERE user_id IN (?)", [userIds]);
    await connection.query("DELETE FROM applicant WHERE user_id IN (?)", [userIds]);
    await connection.query("DELETE FROM academic_semester WHERE tenant_id IN (?)", [tenantIds]);
    await connection.query("DELETE FROM academic_year WHERE tenant_id IN (?)", [tenantIds]);
    await connection.query("DELETE FROM tenant WHERE id IN (?)", [tenantIds]);
    await connection.query("DELETE FROM simas_application WHERE id IN (?)", [applicationIds]);
    await connection.query("DELETE FROM applicant_school_binding WHERE id IN (?)", [bindingIds]);
    await connection.query("DELETE FROM provider_admin WHERE user_id = ?", [e2e.providerId]);
    await connection.query("DELETE FROM user WHERE id IN (?)", [userIds]);
  } finally {
    await connection.execute("SET FOREIGN_KEY_CHECKS=1");
  }
}

async function createIdentity(
  connection: Connection,
  identity: { id: string; accountId: string; name: string; email: string },
  passwordHash: string,
) {
  await connection.execute(
    "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,true,NOW(3),NOW(3))",
    [identity.id, identity.name, identity.email],
  );
  await connection.execute(
    "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,'credential',?,?,NOW(3),NOW(3))",
    [identity.accountId, identity.id, identity.id, passwordHash],
  );
}

async function createTenant(
  connection: Connection,
  fixture: typeof e2e.alpha | typeof e2e.beta,
  ownerId: string,
) {
  await connection.execute(
    "INSERT INTO applicant_school_binding (id,user_id,canonical_npsn,created_at) VALUES (?,?,?,NOW(3))",
    [fixture.bindingId, ownerId, fixture.npsn],
  );
  await connection.execute(
    "INSERT INTO simas_application (id,school_name,npsn,education_level,address,contact_name,contact_position,contact_email,contact_whatsapp,status,submitted_at,owner_user_id,binding_id,attempt_number,idempotency_key,payload_hash) VALUES (?,?,?,'SD','E2E address','E2E Admin','Administrator',?,'0800000000','pending',NOW(3),?,?,1,UUID(),REPEAT('e',64))",
    [fixture.applicationId, fixture.name, fixture.npsn, `contact-${fixture.domain}@e2e.invalid`, ownerId, fixture.bindingId],
  );
  await connection.execute(
    "INSERT INTO tenant (id,name,domain,npsn,source_application_id,approved_at,operational_status,settings,created_at,updated_at) VALUES (?,?,?,?,?,NOW(3),'active',?,NOW(3),NOW(3))",
    [fixture.tenantId, fixture.name, fixture.domain, fixture.npsn, fixture.applicationId, JSON.stringify({ features: { masterDataRead: true, masterDataWrite: true, masterDataImportDownload: true, masterDataImportValidation: true, masterDataImportExecution: true } })],
  );
  await connection.execute(
    "UPDATE simas_application SET status='approved',decided_at=NOW(3),decided_by_provider_admin_id=?,approved_tenant_id=? WHERE id=?",
    [e2e.providerId, fixture.tenantId, fixture.applicationId],
  );
  await connection.execute(
    "INSERT INTO academic_year (id,tenant_id,label,start_date,end_date,lifecycle,archived,version,created_at,updated_at) VALUES (?,?,?,'2030-07-01','2031-06-30','draft',false,1,NOW(3),NOW(3))",
    [fixture.academicYearId, fixture.tenantId, fixture.academicYearLabel],
  );
  await connection.execute(
    "INSERT INTO academic_semester (id,tenant_id,academic_year_id,kind,start_date,end_date,status) VALUES (UUID(),?,?,'odd','2030-07-01','2030-12-31','pending'),(UUID(),?,?,'even','2031-01-01','2031-06-30','pending')",
    [fixture.tenantId, fixture.academicYearId, fixture.tenantId, fixture.academicYearId],
  );
}

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Master Data E2E requires DATABASE_URL pointing to an isolated, migrated MySQL database.");
  }

  const connection = await mysql.createConnection(databaseUrl);
  await cleanup(connection);
  const passwordHash = await fixturePasswordHash();
  try {
    await connection.execute(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,'E2E Provider','master-provider@e2e.invalid',true,NOW(3),NOW(3))",
      [e2e.providerId],
    );
    await connection.execute("INSERT INTO provider_admin (user_id,created_at) VALUES (?,NOW(3))", [e2e.providerId]);

    await createIdentity(connection, { id: e2e.alpha.adminId, accountId: e2e.alpha.adminAccountId, name: "Alpha School Admin", email: e2e.alpha.adminEmail }, passwordHash);
    await createIdentity(connection, { id: e2e.alpha.staffId, accountId: e2e.alpha.staffAccountId, name: "Alpha Staff", email: e2e.alpha.staffEmail }, passwordHash);
    await createIdentity(connection, { id: e2e.beta.adminId, accountId: e2e.beta.adminAccountId, name: "Beta School Admin", email: e2e.beta.adminEmail }, passwordHash);

    await createTenant(connection, e2e.alpha, e2e.alpha.adminId);
    await createTenant(connection, e2e.beta, e2e.beta.adminId);
    await connection.execute("UPDATE user SET tenant_id=?,tenant_role='school-admin' WHERE id=?", [e2e.alpha.tenantId, e2e.alpha.adminId]);
    await connection.execute("UPDATE user SET tenant_id=?,tenant_role='staff' WHERE id=?", [e2e.alpha.tenantId, e2e.alpha.staffId]);
    await connection.execute("UPDATE user SET tenant_id=?,tenant_role='school-admin' WHERE id=?", [e2e.beta.tenantId, e2e.beta.adminId]);
  } catch (error) {
    await cleanup(connection);
    await connection.end();
    throw error;
  }
  await connection.end();

  return async () => {
    const teardownConnection = await mysql.createConnection(databaseUrl);
    try {
      await cleanup(teardownConnection);
    } finally {
      await teardownConnection.end();
    }
  };
}
