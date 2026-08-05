import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";
import { closeDatabasePool } from "@/db";
import { getProviderSchoolAdminRoster } from "@/lib/provider/provider-school-admin-roster";

const databaseUrl = process.env.DATABASE_URL;
after(() => closeDatabasePool());
const mysqlTest = databaseUrl ? test : test.skip;

mysqlTest("provider school admin roster queries", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  
  const tenantId = randomUUID();
  const providerUserId = randomUUID();
  const adminUserId = randomUUID();
  const authorityId = randomUUID();
  const bindingId = randomUUID();
  const applicationId = randomUUID();
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));

  try {
    await connection.execute(
    "INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, 'Provider', ?, false, NOW(3), NOW(3)), (?, 'Admin', ?, false, NOW(3), NOW(3))",
    [providerUserId, `${providerUserId}@example.test`, adminUserId, `${adminUserId}@example.test`],
  );
  await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW(3))", [providerUserId]);
    await connection.execute("INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3))", [bindingId, adminUserId, npsn]);
    await connection.execute("INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'School',?,'SMA','Address','Contact','Owner',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))", [applicationId, npsn, `${applicationId}@example.test`, adminUserId, bindingId, randomUUID()]);
    await connection.execute("INSERT INTO `tenant` (`id`, `npsn`, `domain`, `name`, `source_application_id`, `approved_at`, `operational_status`, `created_at`, `updated_at`) VALUES (?, ?, ?, 'School', ?, NOW(3), 'active', NOW(3), NOW(3))", [tenantId, npsn, `provider-school-admin-${tenantId}`, applicationId]);
    await connection.execute("UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?", [providerUserId, tenantId, applicationId]);
  await connection.execute("UPDATE `user` SET `tenant_id` = ? WHERE `id` = ?", [tenantId, adminUserId]);
  
    const authorityConnection = await mysql.createConnection(databaseUrl!);
    try {
      await authorityConnection.execute(
        "INSERT INTO `school_admin_authority` (`id`, `tenant_id`, `user_id`, `authority_state`, `granted_at`, `created_at`, `updated_at`, `version`) VALUES (?, ?, ?, 'active', NOW(3), NOW(3), NOW(3), 1)",
        [authorityId, tenantId, adminUserId],
      );
    } finally {
      await authorityConnection.end();
    }
  
    const roster = await getProviderSchoolAdminRoster(tenantId);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].userId, adminUserId);
    assert.equal(roster[0].state, "active");
  } finally {
    await connection.end().catch(() => undefined);
    const cleanup = await mysql.createConnection(databaseUrl!);
    try {
      await cleanup.execute("DELETE FROM `school_admin_authority` WHERE `id` = ?", [authorityId]);
      await cleanup.execute("UPDATE `user` SET `tenant_id` = NULL WHERE `id` = ?", [adminUserId]);
      await cleanup.execute("UPDATE `simas_application` SET `status`='pending',`decided_at`=NULL,`decided_by_provider_admin_id`=NULL,`approved_tenant_id`=NULL WHERE `id`=?", [applicationId]);
      await cleanup.execute("DELETE FROM `tenant` WHERE `id` = ?", [tenantId]);
      await cleanup.execute("DELETE FROM `simas_application` WHERE `id` = ?", [applicationId]);
      await cleanup.execute("DELETE FROM `applicant_school_binding` WHERE `id` = ?", [bindingId]);
      await cleanup.execute("DELETE FROM `provider_admin` WHERE `user_id` = ?", [providerUserId]);
      await cleanup.execute("DELETE FROM `user` WHERE `id` IN (?, ?)", [providerUserId, adminUserId]);
    } finally {
      await cleanup.end();
    }
  }
});
