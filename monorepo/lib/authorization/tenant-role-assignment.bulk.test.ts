import assert from "node:assert/strict";
import test from "node:test";

import {
  createTenantRoleBulkAssignmentService,
} from "@/lib/authorization/tenant-role-bulk-assignment";
import {
  type AssignmentAccountRow,
  type AssignmentRoleRow,
  type TenantRoleAssignmentRepository,
} from "@/lib/authorization/tenant-role-assignment";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const SECOND_USER_ID = "00000000-0000-4000-8000-000000000030";
const ROLE_ID = "00000000-0000-4000-8000-000000000004";

const roles: AssignmentRoleRow[] = [{
  id: ROLE_ID,
  tenantId: TENANT_ID,
  name: "Guru Kelas",
  lifecycle: "active",
  permissions: ["tenant.users.view"],
}];

function account(userId: string, lifecycle: AssignmentAccountRow["lifecycle"], assignmentVersion: number): AssignmentAccountRow {
  return {
    userId,
    tenantId: TENANT_ID,
    name: userId === USER_ID ? "Budi" : "Siti",
    email: userId === USER_ID ? "budi@example.test" : "siti@example.test",
    lifecycle,
    assignmentVersion,
    schoolAdmin: false,
  };
}

test("bulk role changes preview every outcome and reject an invalid target before the first mutation", async () => {
  const mutations: string[] = [];
  const repository: TenantRoleAssignmentRepository = {
    lockTenant: async () => true,
    isSchoolAdmin: async () => true,
    getAccount: async (_tenantId, userId) => userId === SECOND_USER_ID
      ? account(userId, "active", 9)
      : account(userId, "active", 3),
    listActiveRoles: async () => roles,
    listAssignments: async (_tenantId, userId) => userId === USER_ID
      ? [{ assignmentId: "00000000-0000-4000-8000-000000000040", roleId: ROLE_ID, state: "active", version: 1 }]
      : [],
    replaceActiveAssignments: async (input) => {
      mutations.push(input.userId);
      return { updated: true, assignments: [] };
    },
  };
  const service = createTenantRoleBulkAssignmentService({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({
        actor: { kind: "tenant-user", userId: ADMIN_ID, tenantId: TENANT_ID, displayName: "Admin", email: "admin@example.test" },
        context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID },
        expectedVersions: [],
        transaction: {} as never,
      });
      return { commandId: "command-2", existing: false, result: mutation.result };
    },
    repository: () => repository,
  });

  const preview = await service.preview({
    principal: { kind: "authenticated-user", userId: ADMIN_ID },
    tenantId: TENANT_ID,
    operation: "revoke",
    roleIds: [ROLE_ID],
    targets: [
      { userId: USER_ID, expectedAssignmentVersion: 3 },
      { userId: SECOND_USER_ID, expectedAssignmentVersion: 8 },
    ],
  });
  assert.deepEqual(preview.outcomes.map(({ userId, outcome }) => ({ userId, outcome })), [
    { userId: USER_ID, outcome: "zero-role" },
    { userId: SECOND_USER_ID, outcome: "invalid" },
  ]);

  await assert.rejects(service.commit({
    principal: { kind: "authenticated-user", userId: ADMIN_ID },
    tenantId: TENANT_ID,
    operation: "revoke",
    roleIds: [ROLE_ID],
    targets: [
      { userId: USER_ID, expectedAssignmentVersion: 3 },
      { userId: SECOND_USER_ID, expectedAssignmentVersion: 8 },
    ],
    confirmZeroAccess: true,
    reason: "Penyesuaian tugas massal",
    idempotencyKey: "bulk-user-roles-1",
    correlationId: "00000000-0000-4000-8000-000000000050",
  }), (error) => error instanceof Error && "code" in error && error.code === "stale-version");
  assert.deepEqual(mutations, []);
});
