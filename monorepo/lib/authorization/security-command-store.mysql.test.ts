import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { tenantRole } from "@/db/schema";
import {
  createSecurityCommandService,
  requireOptimisticUpdate,
  securityAuditEvidence,
  type SecurityAuditEventDraft,
} from "@/lib/authorization/security-command";
import {
  createMySqlSecurityCommandStore,
  type MySqlSecurityCommandTransaction,
} from "@/lib/authorization/security-command-store";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

async function ensureSecuritySchema(connection: mysql.Connection): Promise<void> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `table_name` FROM `information_schema`.`tables` WHERE `table_schema`=DATABASE() AND `table_name`='security_command'",
  );
  if (rows.length) return;
  const migration = await readFile(
    new URL("../../drizzle/20260731083635_expand-tenant-rbac-security/migration.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }
}

function securityCommand(
  store: ReturnType<typeof createMySqlSecurityCommandStore>,
  input: Readonly<{
    userId: string;
    roleId: string;
    expectedVersion: number;
    name: string;
    idempotencyKey: string;
    events?: readonly SecurityAuditEventDraft[];
  }>,
) {
  const execute = createSecurityCommandService<MySqlSecurityCommandTransaction>({
    store,
    reportSecuritySignal: () => undefined,
  });
  return execute({
    principal: { kind: "authenticated-user", userId: input.userId },
    idempotencyKey: input.idempotencyKey,
    commandName: "tenant-role.rename",
    payload: { roleId: input.roleId, name: input.name },
    expectedVersions: [{
      resourceType: "tenant-role",
      resourceId: input.roleId,
      expectedVersion: input.expectedVersion,
    }],
    correlationId: randomUUID(),
    requestId: randomUUID(),
    authorizeAndMutate: async ({ actor, context, transaction }) => {
      assert.equal(actor.kind, "tenant-user");
      assert.equal(context.kind, "tenant");
      const updated = await transaction.database.update(tenantRole).set({
        name: input.name,
        normalizedName: input.name.toLocaleLowerCase("id-ID"),
        version: input.expectedVersion + 1,
        updatedAt: new Date(),
      }).where(and(
        eq(tenantRole.tenantId, context.contextId),
        eq(tenantRole.id, input.roleId),
        eq(tenantRole.version, input.expectedVersion),
      ));
      requireOptimisticUpdate(updated[0].rowCount === 1, `tenant-role:${input.roleId}`);
      return {
        result: { roleId: input.roleId, version: input.expectedVersion + 1, name: input.name },
        versionTransitions: [{
          resourceType: "tenant-role",
          resourceId: input.roleId,
          expectedVersion: input.expectedVersion,
          toVersion: input.expectedVersion + 1,
        }],
        auditEvents: input.events ?? [{
          purpose: "role-renamed",
          order: "parent",
          eventType: "tenant_role.renamed",
          targets: { roleId: input.roleId },
          evidence: securityAuditEvidence(),
          metadata: { fromVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 },
        }],
        outbox: [{
          purpose: "role-renamed",
          eventType: "security.tenant-role.changed",
          payload: { roleId: input.roleId },
        }],
      };
    },
  });
}

mysqlTest("real MySQL commits, replays, serializes hash heads, and rolls back every security-command step", async (t) => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = {
    tenant: randomUUID(),
    application: randomUUID(),
    binding: randomUUID(),
    actorA: randomUUID(),
    actorB: randomUUID(),
    roleA: randomUUID(),
    roleB: randomUUID(),
    roleFault: randomUUID(),
  };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));

  try {
    await ensureSecuritySchema(connection);
    await connection.execute(
      "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,'Admin A',?,true,NOW(3),NOW(3)),(?,'Admin B',?,true,NOW(3),NOW(3))",
      [ids.actorA, `${ids.actorA}@test.invalid`, ids.actorB, `${ids.actorB}@test.invalid`],
    );
    await connection.execute(
      "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3))",
      [ids.binding, ids.actorA, npsn],
    );
    await connection.execute(
      "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'Security Test',?,'SMA','Address','Contact','Admin',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))",
      [ids.application, npsn, `${ids.application}@test.invalid`, ids.actorA, ids.binding, randomUUID()],
    );
    await connection.execute(
      "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?,'Security Test',?,?,?,NOW(3),'active',NOW(3),NOW(3))",
      [ids.tenant, `security-${randomUUID()}`, npsn, ids.application],
    );
    await connection.execute(
      "UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id` IN (?,?)",
      [ids.tenant, ids.actorA, ids.actorB],
    );
    await connection.execute(
      "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Role A','role a','active','scratch',1,NOW(3),NOW(3)),(?,?,'Role B','role b','active','scratch',1,NOW(3),NOW(3)),(?,?,'Role Fault','role fault','active','scratch',1,NOW(3),NOW(3))",
      [ids.roleA, ids.tenant, ids.roleB, ids.tenant, ids.roleFault, ids.tenant],
    );

    const store = createMySqlSecurityCommandStore({ providerContextId: "simas-provider" });
    const stableKey = randomUUID();
    const first = await securityCommand(store, {
      userId: ids.actorA,
      roleId: ids.roleA,
      expectedVersion: 1,
      name: "Renamed A",
      idempotencyKey: stableKey,
      events: [
        {
          purpose: "child-impact",
          order: "child",
          eventType: "tenant_role.permissions_changed",
          targets: { roleId: ids.roleA },
          evidence: securityAuditEvidence(),
          metadata: { affectedCount: 0 },
        },
        {
          purpose: "parent-rename",
          order: "parent",
          eventType: "tenant_role.renamed",
          targets: { roleId: ids.roleA },
          evidence: securityAuditEvidence(),
          metadata: { fromVersion: 1, toVersion: 2 },
        },
      ],
    });
    const replay = await securityCommand(store, {
      userId: ids.actorA,
      roleId: ids.roleA,
      expectedVersion: 1,
      name: "Renamed A",
      idempotencyKey: stableKey,
    });
    assert.deepEqual(replay, { ...first, existing: true });

    const [roleRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `name`,`version` FROM `tenant_role` WHERE `tenant_id`=? AND `id`=?",
      [ids.tenant, ids.roleA],
    );
    assert.deepEqual({ name: roleRows[0]?.name, version: roleRows[0]?.version }, { name: "Renamed A", version: 2 });

    await Promise.all([
      securityCommand(store, {
        userId: ids.actorA,
        roleId: ids.roleA,
        expectedVersion: 2,
        name: "Concurrent A",
        idempotencyKey: randomUUID(),
      }),
      securityCommand(store, {
        userId: ids.actorB,
        roleId: ids.roleB,
        expectedVersion: 1,
        name: "Concurrent B",
        idempotencyKey: randomUUID(),
      }),
    ]);

    const [events] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `sequence`,`previous_hash`,`event_hash`,`event_type` FROM `security_audit_event` WHERE `tenant_id`=? ORDER BY `sequence`",
      [ids.tenant],
    );
    assert.deepEqual(events.map((event) => Number(event.sequence)), [1, 2, 3, 4]);
    assert.deepEqual(events.slice(0, 2).map((event) => event.event_type), [
      "tenant_role.renamed",
      "tenant_role.permissions_changed",
    ]);
    assert.equal(events[0]?.previous_hash, "0".repeat(64));
    for (let index = 1; index < events.length; index += 1) {
      assert.equal(events[index]?.previous_hash, events[index - 1]?.event_hash);
    }
    const [head] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `next_sequence`,`head_hash`,`version` FROM `security_audit_head` WHERE `security_context_kind`='tenant' AND `context_id`=?",
      [ids.tenant],
    );
    assert.deepEqual({
      nextSequence: Number(head[0]?.next_sequence),
      headHash: head[0]?.head_hash,
      version: head[0]?.version,
    }, {
      nextSequence: 5,
      headHash: events.at(-1)?.event_hash,
      version: 4,
    });

    for (const step of ["idempotency", "state", "audit", "head", "outbox"] as const) {
      await t.test(`rolls back after ${step}`, async () => {
        const [beforeCounts] = await connection.execute<mysql.RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM `security_command` WHERE `tenant_id`=?) AS commands,(SELECT COUNT(*) FROM `security_audit_event` WHERE `tenant_id`=?) AS events,(SELECT COUNT(*) FROM `security_outbox` WHERE `tenant_id`=?) AS outbox",
          [ids.tenant, ids.tenant, ids.tenant],
        );
        const faultStore = createMySqlSecurityCommandStore({
          providerContextId: "simas-provider",
          afterStep(completed) {
            if (completed === step) throw new Error(`Injected failure after ${step}`);
          },
        });
        await assert.rejects(securityCommand(faultStore, {
          userId: ids.actorA,
          roleId: ids.roleFault,
          expectedVersion: 1,
          name: `Fault ${step}`,
          idempotencyKey: randomUUID(),
        }), new RegExp(`Injected failure after ${step}`));
        const [afterCounts] = await connection.execute<mysql.RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM `security_command` WHERE `tenant_id`=?) AS commands,(SELECT COUNT(*) FROM `security_audit_event` WHERE `tenant_id`=?) AS events,(SELECT COUNT(*) FROM `security_outbox` WHERE `tenant_id`=?) AS outbox",
          [ids.tenant, ids.tenant, ids.tenant],
        );
        assert.deepEqual(afterCounts[0], beforeCounts[0]);
        const [faultRole] = await connection.execute<mysql.RowDataPacket[]>(
          "SELECT `name`,`version` FROM `tenant_role` WHERE `tenant_id`=? AND `id`=?",
          [ids.tenant, ids.roleFault],
        );
        assert.deepEqual({ name: faultRole[0]?.name, version: faultRole[0]?.version }, { name: "Role Fault", version: 1 });
      });
    }
  } finally {
    await connection.execute("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "security_audit_event",
      "security_outbox",
      "security_command",
      "security_audit_head",
      "tenant_role",
    ]) {
      await connection.query(`DELETE FROM \`${table}\` WHERE \`tenant_id\`=?`, [ids.tenant]).catch(() => undefined);
    }
    await connection.execute("UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id` IN (?,?)", [ids.actorA, ids.actorB]).catch(() => undefined);
    await connection.execute("DELETE FROM `tenant` WHERE `id`=?", [ids.tenant]).catch(() => undefined);
    await connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [ids.application]).catch(() => undefined);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [ids.binding]).catch(() => undefined);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?,?)", [ids.actorA, ids.actorB]).catch(() => undefined);
    await connection.execute("SET FOREIGN_KEY_CHECKS=1");
    await connection.end();
  }
});
