CREATE TABLE `school_admin_authority` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`authority_state` enum('none','active','disabled') NOT NULL DEFAULT 'none',
	`version` int NOT NULL DEFAULT 1,
	`granted_at` timestamp(3),
	`disabled_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_admin_authority_tenant_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `school_admin_authority_tenant_user_unique` UNIQUE INDEX(`tenant_id`,`user_id`),
	CONSTRAINT `school_admin_authority_version_check` CHECK(`school_admin_authority`.`version` > 0),
	CONSTRAINT `school_admin_authority_state_check` CHECK((
      (`school_admin_authority`.`authority_state` = 'none' AND `school_admin_authority`.`granted_at` IS NULL AND `school_admin_authority`.`disabled_at` IS NULL)
      OR (`school_admin_authority`.`authority_state` = 'active' AND `school_admin_authority`.`granted_at` IS NOT NULL AND `school_admin_authority`.`disabled_at` IS NULL)
      OR (`school_admin_authority`.`authority_state` = 'disabled' AND `school_admin_authority`.`granted_at` IS NOT NULL AND `school_admin_authority`.`disabled_at` IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE `school_admin_proof` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`authority_id` varchar(36) NOT NULL,
	`case_id` varchar(36) NOT NULL,
	`kind` enum('nomination','recovery') NOT NULL,
	`proof_state` enum('pending','completed','expired','cancelled') NOT NULL DEFAULT 'pending',
	`secret_digest` varchar(128),
	`expires_at` timestamp(3),
	`completed_at` timestamp(3),
	`pending_slot` boolean GENERATED ALWAYS AS (CASE WHEN proof_state = 'pending' THEN true ELSE NULL END) VIRTUAL,
	`version` int NOT NULL DEFAULT 1,
	`idempotency_key` varchar(128) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_admin_proof_tenant_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `school_admin_proof_case_unique` UNIQUE INDEX(`tenant_id`,`case_id`),
	CONSTRAINT `school_admin_proof_idempotency_unique` UNIQUE INDEX(`tenant_id`,`idempotency_key`),
	CONSTRAINT `school_admin_proof_pending_unique` UNIQUE INDEX(`tenant_id`,`authority_id`,`kind`,`pending_slot`),
	CONSTRAINT `school_admin_proof_version_check` CHECK(`school_admin_proof`.`version` > 0),
	CONSTRAINT `school_admin_proof_pending_check` CHECK((`school_admin_proof`.`proof_state` <> 'pending') OR (`school_admin_proof`.`secret_digest` IS NOT NULL AND `school_admin_proof`.`expires_at` IS NOT NULL AND `school_admin_proof`.`completed_at` IS NULL)),
	CONSTRAINT `school_admin_proof_completed_check` CHECK((`school_admin_proof`.`proof_state` <> 'completed') OR `school_admin_proof`.`completed_at` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `security_audit_event` (
	`id` varchar(36) PRIMARY KEY,
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`sequence` bigint unsigned NOT NULL,
	`event_key` varchar(160) NOT NULL,
	`schema_version` int NOT NULL,
	`event_type` varchar(128) NOT NULL,
	`outcome` enum('succeeded','annotated') NOT NULL,
	`actor_kind` enum('tenant-user','provider-admin','system','support-recovery') NOT NULL,
	`actor_tenant_user_id` varchar(36),
	`actor_provider_user_id` varchar(36),
	`actor_service` varchar(128),
	`command_id` varchar(36) NOT NULL,
	`target_user_id` varchar(36),
	`target_role_id` varchar(36),
	`target_assignment_id` varchar(36),
	`target_school_admin_authority_id` varchar(36),
	`target_school_admin_proof_id` varchar(36),
	`correlation_id` varchar(64) NOT NULL,
	`request_id` varchar(64),
	`reason` varchar(1000),
	`metadata` json NOT NULL,
	`canonical_payload_digest` varchar(64) NOT NULL,
	`previous_hash` varchar(64) NOT NULL,
	`event_hash` varchar(64) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `security_audit_event_sequence_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`sequence`),
	CONSTRAINT `security_audit_event_key_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`event_key`),
	CONSTRAINT `security_audit_event_context_check` CHECK((
      (`security_audit_event`.`security_context_kind` = 'tenant' AND `security_audit_event`.`tenant_id` = `security_audit_event`.`context_id` AND `security_audit_event`.`provider_context_id` IS NULL)
      OR (`security_audit_event`.`security_context_kind` = 'provider' AND `security_audit_event`.`tenant_id` IS NULL AND `security_audit_event`.`provider_context_id` = `security_audit_event`.`context_id` AND `security_audit_event`.`target_user_id` IS NULL AND `security_audit_event`.`target_role_id` IS NULL AND `security_audit_event`.`target_assignment_id` IS NULL AND `security_audit_event`.`target_school_admin_authority_id` IS NULL AND `security_audit_event`.`target_school_admin_proof_id` IS NULL)
    )),
	CONSTRAINT `security_audit_event_actor_check` CHECK((
      (`security_audit_event`.`actor_kind` = 'tenant-user' AND `security_audit_event`.`actor_tenant_user_id` IS NOT NULL AND `security_audit_event`.`actor_provider_user_id` IS NULL AND `security_audit_event`.`actor_service` IS NULL)
      OR (`security_audit_event`.`actor_kind` IN ('provider-admin', 'support-recovery') AND `security_audit_event`.`actor_tenant_user_id` IS NULL AND `security_audit_event`.`actor_provider_user_id` IS NOT NULL AND `security_audit_event`.`actor_service` IS NULL)
      OR (`security_audit_event`.`actor_kind` = 'system' AND `security_audit_event`.`actor_tenant_user_id` IS NULL AND `security_audit_event`.`actor_provider_user_id` IS NULL AND `security_audit_event`.`actor_service` IS NOT NULL)
    )),
	CONSTRAINT `security_audit_event_hash_check` CHECK(`security_audit_event`.`sequence` > 0 AND `security_audit_event`.`schema_version` > 0 AND `security_audit_event`.`canonical_payload_digest` REGEXP '^[a-f0-9]{64}$' AND `security_audit_event`.`previous_hash` REGEXP '^[a-f0-9]{64}$' AND `security_audit_event`.`event_hash` REGEXP '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE `security_audit_head` (
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`next_sequence` bigint unsigned NOT NULL DEFAULT (1),
	`head_hash` varchar(64) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `security_audit_head_partition_unique` UNIQUE INDEX(`security_context_kind`,`context_id`),
	CONSTRAINT `security_audit_head_context_check` CHECK((
      (`security_audit_head`.`security_context_kind` = 'tenant' AND `security_audit_head`.`tenant_id` = `security_audit_head`.`context_id` AND `security_audit_head`.`provider_context_id` IS NULL)
      OR (`security_audit_head`.`security_context_kind` = 'provider' AND `security_audit_head`.`tenant_id` IS NULL AND `security_audit_head`.`provider_context_id` = `security_audit_head`.`context_id`)
    )),
	CONSTRAINT `security_audit_head_sequence_check` CHECK(`security_audit_head`.`next_sequence` > 0 AND `security_audit_head`.`version` > 0),
	CONSTRAINT `security_audit_head_hash_check` CHECK(`security_audit_head`.`head_hash` REGEXP '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE `security_command` (
	`id` varchar(36) PRIMARY KEY,
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`idempotency_key` varchar(128) NOT NULL,
	`command_name` varchar(128) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`result` json,
	`created_at` timestamp(3) NOT NULL,
	`completed_at` timestamp(3),
	CONSTRAINT `security_command_context_id_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`id`),
	CONSTRAINT `security_command_idempotency_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`idempotency_key`),
	CONSTRAINT `security_command_context_check` CHECK((
      (`security_command`.`security_context_kind` = 'tenant' AND `security_command`.`tenant_id` = `security_command`.`context_id` AND `security_command`.`provider_context_id` IS NULL)
      OR (`security_command`.`security_context_kind` = 'provider' AND `security_command`.`tenant_id` IS NULL AND `security_command`.`provider_context_id` = `security_command`.`context_id`)
    )),
	CONSTRAINT `security_command_fingerprint_check` CHECK(`security_command`.`fingerprint` REGEXP '^[a-f0-9]{64}$'),
	CONSTRAINT `security_command_completion_check` CHECK((`security_command`.`status` = 'pending' AND `security_command`.`completed_at` IS NULL) OR (`security_command`.`status` <> 'pending' AND `security_command`.`completed_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `security_migration_checkpoint` (
	`migration_key` varchar(128) NOT NULL,
	`shard_key` varchar(128) NOT NULL,
	`state` enum('pending','running','completed','blocked') NOT NULL DEFAULT 'pending',
	`cursor` varchar(255),
	`source_watermark` varchar(255),
	`registry_version` varchar(64) NOT NULL,
	`operation_map_version` varchar(64) NOT NULL,
	`examined_count` int NOT NULL DEFAULT 0,
	`migrated_count` int NOT NULL DEFAULT 0,
	`finding_count` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`started_at` timestamp(3),
	`completed_at` timestamp(3),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `security_migration_checkpoint_unique` UNIQUE INDEX(`migration_key`,`shard_key`),
	CONSTRAINT `security_migration_checkpoint_counts_check` CHECK(`security_migration_checkpoint`.`examined_count` >= 0 AND `security_migration_checkpoint`.`migrated_count` >= 0 AND `security_migration_checkpoint`.`finding_count` >= 0 AND `security_migration_checkpoint`.`version` > 0),
	CONSTRAINT `security_migration_checkpoint_state_check` CHECK((
      (`security_migration_checkpoint`.`state` = 'pending' AND `security_migration_checkpoint`.`started_at` IS NULL AND `security_migration_checkpoint`.`completed_at` IS NULL)
      OR (`security_migration_checkpoint`.`state` IN ('running', 'blocked') AND `security_migration_checkpoint`.`started_at` IS NOT NULL AND `security_migration_checkpoint`.`completed_at` IS NULL)
      OR (`security_migration_checkpoint`.`state` = 'completed' AND `security_migration_checkpoint`.`started_at` IS NOT NULL AND `security_migration_checkpoint`.`completed_at` IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE `security_outbox` (
	`id` varchar(36) PRIMARY KEY,
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`command_id` varchar(36) NOT NULL,
	`event_key` varchar(160) NOT NULL,
	`event_type` varchar(128) NOT NULL,
	`payload` json NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	`available_at` timestamp(3) NOT NULL,
	`published_at` timestamp(3),
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	CONSTRAINT `security_outbox_event_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`event_key`),
	CONSTRAINT `security_outbox_attempts_check` CHECK(`security_outbox`.`attempts` >= 0),
	CONSTRAINT `security_outbox_context_check` CHECK((
      (`security_outbox`.`security_context_kind` = 'tenant' AND `security_outbox`.`tenant_id` = `security_outbox`.`context_id` AND `security_outbox`.`provider_context_id` IS NULL)
      OR (`security_outbox`.`security_context_kind` = 'provider' AND `security_outbox`.`tenant_id` IS NULL AND `security_outbox`.`provider_context_id` = `security_outbox`.`context_id`)
    ))
);
--> statement-breakpoint
CREATE TABLE `security_reconciliation_finding` (
	`id` varchar(36) PRIMARY KEY,
	`migration_key` varchar(128) NOT NULL,
	`scope_key` varchar(128) NOT NULL,
	`finding_key` varchar(160) NOT NULL,
	`tenant_id` varchar(36),
	`user_id` varchar(36),
	`reason_code` varchar(100) NOT NULL,
	`severity` enum('warning','blocking') NOT NULL,
	`state` enum('open','resolved','accepted') NOT NULL DEFAULT 'open',
	`safe_details` json NOT NULL,
	`detected_at` timestamp(3) NOT NULL,
	`resolved_at` timestamp(3),
	CONSTRAINT `security_reconciliation_finding_unique` UNIQUE INDEX(`migration_key`,`scope_key`,`finding_key`),
	CONSTRAINT `security_reconciliation_scope_check` CHECK(`security_reconciliation_finding`.`tenant_id` IS NULL OR `security_reconciliation_finding`.`scope_key` = `security_reconciliation_finding`.`tenant_id`),
	CONSTRAINT `security_reconciliation_user_scope_check` CHECK(`security_reconciliation_finding`.`user_id` IS NULL OR `security_reconciliation_finding`.`tenant_id` IS NOT NULL),
	CONSTRAINT `security_reconciliation_resolution_check` CHECK((`security_reconciliation_finding`.`state` = 'open' AND `security_reconciliation_finding`.`resolved_at` IS NULL) OR (`security_reconciliation_finding`.`state` <> 'open' AND `security_reconciliation_finding`.`resolved_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `tenant_account_lifecycle_case` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` enum('activation','recovery') NOT NULL,
	`state` enum('pending','completed','expired','cancelled','revoked') NOT NULL,
	`delivery_channel` enum('email','temporary-credential') NOT NULL,
	`secret_digest` varchar(128),
	`expires_at` timestamp(3),
	`consumed_at` timestamp(3),
	`delivery_attempts` int NOT NULL DEFAULT 0,
	`pending_slot` boolean GENERATED ALWAYS AS (CASE WHEN state = 'pending' THEN true ELSE NULL END) VIRTUAL,
	`version` int NOT NULL DEFAULT 1,
	`idempotency_key` varchar(128) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_account_case_tenant_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `tenant_account_case_idempotency_unique` UNIQUE INDEX(`tenant_id`,`idempotency_key`),
	CONSTRAINT `tenant_account_case_pending_unique` UNIQUE INDEX(`tenant_id`,`user_id`,`kind`,`pending_slot`),
	CONSTRAINT `tenant_account_case_version_check` CHECK(`tenant_account_lifecycle_case`.`version` > 0 AND `tenant_account_lifecycle_case`.`delivery_attempts` >= 0),
	CONSTRAINT `tenant_account_case_material_check` CHECK((`tenant_account_lifecycle_case`.`state` <> 'pending') OR (`tenant_account_lifecycle_case`.`secret_digest` IS NOT NULL AND `tenant_account_lifecycle_case`.`expires_at` IS NOT NULL AND `tenant_account_lifecycle_case`.`consumed_at` IS NULL)),
	CONSTRAINT `tenant_account_case_consumed_check` CHECK((`tenant_account_lifecycle_case`.`state` <> 'completed') OR `tenant_account_lifecycle_case`.`consumed_at` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `tenant_account_security` (
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`lifecycle` enum('pending-activation','active','inactive') NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`assignment_version` int NOT NULL DEFAULT 1,
	`activated_at` timestamp(3),
	`deactivated_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_account_security_user_unique` UNIQUE INDEX(`user_id`),
	CONSTRAINT `tenant_account_security_tenant_user_unique` UNIQUE INDEX(`tenant_id`,`user_id`),
	CONSTRAINT `tenant_account_security_version_check` CHECK(`tenant_account_security`.`version` > 0 AND `tenant_account_security`.`assignment_version` > 0),
	CONSTRAINT `tenant_account_security_lifecycle_check` CHECK((
      (`tenant_account_security`.`lifecycle` = 'pending-activation' AND `tenant_account_security`.`activated_at` IS NULL AND `tenant_account_security`.`deactivated_at` IS NULL)
      OR (`tenant_account_security`.`lifecycle` = 'active' AND `tenant_account_security`.`activated_at` IS NOT NULL AND `tenant_account_security`.`deactivated_at` IS NULL)
      OR (`tenant_account_security`.`lifecycle` = 'inactive' AND `tenant_account_security`.`deactivated_at` IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE `tenant_rbac_rollout` (
	`tenant_id` varchar(36) PRIMARY KEY,
	`http_mode` enum('legacy','intersection','rbac','rbac-emergency') NOT NULL DEFAULT 'legacy',
	`worker_mode` enum('legacy','intersection','rbac','rbac-emergency') NOT NULL DEFAULT 'legacy',
	`epoch` bigint unsigned NOT NULL DEFAULT (1),
	`resolver_version` varchar(64) NOT NULL,
	`registry_version` varchar(64) NOT NULL,
	`operation_map_version` varchar(64) NOT NULL,
	`overlay_hash` varchar(64),
	`multi_role_accepted_at` timestamp(3),
	`version` int NOT NULL DEFAULT 1,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_rbac_rollout_version_check` CHECK(`tenant_rbac_rollout`.`version` > 0 AND `tenant_rbac_rollout`.`epoch` > 0),
	CONSTRAINT `tenant_rbac_rollout_emergency_check` CHECK((
      (`tenant_rbac_rollout`.`http_mode` = 'rbac-emergency' AND `tenant_rbac_rollout`.`worker_mode` = 'rbac-emergency' AND `tenant_rbac_rollout`.`overlay_hash` IS NOT NULL)
      OR (`tenant_rbac_rollout`.`http_mode` <> 'rbac-emergency' AND `tenant_rbac_rollout`.`worker_mode` <> 'rbac-emergency' AND `tenant_rbac_rollout`.`overlay_hash` IS NULL)
    )),
	CONSTRAINT `tenant_rbac_rollout_rollback_check` CHECK(`tenant_rbac_rollout`.`multi_role_accepted_at` IS NULL OR (`tenant_rbac_rollout`.`http_mode` IN ('rbac', 'rbac-emergency') AND `tenant_rbac_rollout`.`worker_mode` IN ('rbac', 'rbac-emergency')))
);
--> statement-breakpoint
CREATE TABLE `tenant_role` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`normalized_name` varchar(150) NOT NULL,
	`lifecycle` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`origin` enum('scratch','template','copy','legacy-migration') NOT NULL,
	`template_key` varchar(100),
	`template_version` varchar(64),
	`copied_from_role_id` varchar(36),
	`legacy_role` enum('pimpinan','staff','guru','siswa','guest'),
	`migration_run_id` varchar(36),
	`migration_version` varchar(64),
	`migration_verification` enum('pending','verified','mismatch'),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_role_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `tenant_role_tenant_name_unique` UNIQUE INDEX(`tenant_id`,`normalized_name`),
	CONSTRAINT `tenant_role_name_check` CHECK(CHAR_LENGTH(TRIM(`tenant_role`.`name`)) > 0 AND CHAR_LENGTH(TRIM(`tenant_role`.`normalized_name`)) > 0),
	CONSTRAINT `tenant_role_version_check` CHECK(`tenant_role`.`version` > 0),
	CONSTRAINT `tenant_role_provenance_check` CHECK((
      (`tenant_role`.`origin` = 'scratch' AND `tenant_role`.`template_key` IS NULL AND `tenant_role`.`template_version` IS NULL AND `tenant_role`.`copied_from_role_id` IS NULL AND `tenant_role`.`legacy_role` IS NULL AND `tenant_role`.`migration_run_id` IS NULL AND `tenant_role`.`migration_version` IS NULL AND `tenant_role`.`migration_verification` IS NULL)
      OR (`tenant_role`.`origin` = 'template' AND `tenant_role`.`template_key` IS NOT NULL AND `tenant_role`.`template_version` IS NOT NULL AND `tenant_role`.`copied_from_role_id` IS NULL AND `tenant_role`.`legacy_role` IS NULL AND `tenant_role`.`migration_run_id` IS NULL AND `tenant_role`.`migration_version` IS NULL AND `tenant_role`.`migration_verification` IS NULL)
      OR (`tenant_role`.`origin` = 'copy' AND `tenant_role`.`template_key` IS NULL AND `tenant_role`.`template_version` IS NULL AND `tenant_role`.`copied_from_role_id` IS NOT NULL AND `tenant_role`.`legacy_role` IS NULL AND `tenant_role`.`migration_run_id` IS NULL AND `tenant_role`.`migration_version` IS NULL AND `tenant_role`.`migration_verification` IS NULL)
      OR (`tenant_role`.`origin` = 'legacy-migration' AND `tenant_role`.`template_key` IS NULL AND `tenant_role`.`template_version` IS NULL AND `tenant_role`.`copied_from_role_id` IS NULL AND `tenant_role`.`legacy_role` IS NOT NULL AND `tenant_role`.`migration_run_id` IS NOT NULL AND `tenant_role`.`migration_version` IS NOT NULL AND `tenant_role`.`migration_verification` IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE `tenant_role_assignment` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`state` enum('active','suspended') NOT NULL DEFAULT 'active',
	`version` int NOT NULL DEFAULT 1,
	`assigned_at` timestamp(3) NOT NULL,
	`suspended_at` timestamp(3),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_role_assignment_tenant_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `tenant_role_assignment_user_role_unique` UNIQUE INDEX(`tenant_id`,`user_id`,`role_id`),
	CONSTRAINT `tenant_role_assignment_version_check` CHECK(`tenant_role_assignment`.`version` > 0),
	CONSTRAINT `tenant_role_assignment_state_check` CHECK((`tenant_role_assignment`.`state` = 'active' AND `tenant_role_assignment`.`suspended_at` IS NULL) OR (`tenant_role_assignment`.`state` = 'suspended' AND `tenant_role_assignment`.`suspended_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `tenant_role_permission` (
	`tenant_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`permission_key` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_role_permission_unique` UNIQUE INDEX(`tenant_id`,`role_id`,`permission_key`),
	CONSTRAINT `tenant_role_permission_key_check` CHECK(`tenant_role_permission`.`permission_key` COLLATE utf8mb4_bin REGEXP '^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE INDEX `school_admin_authority_roster_idx` ON `school_admin_authority` (`tenant_id`,`authority_state`,`user_id`);
--> statement-breakpoint
CREATE INDEX `school_admin_proof_authority_state_idx` ON `school_admin_proof` (`tenant_id`,`authority_id`,`proof_state`);
--> statement-breakpoint
CREATE INDEX `security_audit_event_type_idx` ON `security_audit_event` (`security_context_kind`,`context_id`,`event_type`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `security_audit_event_target_user_idx` ON `security_audit_event` (`tenant_id`,`target_user_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `security_command_status_idx` ON `security_command` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `security_migration_checkpoint_state_idx` ON `security_migration_checkpoint` (`migration_key`,`state`,`shard_key`);
--> statement-breakpoint
CREATE INDEX `security_outbox_pending_idx` ON `security_outbox` (`published_at`,`available_at`);
--> statement-breakpoint
CREATE INDEX `security_reconciliation_state_idx` ON `security_reconciliation_finding` (`state`,`severity`,`detected_at`);
--> statement-breakpoint
CREATE INDEX `security_reconciliation_tenant_idx` ON `security_reconciliation_finding` (`tenant_id`,`state`,`reason_code`);
--> statement-breakpoint
CREATE INDEX `tenant_account_case_user_state_idx` ON `tenant_account_lifecycle_case` (`tenant_id`,`user_id`,`kind`,`state`);
--> statement-breakpoint
CREATE INDEX `tenant_account_security_state_idx` ON `tenant_account_security` (`tenant_id`,`lifecycle`,`user_id`);
--> statement-breakpoint
CREATE INDEX `tenant_rbac_rollout_modes_idx` ON `tenant_rbac_rollout` (`http_mode`,`worker_mode`,`epoch`);
--> statement-breakpoint
CREATE INDEX `tenant_role_tenant_lifecycle_idx` ON `tenant_role` (`tenant_id`,`lifecycle`,`normalized_name`);
--> statement-breakpoint
CREATE INDEX `tenant_role_assignment_user_state_idx` ON `tenant_role_assignment` (`tenant_id`,`user_id`,`state`);
--> statement-breakpoint
CREATE INDEX `tenant_role_assignment_role_state_idx` ON `tenant_role_assignment` (`tenant_id`,`role_id`,`state`);
--> statement-breakpoint
CREATE INDEX `tenant_role_permission_key_idx` ON `tenant_role_permission` (`permission_key`,`tenant_id`);
--> statement-breakpoint
ALTER TABLE `school_admin_authority` ADD CONSTRAINT `school_admin_authority_user_fkey` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `school_admin_proof` ADD CONSTRAINT `school_admin_proof_authority_fkey` FOREIGN KEY (`tenant_id`,`authority_id`) REFERENCES `school_admin_authority`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_command_fkey` FOREIGN KEY (`security_context_kind`,`context_id`,`command_id`) REFERENCES `security_command`(`security_context_kind`,`context_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_tenant_user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_provider_actor_fkey` FOREIGN KEY (`actor_provider_user_id`) REFERENCES `provider_admin`(`user_id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_user_fkey` FOREIGN KEY (`tenant_id`,`target_user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_role_fkey` FOREIGN KEY (`tenant_id`,`target_role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_assignment_fkey` FOREIGN KEY (`tenant_id`,`target_assignment_id`) REFERENCES `tenant_role_assignment`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_authority_fkey` FOREIGN KEY (`tenant_id`,`target_school_admin_authority_id`) REFERENCES `school_admin_authority`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_proof_fkey` FOREIGN KEY (`tenant_id`,`target_school_admin_proof_id`) REFERENCES `school_admin_proof`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_audit_head` ADD CONSTRAINT `security_audit_head_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `security_command` ADD CONSTRAINT `security_command_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `security_outbox` ADD CONSTRAINT `security_outbox_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `security_outbox` ADD CONSTRAINT `security_outbox_command_fkey` FOREIGN KEY (`security_context_kind`,`context_id`,`command_id`) REFERENCES `security_command`(`security_context_kind`,`context_id`,`id`);
--> statement-breakpoint
ALTER TABLE `security_reconciliation_finding` ADD CONSTRAINT `security_reconciliation_finding_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `security_reconciliation_finding` ADD CONSTRAINT `security_reconciliation_user_fkey` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_account_lifecycle_case` ADD CONSTRAINT `tenant_account_case_user_fkey` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_account_security` ADD CONSTRAINT `tenant_account_security_user_fkey` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD CONSTRAINT `tenant_rbac_rollout_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `tenant_role` ADD CONSTRAINT `tenant_role_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);
--> statement-breakpoint
ALTER TABLE `tenant_role` ADD CONSTRAINT `tenant_role_tenant_copy_fkey` FOREIGN KEY (`tenant_id`,`copied_from_role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_role_assignment` ADD CONSTRAINT `tenant_role_assignment_user_fkey` FOREIGN KEY (`tenant_id`,`user_id`) REFERENCES `user`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_role_assignment` ADD CONSTRAINT `tenant_role_assignment_role_fkey` FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`);
--> statement-breakpoint
ALTER TABLE `tenant_role_permission` ADD CONSTRAINT `tenant_role_permission_role_fkey` FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`);
