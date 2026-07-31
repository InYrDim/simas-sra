import "dotenv/config";

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function main() {
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    const [tenants] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id FROM tenant WHERE domain LIKE 'backfill-%'",
    );
    for (const row of tenants) {
      const tenantId = row.id;
      await connection.query("DELETE FROM security_audit_event WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM security_outbox WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM security_command WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM security_audit_head WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM security_reconciliation_finding WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM tenant_role_assignment WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM tenant_role_permission WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM tenant_role WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM session WHERE user_id IN (SELECT id FROM `user` WHERE tenant_id=?)", [tenantId]);
      await connection.query("UPDATE `user` SET tenant_id=NULL, tenant_role=NULL WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM `user` WHERE tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM simas_application WHERE approved_tenant_id=?", [tenantId]);
      await connection.query("DELETE FROM tenant WHERE id=?", [tenantId]);
    }
    await connection.query("DELETE FROM security_reconciliation_finding WHERE migration_key='legacy-non-admin-backfill-v1'");
    await connection.query("DELETE FROM security_migration_checkpoint WHERE migration_key='legacy-non-admin-backfill-v1'");
    await connection.query("DELETE FROM security_command WHERE security_context_kind='provider' AND context_id='simas-provider'");
    await connection.query("DELETE FROM security_audit_event WHERE security_context_kind='provider' AND context_id='simas-provider'");
    await connection.query("DELETE FROM security_outbox WHERE security_context_kind='provider' AND context_id='simas-provider'");
    await connection.query("DELETE FROM security_audit_head WHERE security_context_kind='provider' AND context_id='simas-provider'");
    const [orphans] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id FROM `user` WHERE email LIKE '%@test.invalid'",
    );
    for (const row of orphans) {
      await connection.query("DELETE FROM provider_admin WHERE user_id=?", [row.id]);
      await connection.query("DELETE FROM session WHERE user_id=?", [row.id]);
      await connection.query("DELETE FROM `user` WHERE id=?", [row.id]);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    console.info({ event: "legacy_backfill_test_cleanup_done" });
  } finally {
    await connection.end();
  }
}

void main();
