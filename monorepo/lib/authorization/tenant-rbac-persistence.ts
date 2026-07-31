import type {
  schoolAdminAuthority,
  schoolAdminProof,
  securityAuditEvent,
  securityAuditHead,
  securityCommand,
  securityMigrationCheckpoint,
  securityOutbox,
  securityReconciliationFinding,
  tenantAccountLifecycleCase,
  tenantAccountSecurity,
  tenantRbacRollout,
  tenantRole,
  tenantRoleAssignment,
  tenantRolePermission,
} from "@/db/schema";

export type TenantRoleRecord = Readonly<typeof tenantRole.$inferSelect>;
export type NewTenantRoleRecord = typeof tenantRole.$inferInsert;

export type TenantRolePermissionRecord = Readonly<
  typeof tenantRolePermission.$inferSelect
>;
export type NewTenantRolePermissionRecord =
  typeof tenantRolePermission.$inferInsert;

export type TenantRoleAssignmentRecord = Readonly<
  typeof tenantRoleAssignment.$inferSelect
>;
export type NewTenantRoleAssignmentRecord =
  typeof tenantRoleAssignment.$inferInsert;

export type TenantAccountSecurityRecord = Readonly<
  typeof tenantAccountSecurity.$inferSelect
>;
export type NewTenantAccountSecurityRecord =
  typeof tenantAccountSecurity.$inferInsert;

export type TenantAccountLifecycleCaseRecord = Readonly<
  typeof tenantAccountLifecycleCase.$inferSelect
>;
export type NewTenantAccountLifecycleCaseRecord =
  typeof tenantAccountLifecycleCase.$inferInsert;

export type SchoolAdminAuthorityRecord = Readonly<
  typeof schoolAdminAuthority.$inferSelect
>;
export type NewSchoolAdminAuthorityRecord =
  typeof schoolAdminAuthority.$inferInsert;

export type SchoolAdminProofRecord = Readonly<
  typeof schoolAdminProof.$inferSelect
>;
export type NewSchoolAdminProofRecord = typeof schoolAdminProof.$inferInsert;

export type SecurityCommandRecord = Readonly<
  typeof securityCommand.$inferSelect
>;
export type NewSecurityCommandRecord = typeof securityCommand.$inferInsert;

export type SecurityOutboxRecord = Readonly<typeof securityOutbox.$inferSelect>;
export type NewSecurityOutboxRecord = typeof securityOutbox.$inferInsert;

export type TenantRbacRolloutRecord = Readonly<
  typeof tenantRbacRollout.$inferSelect
>;
export type NewTenantRbacRolloutRecord = typeof tenantRbacRollout.$inferInsert;

export type SecurityMigrationCheckpointRecord = Readonly<
  typeof securityMigrationCheckpoint.$inferSelect
>;
export type NewSecurityMigrationCheckpointRecord =
  typeof securityMigrationCheckpoint.$inferInsert;

export type SecurityReconciliationFindingRecord = Readonly<
  typeof securityReconciliationFinding.$inferSelect
>;
export type NewSecurityReconciliationFindingRecord =
  typeof securityReconciliationFinding.$inferInsert;

export type SecurityAuditHeadRecord = Readonly<
  typeof securityAuditHead.$inferSelect
>;
export type NewSecurityAuditHeadRecord = typeof securityAuditHead.$inferInsert;

/**
 * Readonly application-facing evidence. Ticket 17 owns insert-only command
 * enforcement; production UPDATE/DELETE denial still requires database grants.
 */
export type SecurityAuditEventRecord = Readonly<
  typeof securityAuditEvent.$inferSelect
>;
export type NewSecurityAuditEventRecord = typeof securityAuditEvent.$inferInsert;
