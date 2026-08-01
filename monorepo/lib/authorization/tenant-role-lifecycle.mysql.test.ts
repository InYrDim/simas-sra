import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";
import { closeDatabasePool } from "@/db";

import { createTenantRoleLifecycleDataService } from "@/lib/authorization/tenant-role-lifecycle-data";
import { SecurityCommandError } from "@/lib/authorization/security-command";
import { TENANT_ROLE_EVENT_TYPES } from "@/lib/authorization/tenant-role-lifecycle";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

const service = createTenantRoleLifecycleDataService();

function principal(userId: string): { kind: "authenticated-user"; userId: string } {
  return { kind: "authenticated-user", userId };
}

mysqlTest("Tenant Role Lifecycle end-to-end", async (t) => {
  if (!databaseUrl) return;

  const connection = await mysql.createConnection(databaseUrl);
  t.after(async () => await connection.end());

  const tenantId = randomUUID();
  const providerAdminId = randomUUID();
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  await connection.execute("INSERT INTO `tenant` (`id`, `name`, `domain`, `npsn`, `source_application_id`, `approved_at`, `operational_status`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, NOW(), 'active', NOW(), NOW())", [tenantId, "Test Tenant", `test-domain-${Date.now()}`, `npsn-${Date.now()}`, randomUUID()]);
  await connection.execute("INSERT INTO `user` (`id`, `tenant_id`, `name`, `email`) VALUES (?, ?, ?, ?)", [providerAdminId, tenantId, "Admin", `admin_${Date.now()}@test.com`]);
  await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW())", [providerAdminId]);
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");

  let roleId: string;

  await t.test("createRole", async () => {
    const res = await service.createRole({
      principal: principal(providerAdminId),
      tenantId,
      name: "Test Role",
      origin: "scratch",
      permissions: ["tenant.users.view"],
      reason: "Initial role",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    
    assert.equal(res.status, "role-created");
    assert.equal(res.lifecycle, "draft");
    roleId = res.roleId;

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `name`, `normalized_name`, `lifecycle`, `version` FROM `tenant_role` WHERE `id`=?", [roleId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Test Role");
    assert.equal(rows[0].normalized_name, "test role");
    assert.equal(rows[0].lifecycle, "draft");
    assert.equal(rows[0].version, 1);
  });

  await t.test("renameRole", async () => {
    const res = await service.renameRole({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 1,
      newName: "Renamed Role",
      reason: "Update name",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    assert.equal(res.status, "role-renamed");

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `name`, `normalized_name`, `version` FROM `tenant_role` WHERE `id`=?", [roleId]);
    assert.equal(rows[0].name, "Renamed Role");
    assert.equal(rows[0].normalized_name, "renamed role");
    assert.equal(rows[0].version, 2);
  });

  await t.test("editPermissions", async () => {
    const res = await service.editPermissions({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 2,
      addedPermissions: ["subjects.subjects.view"],
      removedPermissions: ["tenant.users.view"],
      reason: "Update perms",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    assert.equal(res.status, "permissions-edited");

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `permission_key` FROM `tenant_role_permission` WHERE `role_id`=?", [roleId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].permission_key, "subjects.subjects.view");
  });

  await t.test("activateRole", async () => {
    const res = await service.activateRole({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 3,
      reason: "Ready for use",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    
    assert.equal(res.status, "role-activated");

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `lifecycle`, `version` FROM `tenant_role` WHERE `id`=?", [roleId]);
    assert.equal(rows[0].lifecycle, "active");
    assert.equal(rows[0].version, 4);
  });

  await t.test("draftRole with assignments should fail", async () => {
    // Add assignment
    const userId = randomUUID();
    await connection.execute("INSERT INTO `user` (`id`, `tenant_id`, `name`, `email`) VALUES (?, ?, ?, ?)", [userId, tenantId, "User", `user_${Date.now()}@test.com`]);
    await connection.execute("INSERT INTO `tenant_role_assignment` (`id`, `tenant_id`, `user_id`, `role_id`, `state`, `assigned_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, NOW(), NOW())", [randomUUID(), tenantId, userId, roleId, "active"]);

    await assert.rejects(
      service.draftRole({
        principal: principal(providerAdminId),
        tenantId,
        roleId,
        expectedVersion: 4,
        reason: "Back to draft",
        idempotencyKey: randomUUID(),
        correlationId: randomUUID(),
      }),
      (err: any) => err.code === "invalid-command"
    );

    // remove the assignment
    await connection.execute("DELETE FROM `tenant_role_assignment` WHERE `role_id`=?", [roleId]);

    const res = await service.draftRole({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 4,
      reason: "Back to draft",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(res.status, "role-drafted");
  });

  await t.test("archiveRole", async () => {
    // Role is now draft, so first activate it or we can archive from draft?
    // Wait, the state machine in tenant-role-lifecycle requires role to be active for drafting, but what about archiving? 
    // archiveRole: role.lifecycle === "archived" throw, but allows from draft or active, provided no active assignments.

    const res = await service.archiveRole({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 5,
      reason: "Retire role",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    assert.equal(res.status, "role-archived");

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `lifecycle`, `version` FROM `tenant_role` WHERE `id`=?", [roleId]);
    assert.equal(rows[0].lifecycle, "archived");
    assert.equal(rows[0].version, 6);
  });
  
  await t.test("restoreRole", async () => {
    const res = await service.restoreRole({
      principal: principal(providerAdminId),
      tenantId,
      roleId,
      expectedVersion: 6,
      reason: "Bring back",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    assert.equal(res.status, "role-restored");

    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT `lifecycle`, `version` FROM `tenant_role` WHERE `id`=?", [roleId]);
    assert.equal(rows[0].lifecycle, "draft");
    assert.equal(rows[0].version, 7);
  });
});
