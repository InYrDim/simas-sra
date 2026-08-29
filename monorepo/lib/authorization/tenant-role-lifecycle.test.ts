import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { SecurityCommandError } from "@/lib/authorization/security-command";
import type {
  SecurityActor,
  SecurityContext,
  SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type { SecurityCommandStoreTransaction } from "@/lib/authorization/security-command-store";
import {
  createTenantRoleLifecycleService,
  normalizeDescription,
  type LifecycleRoleRow,
  type TenantRoleLifecycleExecutor,
  type TenantRoleLifecycleRepository,
} from "@/lib/authorization/tenant-role-lifecycle";

/**
 * In-memory repository + executor so the lifecycle business rules can be tested
 * without a database (the .mysql.test.ts variant covers the real MySQL store).
 */
class FakeRoleStore {
  readonly tenantId: string;
  readonly adminUserId: string;
  roles = new Map<string, LifecycleRoleRow>();
  activeAssignmentCount = 0;

  constructor(tenantId: string, adminUserId: string) {
    this.tenantId = tenantId;
    this.adminUserId = adminUserId;
  }

  repository(): TenantRoleLifecycleRepository {
    return {
      lockTenant: async (tenantId) => tenantId === this.tenantId,
      listRoles: async (tenantId) =>
        Array.from(this.roles.values()).filter((row) => row.tenantId === tenantId),
      getRole: async (tenantId, roleId) => {
        const row = this.roles.get(roleId);
        return row && row.tenantId === tenantId ? row : null;
      },
      insertRole: async (row) => {
        this.roles.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          normalizedName: row.normalizedName,
          description: row.description ?? null,
          lifecycle: "draft",
          origin: row.origin,
          templateKey: row.templateKey ?? null,
          templateVersion: row.templateVersion ?? null,
          copiedFromRoleId: row.copiedFromRoleId ?? null,
          legacyRole: null,
          version: 1,
          permissions: [],
          menuVisibility: {},
        });
      },
      updateRole: async (input) => {
        const row = this.roles.get(input.id);
        if (!row || row.tenantId !== input.tenantId || row.version !== input.expectedVersion) {
          return false;
        }
        const next: LifecycleRoleRow = {
          ...row,
          version: row.version + 1,
          name: input.name ?? row.name,
          normalizedName: input.normalizedName ?? row.normalizedName,
          description:
            input.description !== undefined ? input.description : row.description,
          lifecycle: input.lifecycle ?? row.lifecycle,
        };
        this.roles.set(input.id, next);
        return true;
      },
      insertPermissions: async (tenantId, roleId, permissions) => {
        const row = this.roles.get(roleId);
        if (!row || row.tenantId !== tenantId) return;
        this.roles.set(roleId, { ...row, permissions: [...row.permissions, ...permissions] });
      },
      deletePermissions: async (tenantId, roleId, permissions) => {
        const row = this.roles.get(roleId);
        if (!row || row.tenantId !== tenantId) return;
        const remove = new Set(permissions);
        this.roles.set(roleId, {
          ...row,
          permissions: row.permissions.filter((p) => !remove.has(p)),
        });
      },
      upsertMenuVisibility: async (tenantId, roleId, menuVisibility) => {
        const row = this.roles.get(roleId);
        if (!row || row.tenantId !== tenantId) return;
        this.roles.set(roleId, {
          ...row,
          menuVisibility: { ...row.menuVisibility, ...menuVisibility },
        });
      },
      countActiveAssignments: async () => this.activeAssignmentCount,
      deleteRole: async (tenantId, roleId) => {
        const row = this.roles.get(roleId);
        if (row && row.tenantId === tenantId) this.roles.delete(roleId);
      },
      isSchoolAdmin: async (tenantId, userId) =>
        tenantId === this.tenantId && userId === this.adminUserId,
    };
  }
}

function createTestService(store: FakeRoleStore) {
  // Empty transaction type: the service is generic over it, and the fake
  // repository ignores the transaction entirely.
  type TTxn = SecurityCommandStoreTransaction & Record<string, never>;
  const fakeTransaction = {} as TTxn;

  const execute: TenantRoleLifecycleExecutor<Record<string, never>> = async (input) => {
    const actor: SecurityActor = {
      kind: "tenant-user",
      tenantId: store.tenantId,
      userId: store.adminUserId,
      displayName: "Admin",
      email: "admin@test.invalid",
    };
    const context: SecurityContext = input.deriveContext
      ? await input.deriveContext({ actor, transaction: fakeTransaction })
      : { kind: "tenant", contextId: store.tenantId, tenantId: store.tenantId };
    const mutation = await input.authorizeAndMutate({
      actor,
      context,
      expectedVersions: input.expectedVersions ?? [],
      transaction: fakeTransaction,
    });
    return { commandId: randomUUID(), existing: false, result: mutation.result };
  };

  return createTenantRoleLifecycleService<Record<string, never>>({
    execute,
    repository: (): TenantRoleLifecycleRepository => store.repository(),
    createId: randomUUID,
    now: () => new Date("2026-08-08T00:00:00.000Z"),
  });
}

