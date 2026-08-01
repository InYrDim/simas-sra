import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";
import { closeDatabasePool } from "@/db";
import { getProviderSchoolAdminRoster } from "@/lib/provider/provider-school-admin-roster";

const databaseUrl = process.env.DATABASE_URL;
after(() => closeDatabasePool());
const mysqlTest = databaseUrl ? test : test.skip;

mysqlTest("provider school admin roster queries", async (t) => {
  const connection = await mysql.createConnection(databaseUrl!);
  
  const tenantId = randomUUID();
  const providerUserId = randomUUID();
  const adminUserId = randomUUID();
  const authorityId = randomUUID();
  
  await connection.execute(
    "INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, 'Provider', ?, false, NOW(3), NOW(3)), (?, 'Admin', ?, false, NOW(3), NOW(3))",
    [providerUserId, `${providerUserId}@example.test`, adminUserId, `${adminUserId}@example.test`],
  );
  await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW(3))", [providerUserId]);
  await connection.execute("INSERT INTO `tenant` (`id`, `npsn`, `domain`, `name`, `status`, `created_at`, `updated_at`) VALUES (?, ?, ?, 'School', 'active', NOW(3), NOW(3))", [tenantId, "12345678", `${tenantId}.simas.test`]);
  await connection.execute("UPDATE `user` SET `tenant_id` = ? WHERE `id` = ?", [tenantId, adminUserId]);
  
  await connection.execute(
    "INSERT INTO `school_admin_authority` (`id`, `tenant_id`, `user_id`, `authority_state`, `created_at`, `updated_at`, `version`) VALUES (?, ?, ?, 'active', NOW(3), NOW(3), 1)",
    [authorityId, tenantId, adminUserId]
  );
  
  await t.test("fetches roster", async () => {
    const roster = await getProviderSchoolAdminRoster(tenantId);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].userId, adminUserId);
    assert.equal(roster[0].state, "active");
  });

  await connection.end();
});
