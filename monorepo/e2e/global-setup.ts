import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { createPublicRegistration } from "@/lib/admissions/public-registration";
import { e2e } from "./fixtures";

/**
 * E2E global setup against the Postgres DATABASE_URL (MySQL cleanup: the old
 * mysql2 seeding is ported 1:1 — NOW(3) → now(), UUID() → gen_random_uuid(),
 * JSON_ARRAY()/JSON_OBJECT() → '[]'::jsonb / '{}'::jsonb, and the MySQL-only
 * FK-checks toggle is dropped in favour of explicit delete ordering).
 */

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

async function cleanup(client: PoolClient) {
  // Children first, then parents (MySQL's FOREIGN_KEY_CHECKS toggle has no
  // Postgres equivalent, so the order matters here).
  await client.query("DELETE FROM tenant_role_assignment WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM tenant_rbac_rollout WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM school_admin_authority WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM tenant_role_permission WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM tenant_role WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM tenant_account_security WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM session WHERE user_id = ANY($1::text[])", [userIds]);
  await client.query("DELETE FROM account WHERE user_id = ANY($1::text[])", [userIds]);
  await client.query("DELETE FROM applicant WHERE user_id = ANY($1::text[])", [userIds]);
  await client.query("DELETE FROM ppdb_submission_document WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM ppdb_submission WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM ppdb_session WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM academic_semester WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM academic_year WHERE tenant_id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM tenant WHERE id = ANY($1::text[])", [tenantIds]);
  await client.query("DELETE FROM simas_application WHERE id = ANY($1::text[])", [applicationIds]);
  await client.query("DELETE FROM applicant_school_binding WHERE id = ANY($1::text[])", [bindingIds]);
  await client.query("DELETE FROM provider_admin WHERE user_id = $1", [e2e.providerId]);
  await client.query("DELETE FROM \"user\" WHERE id = ANY($1::text[])", [userIds]);
}

async function createIdentity(client: PoolClient, identity: { id: string; accountId: string; name: string; email: string }, passwordHash: string) {
  await client.query(
    'INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,$2,$3,true,now(),now())',
    [identity.id, identity.name, identity.email],
  );
  await client.query(
    "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ($1,$2,'credential',$3,$4,now(),now())",
    [identity.accountId, identity.id, identity.id, passwordHash],
  );
}

