import assert from "node:assert/strict";
import test from "node:test";

import type {
  NewSchoolAdminAuthorityRecord,
  NewSchoolAdminProofRecord,
  NewSecurityAuditEventRecord,
  NewSecurityAuditHeadRecord,
  NewSecurityCommandRecord,
  NewSecurityMigrationCheckpointRecord,
  NewSecurityOutboxRecord,
  NewSecurityReconciliationFindingRecord,
  NewTenantAccountLifecycleCaseRecord,
  NewTenantAccountSecurityRecord,
  NewTenantRbacRolloutRecord,
  NewTenantRoleAssignmentRecord,
  NewTenantRolePermissionRecord,
  NewTenantRoleRecord,
  SecurityAuditEventRecord,
  SecurityAuditHeadRecord,
  TenantRbacRolloutRecord,
  TenantRoleAssignmentRecord,
  TenantRoleRecord,
} from "@/lib/authorization/tenant-rbac-persistence";

type PublicInsertRecords =
  | NewTenantRoleRecord
  | NewTenantRolePermissionRecord
  | NewTenantRoleAssignmentRecord
  | NewTenantAccountSecurityRecord
  | NewTenantAccountLifecycleCaseRecord
  | NewSchoolAdminAuthorityRecord
  | NewSchoolAdminProofRecord
  | NewSecurityCommandRecord
  | NewSecurityOutboxRecord
  | NewTenantRbacRolloutRecord
  | NewSecurityMigrationCheckpointRecord
  | NewSecurityReconciliationFindingRecord
  | NewSecurityAuditHeadRecord
  | NewSecurityAuditEventRecord;

function compilePublicPersistenceContract(
  role: TenantRoleRecord,
  assignment: TenantRoleAssignmentRecord,
  rollout: TenantRbacRolloutRecord,
  head: SecurityAuditHeadRecord,
  event: SecurityAuditEventRecord,
  insert: PublicInsertRecords,
): readonly [string, string, bigint, bigint, bigint, PublicInsertRecords] {
  const lifecycle: "draft" | "active" | "archived" = role.lifecycle;
  const state: "active" | "suspended" = assignment.state;

  // Persisted records are intentionally readonly at the public seam.
  // @ts-expect-error Consumers must use versioned persistence commands.
  role.lifecycle = "archived";

  return [lifecycle, state, rollout.epoch, head.nextSequence, event.sequence, insert] as const;
}

test("RBAC persistence exposes readonly records with bigint sequence values", () => {
  assert.equal(typeof compilePublicPersistenceContract, "function");
});