function setup() {
  const tenantId = randomUUID();
  const adminUserId = randomUUID();
  const store = new FakeRoleStore(tenantId, adminUserId);
  const service = createTestService(store);
  return { store, tenantId, adminUserId, service };
}

function principal(userId: string): SecurityPrincipal {
  return { kind: "authenticated-user", userId };
}

test("normalizeDescription maps empty/whitespace to null and trims", () => {
  assert.equal(normalizeDescription(undefined), null);
  assert.equal(normalizeDescription(null), null);
  assert.equal(normalizeDescription(""), null);
  assert.equal(normalizeDescription("   "), null);
  assert.equal(normalizeDescription("  Deskripsi  "), "Deskripsi");
  assert.throws(
    () => normalizeDescription("x".repeat(2001)),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "invalid-command",
  );
});

test("createRole with a description stores it and listRoles/getRole return it", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const res = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Uji Deskripsi",
    origin: "scratch",
    description: "Role uji deskripsi",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  assert.equal(res.status, "role-created");
  const stored = store.roles.get(res.roleId);
  assert.ok(stored);
  assert.equal(stored.description, "Role uji deskripsi");
  assert.equal(stored.name, "Role Uji Deskripsi");
  assert.equal(stored.lifecycle, "draft");

  const viaList = (await store.repository().listRoles(tenantId))[0];
  assert.equal(viaList.description, "Role uji deskripsi");

  const viaGet = await store.repository().getRole(tenantId, res.roleId);
  assert.equal(viaGet?.description, "Role uji deskripsi");
});

test("changeRoleDescription persists the new value and bumps the version", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const created = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Uji Deskripsi",
    origin: "scratch",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  const res = await service.changeRoleDescription({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 1,
    description: "Deskripsi setelah edit",
    reason: "Description updated via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  assert.equal(res.status, "role-description-edited");

  const stored = store.roles.get(created.roleId);
  assert.ok(stored);
  assert.equal(stored.description, "Deskripsi setelah edit");
  assert.equal(stored.version, 2);

  const viaGet = await store.repository().getRole(tenantId, created.roleId);
  assert.equal(viaGet?.description, "Deskripsi setelah edit");
});

test("role created without a description keeps NULL (nullable render-safe)", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const res = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Tanpa Deskripsi",
    origin: "scratch",
    permissions: [],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  const stored = store.roles.get(res.roleId);
  assert.ok(stored);
  // NULL is what the UI maps to an empty Description column later.
  assert.equal(stored.description, null);
});

test("clearing the description via changeRoleDescription stores NULL", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const created = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Uji Deskripsi",
    origin: "scratch",
    description: "Akan dihapus",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  await service.changeRoleDescription({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 1,
    description: "",
    reason: "Clear description",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  const row = await store.repository().getRole(tenantId, created.roleId);
  assert.equal(row?.description, null);
});

test("changeRoleDescription against a stale version is rejected", async () => {
  const { tenantId, adminUserId, service } = setup();

  const created = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Uji Deskripsi",
    origin: "scratch",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  await assert.rejects(
    service.changeRoleDescription({
      principal: principal(adminUserId),
      tenantId,
      roleId: created.roleId,
      expectedVersion: 5, // wrong
      description: "stale",
      reason: "Stale update",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    }),
    (error: unknown) =>
      error instanceof SecurityCommandError && error.code === "stale-version",
  );
});

test("restoreRole transitions an archived role directly to active", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const created = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Arsip",
    origin: "scratch",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });
  await service.activateRole({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 1,
    reason: "Activate",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });
  await service.archiveRole({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 2,
    reason: "Archive",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  const res = await service.restoreRole({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 3,
    reason: "Restore",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  assert.equal(res.status, "role-restored");
  const row = await store.repository().getRole(tenantId, created.roleId);
  assert.equal(row?.lifecycle, "active");
});

test("deleteRole removes the role and is rejected when active assignments exist", async () => {
  const { store, tenantId, adminUserId, service } = setup();

  const created = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Hapus",
    origin: "scratch",
    permissions: ["tenant.dashboard.view"],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // No active assignments -> delete succeeds.
  const res = await service.deleteRole({
    principal: principal(adminUserId),
    tenantId,
    roleId: created.roleId,
    expectedVersion: 1,
    reason: "Delete",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });
  assert.equal(res.status, "role-deleted");
  assert.equal(await store.repository().getRole(tenantId, created.roleId), null);

  // With active assignments, delete is rejected.
  const other = await service.createRole({
    principal: principal(adminUserId),
    tenantId,
    name: "Role Terpakai",
    origin: "scratch",
    permissions: [],
    reason: "Created via UI",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });
  store.activeAssignmentCount = 1;
  await assert.rejects(
    service.deleteRole({
      principal: principal(adminUserId),
      tenantId,
      roleId: other.roleId,
      expectedVersion: 1,
      reason: "Delete blocked",
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    }),
    (error: unknown) =>
      error instanceof SecurityCommandError && error.code === "invalid-command",
  );
});
