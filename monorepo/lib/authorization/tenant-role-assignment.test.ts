import assert from "node:assert/strict";
import test from "node:test";

import {
  createTenantRoleAssignmentService,
  type AssignmentAccountRow,
  type AssignmentRoleRow,
  type TenantRoleAssignmentRepository,
} from "@/lib/authorization/tenant-role-assignment";
import { SecurityCommandError } from "@/lib/authorization/security-command";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const ROLE_ONE_ID = "00000000-0000-4000-8000-000000000004";
const ROLE_TWO_ID = "00000000-0000-4000-8000-000000000005";

function account(overrides: Partial<AssignmentAccountRow> = {}): AssignmentAccountRow {
  return {
    userId: USER_ID,
    tenantId: TENANT_ID,
    name: "Budi",
    email: "budi@example.test",
    lifecycle: "active",
    assignmentVersion: 3,
    schoolAdmin: false,
    ...overrides,
  };
}

const roles: AssignmentRoleRow[] = [
  {
    id: ROLE_ONE_ID,
    tenantId: TENANT_ID,
    name: "Guru Kelas",
    lifecycle: "active",
    permissions: ["tenant.users.view", "subjects.subjects.view"],
  },
  {
    id: ROLE_TWO_ID,
    tenantId: TENANT_ID,
    name: "Operator",
    lifecycle: "active",
    permissions: ["tenant.users.view", "academic-years.years.view"],
  },
];

test("School Admin replaces the complete role set and sees deduplicated effective access with every source role", async () => {
  const mutations: Array<{ userId: string; roleIds: readonly string[]; expectedVersion: number }> = [];
  const repository: TenantRoleAssignmentRepository = {
    lockTenant: async () => true,
    isSchoolAdmin: async (_tenantId, userId) => userId === ADMIN_ID,
    getAccount: async () => account(),
    listActiveRoles: async () => roles,
    listAssignments: async () => [],
    replaceActiveAssignments: async (input) => {
      mutations.push({
        userId: input.userId,
        roleIds: input.roleIds,
        expectedVersion: input.expectedAssignmentVersion,
      });
      return { updated: true, assignments: input.roleIds.map((roleId, index) => ({
        assignmentId: `00000000-0000-4000-8000-00000000001${index}`,
        roleId,
        transition: "added" as const,
      })) };
    },
  };
  const service = createTenantRoleAssignmentService({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({
        actor: { kind: "tenant-user", userId: ADMIN_ID, tenantId: TENANT_ID, displayName: "Admin", email: "admin@example.test" },
        context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID },
        expectedVersions: [],
        transaction: {} as never,
      });
      return { commandId: "command-1", existing: false, result: mutation.result };
    },
    repository: () => repository,
  });

  const result = await service.replaceRoleSet({
    principal: { kind: "authenticated-user", userId: ADMIN_ID },
    tenantId: TENANT_ID,
    targetUserId: USER_ID,
    roleIds: [ROLE_TWO_ID, ROLE_ONE_ID, ROLE_TWO_ID],
    expectedAssignmentVersion: 3,
    reason: "Tugas semester baru",
    confirmZeroAccess: false,
    idempotencyKey: "replace-user-roles-1",
    correlationId: "00000000-0000-4000-8000-000000000020",
  });

  assert.deepEqual(mutations, [{
    userId: USER_ID,
    roleIds: [ROLE_ONE_ID, ROLE_TWO_ID],
    expectedVersion: 3,
  }]);
  assert.equal(result.assignmentVersion, 4);
  assert.deepEqual(result.roleIds, [ROLE_ONE_ID, ROLE_TWO_ID]);
  assert.deepEqual(result.effectiveAccess.map((permission) => ({
    key: permission.key,
    sourceRoleIds: permission.sources.map((source) => source.roleId),
  })), [
    { key: "academic-years.years.view", sourceRoleIds: [ROLE_TWO_ID] },
    { key: "subjects.subjects.view", sourceRoleIds: [ROLE_ONE_ID] },
    { key: "tenant.users.view", sourceRoleIds: [ROLE_ONE_ID, ROLE_TWO_ID] },
  ]);
});

test("direct calls reject foreign opaque targets, inactive grants, and stale versions before mutation", async () => {
  let target = account({ tenantId: "00000000-0000-4000-8000-000000000099" });
  let mutations = 0;
  const repository: TenantRoleAssignmentRepository = {
    lockTenant: async () => true,
    isSchoolAdmin: async () => true,
    getAccount: async () => target,
    listActiveRoles: async () => roles,
    listAssignments: async () => [],
    replaceActiveAssignments: async () => {
      mutations += 1;
      return { updated: true, assignments: [] };
    },
  };
  const service = createTenantRoleAssignmentService({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({
        actor: { kind: "tenant-user", userId: ADMIN_ID, tenantId: TENANT_ID, displayName: "Admin", email: "admin@example.test" },
        context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID },
        expectedVersions: [],
        transaction: {} as never,
      });
      return { commandId: "command-guard", existing: false, result: mutation.result };
    },
    repository: () => repository,
  });
  const replace = (overrides: Partial<Parameters<typeof service.replaceRoleSet>[0]> = {}) => service.replaceRoleSet({
    principal: { kind: "authenticated-user", userId: ADMIN_ID },
    tenantId: TENANT_ID,
    targetUserId: USER_ID,
    roleIds: [ROLE_ONE_ID],
    expectedAssignmentVersion: 3,
    reason: "Perubahan terkontrol",
    confirmZeroAccess: false,
    idempotencyKey: "guarded-replace",
    correlationId: "00000000-0000-4000-8000-000000000021",
    ...overrides,
  });

  await assert.rejects(replace(), (error) => error instanceof SecurityCommandError && error.code === "context-denied");
  target = account({ lifecycle: "inactive" });
  await assert.rejects(replace(), (error) => error instanceof SecurityCommandError && error.code === "invalid-command");
  target = account({ assignmentVersion: 4 });
  await assert.rejects(replace(), (error) => error instanceof SecurityCommandError && error.code === "stale-version");
  assert.equal(mutations, 0);

  target = account({ lifecycle: "inactive" });
  const revoked = await replace({
    roleIds: [],
    reason: "Menonaktifkan sisa akses akun",
    confirmZeroAccess: true,
    idempotencyKey: "inactive-revoke",
  });
  assert.equal(revoked.zeroAccess, true);
  assert.equal(mutations, 1);
});
