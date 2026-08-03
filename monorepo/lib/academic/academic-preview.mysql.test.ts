import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;

mysqlTest("MySQL preview persistence binds Tenant ownership and claims one commit atomically", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = { tenant: randomUUID(), actor: randomUUID(), provider: randomUUID(), binding: randomUUID(), application: randomUUID(), preview: randomUUID() };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  try {
    await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Actor', ?, false,NOW(3),NOW(3)),(?, 'Provider', ?, false,NOW(3),NOW(3))", [ids.actor, `${ids.actor}@test.invalid`, ids.provider, `${ids.provider}@test.invalid`]);
    await connection.execute("INSERT INTO provider_admin (user_id,created_at) VALUES (?,NOW(3))", [ids.provider]);
    await connection.execute("INSERT INTO applicant_school_binding (id,user_id,canonical_npsn,created_at) VALUES (?,?,?,NOW(3))", [ids.binding, ids.actor, npsn]);
    await connection.execute("INSERT INTO simas_application (id,school_name,npsn,education_level,address,contact_name,contact_position,contact_email,contact_whatsapp,status,submitted_at,owner_user_id,binding_id,attempt_number,idempotency_key,payload_hash) VALUES (?,'Preview Test',?,'SMA','A','K','O',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))", [ids.application, npsn, `${ids.application}@test.invalid`, ids.actor, ids.binding, randomUUID()]);
    await connection.execute("INSERT INTO tenant (id,name,domain,npsn,source_application_id,approved_at,operational_status,created_at,updated_at) VALUES (?,'Preview Test',?,?,?,NOW(3),'active',NOW(3),NOW(3))", [ids.tenant, `preview-${randomUUID()}`, npsn, ids.application]);
    await connection.execute("UPDATE simas_application SET status='approved',decided_at=NOW(3),decided_by_provider_admin_id=?,approved_tenant_id=? WHERE id=?", [ids.provider, ids.tenant, ids.application]);
    await connection.execute("UPDATE user SET tenant_id=?,tenant_role='school-admin' WHERE id=?", [ids.tenant, ids.actor]);
    const tokenDigest = "a".repeat(64);
    await connection.execute("INSERT INTO academic_operation_preview (id,tenant_id,actor_user_id,operation_id,token_digest,intent_digest,normalized_intent,state,expires_at,version) VALUES (?,?,?,?,?,?,?,'pending',DATE_ADD(NOW(3),INTERVAL 1 MINUTE),1)", [ids.preview, ids.tenant, ids.actor, "class-groups.memberships.assign", tokenDigest, "b".repeat(64), JSON.stringify({ studentIds: ["student-a"] })]);
    const competing = await mysql.createConnection(databaseUrl!);
    const claims = await Promise.all([
      connection.execute("UPDATE academic_operation_preview SET idempotency_key='commit-a',version=2 WHERE id=? AND version=1 AND idempotency_key IS NULL", [ids.preview]),
      competing.execute("UPDATE academic_operation_preview SET idempotency_key='commit-b',version=2 WHERE id=? AND version=1 AND idempotency_key IS NULL", [ids.preview]),
    ]);
    await competing.end();
    assert.equal(claims.filter(([result]) => !Array.isArray(result) && result.affectedRows === 1).length, 1);
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT tenant_id,actor_user_id,version FROM academic_operation_preview WHERE token_digest=?", [tokenDigest]);
    assert.deepEqual({ tenantId: rows[0]?.tenant_id, actorUserId: rows[0]?.actor_user_id, version: rows[0]?.version }, { tenantId: ids.tenant, actorUserId: ids.actor, version: 2 });
  } finally {
    await connection.execute("DELETE FROM academic_operation_preview WHERE tenant_id=?", [ids.tenant]);
    await connection.execute("UPDATE user SET tenant_id=NULL,tenant_role=NULL WHERE id=?", [ids.actor]);
    await connection.execute("DELETE FROM tenant WHERE id=?", [ids.tenant]);
    await connection.execute("DELETE FROM simas_application WHERE id=?", [ids.application]);
    await connection.execute("DELETE FROM applicant_school_binding WHERE id=?", [ids.binding]);
    await connection.execute("DELETE FROM provider_admin WHERE user_id=?", [ids.provider]);
    await connection.execute("DELETE FROM user WHERE id IN (?,?)", [ids.actor, ids.provider]);
    await connection.end();
  }
});