async function createTenant(client: PoolClient, fixture: typeof e2e.alpha | typeof e2e.beta, ownerId: string) {
  await client.query(
    "INSERT INTO applicant_school_binding (id,user_id,canonical_npsn,created_at) VALUES ($1,$2,$3,now())",
    [fixture.bindingId, ownerId, fixture.npsn],
  );
  await client.query(
    "INSERT INTO simas_application (id,school_name,npsn,education_level,address,contact_name,contact_position,contact_email,contact_whatsapp,status,submitted_at,owner_user_id,binding_id,attempt_number,idempotency_key,payload_hash) VALUES ($1,$2,$3,'SD','E2E address','E2E Admin','Administrator',$4,'0800000000','pending',now(),$5,$6,1,gen_random_uuid(),repeat('e',64))",
    [fixture.applicationId, fixture.name, fixture.npsn, `contact-${fixture.domain}@e2e.invalid`, ownerId, fixture.bindingId],
  );
  await client.query(
    "INSERT INTO tenant (id,name,domain,npsn,source_application_id,approved_at,operational_status,settings,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,now(),'active',$6,now(),now())",
    [
      fixture.tenantId,
      fixture.name,
      fixture.domain,
      fixture.npsn,
      fixture.applicationId,
      JSON.stringify({ features: { masterData: true, masterDataRead: true, masterDataWrite: true, masterDataImportDownload: true, masterDataImportValidation: true, masterDataImportExecution: true } }),
    ],
  );
  await client.query(
    "UPDATE simas_application SET status='approved',decided_at=now(),decided_by_provider_admin_id=$1,approved_tenant_id=$2 WHERE id=$3",
    [e2e.providerId, fixture.tenantId, fixture.applicationId],
  );
  await client.query(
    "INSERT INTO academic_year (id,tenant_id,label,start_date,end_date,lifecycle,archived,version,created_at,updated_at) VALUES ($1,$2,$3,'2030-07-01','2031-06-30','draft',false,1,now(),now())",
    [fixture.academicYearId, fixture.tenantId, fixture.academicYearLabel],
  );
  await client.query(
    "INSERT INTO academic_semester (id,tenant_id,academic_year_id,kind,start_date,end_date,status) VALUES (gen_random_uuid(),$1,$2,'odd','2030-07-01','2030-12-31','pending'),(gen_random_uuid(),$1,$2,'even','2031-01-01','2031-06-30','pending')",
    [fixture.tenantId, fixture.academicYearId],
  );
}

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Master Data E2E requires DATABASE_URL pointing to an isolated, migrated Postgres database.");
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  const passwordHash = await fixturePasswordHash();
  try {
    await cleanup(client);

    await client.query(
      'INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,\'E2E Provider\',\'master-provider@e2e.invalid\',true,now(),now())',
      [e2e.providerId],
    );
    await client.query("INSERT INTO provider_admin (user_id,created_at) VALUES ($1,now())", [e2e.providerId]);

    await createIdentity(client, { id: e2e.alpha.adminId, accountId: e2e.alpha.adminAccountId, name: "Alpha School Admin", email: e2e.alpha.adminEmail }, passwordHash);
    await createIdentity(client, { id: e2e.alpha.staffId, accountId: e2e.alpha.staffAccountId, name: "Alpha Staff", email: e2e.alpha.staffEmail }, passwordHash);
    await createIdentity(client, { id: e2e.beta.adminId, accountId: e2e.beta.adminAccountId, name: "Beta School Admin", email: e2e.beta.adminEmail }, passwordHash);

    await createTenant(client, e2e.alpha, e2e.alpha.adminId);
    await createTenant(client, e2e.beta, e2e.beta.adminId);
    await client.query(
      "INSERT INTO tenant_rbac_rollout (tenant_id,http_mode,worker_mode,epoch,resolver_version,registry_version,operation_map_version,version,updated_at) VALUES ($1,'rbac','rbac',1,'tenant-authorization@2','tenant-permissions@2','tenant-operations@5',1,now()),($2,'rbac','rbac',1,'tenant-authorization@2','tenant-permissions@2','tenant-operations@5',1,now())",
      [e2e.alpha.tenantId, e2e.beta.tenantId],
    );
    await client.query(
      "UPDATE tenant SET settings = jsonb_set(settings::jsonb,'{features,ppdb}','true') || jsonb_build_object('features', jsonb_set(jsonb_set((settings::jsonb->'features'),'{ppdbRead}','true'),'{ppdbWrite}','true')) WHERE id = ANY($1::text[])",
      [tenantIds],
    );
    await client.query(
      "INSERT INTO ppdb_session (id,tenant_id,academic_year_id,end_date,status,fields,draft_fields,version,published_at,created_at,updated_at) VALUES ($1,$2,$3,'2031-06-30','published','[]'::jsonb,'[]'::jsonb,1,now(),now(),now())",
      [e2e.alpha.ppdbSessionId, e2e.alpha.tenantId, e2e.alpha.academicYearId],
    );
    await client.query(
      "INSERT INTO ppdb_submission (id,tenant_id,session_id,registration_code,student_name,nisn,status,score,form_data,form_fields,version,submitted_at,updated_at) VALUES ($1,$2,$3,'PPDB-E2E-001','Peserta PPDB dengan Nama Panjang','0012345678','pending',85,'{}'::jsonb,'[]'::jsonb,1,now(),now())",
      [e2e.alpha.ppdbSubmissionId, e2e.alpha.tenantId, e2e.alpha.ppdbSessionId],
    );
    await client.query('UPDATE "user" SET tenant_id=$1,tenant_role=\'school-admin\' WHERE id=$2', [e2e.alpha.tenantId, e2e.alpha.adminId]);
    await client.query('UPDATE "user" SET tenant_id=$1,tenant_role=\'staff\' WHERE id=$2', [e2e.alpha.tenantId, e2e.alpha.staffId]);
    await client.query('UPDATE "user" SET tenant_id=$1,tenant_role=\'school-admin\' WHERE id=$2', [e2e.beta.tenantId, e2e.beta.adminId]);
    await client.query(
      "INSERT INTO tenant_account_security (tenant_id,user_id,lifecycle,version,assignment_version,activated_at,created_at,updated_at) VALUES ($1,$2,'active',1,1,now(),now(),now())",
      [e2e.alpha.tenantId, e2e.alpha.staffId],
    );
    await client.query(
      "INSERT INTO school_admin_authority (id,tenant_id,user_id,authority_state,version,granted_at,created_at,updated_at) VALUES ('e2e00000-0000-4000-8000-000000000101',$1,$2,'active',1,now(),now(),now()),('e2e00000-0000-4000-8000-000000000102',$3,$4,'active',1,now(),now(),now())",
      [e2e.alpha.tenantId, e2e.alpha.adminId, e2e.beta.tenantId, e2e.beta.adminId],
    );
    await client.query(
      "INSERT INTO tenant_role (id,tenant_id,name,normalized_name,lifecycle,origin,version,created_at,updated_at) VALUES ('e2e00000-0000-4000-8000-000000000081',$1,'Staf Operasional','staf operasional','active','scratch',1,now(),now()),('e2e00000-0000-4000-8000-000000000082',$1,'Pembaca Dashboard','pembaca dashboard','active','scratch',1,now(),now()),('e2e00000-0000-4000-8000-000000000083',$1,'Admin Akademik','admin akademik','active','scratch',1,now(),now()),('e2e00000-0000-4000-8000-000000000084',$2,'Admin Akademik Beta','admin akademik beta','active','scratch',1,now(),now())",
      [e2e.alpha.tenantId, e2e.beta.tenantId],
    );
    const academicPermissions = [
      "academic-years.years.view", "academic-years.years.create", "academic-years.years.manage-lifecycle", "academic-years.years.archive", "academic-years.years.restore",
      "subjects.subjects.view", "subjects.subjects.create", "subjects.subjects.update", "subjects.subjects.archive", "subjects.subjects.restore",
      "class-groups.groups.view", "class-groups.groups.create", "class-groups.groups.update", "class-groups.groups.manage-lifecycle", "class-groups.groups.archive", "class-groups.groups.restore",
      "class-groups.memberships.assign", "class-groups.memberships.transfer", "class-groups.homerooms.assign", "people.people.view", "students.students.view", "teachers.teachers.view", "ppdb.submissions.view", "ppdb.submissions.view-sensitive", "ppdb.submissions.export",
    ];
    for (const permissionKey of academicPermissions) {
      await client.query(
        "INSERT INTO tenant_role_permission (tenant_id,role_id,permission_key,created_at) VALUES ($1, 'e2e00000-0000-4000-8000-000000000083', $2, now()), ($3, 'e2e00000-0000-4000-8000-000000000084', $2, now())",
        [e2e.alpha.tenantId, permissionKey, e2e.beta.tenantId],
      );
    }
    await client.query(
      "INSERT INTO tenant_role_permission (tenant_id,role_id,permission_key,created_at) VALUES ($1,'e2e00000-0000-4000-8000-000000000081','tenant.dashboard.view',now()),($1,'e2e00000-0000-4000-8000-000000000082','tenant.dashboard.view',now())",
      [e2e.alpha.tenantId],
    );

    await client.query(
      "INSERT INTO tenant_role_assignment (id,tenant_id,user_id,role_id,state,version,assigned_at,updated_at) VALUES ('e2e00000-0000-4000-8000-000000000091',$1,$2,'e2e00000-0000-4000-8000-000000000081','active',1,now(),now()),('e2e00000-0000-4000-8000-000000000092',$1,$2,'e2e00000-0000-4000-8000-000000000082','active',1,now(),now()),('e2e00000-0000-4000-8000-000000000093',$1,$3,'e2e00000-0000-4000-8000-000000000083','active',1,now(),now()),('e2e00000-0000-4000-8000-000000000094',$4,$5,'e2e00000-0000-4000-8000-000000000084','active',1,now(),now())",
      [e2e.alpha.tenantId, e2e.alpha.staffId, e2e.alpha.adminId, e2e.beta.tenantId, e2e.beta.adminId],
    );
  } catch (error) {
    await cleanup(client);
    client.release();
    await pool.end();
    throw error;
  }
  client.release();
  await pool.end();

  return async () => {
    const teardownPool = new Pool({ connectionString: databaseUrl, max: 2 });
    const teardownClient = await teardownPool.connect();
    try {
      await cleanup(teardownClient);
    } finally {
      teardownClient.release();
      await teardownPool.end();
    }
  };
}

// Keep the crypto import used (parity with the old fixture style).
void randomUUID;
