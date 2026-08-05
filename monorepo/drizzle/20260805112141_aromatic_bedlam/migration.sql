CREATE TABLE `security_audit_legal_hold` (
	`id` varchar(36) PRIMARY KEY,
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`case_id` varchar(128) NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`state` enum('active','released') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL,
	`released_at` timestamp(3),
	CONSTRAINT `security_audit_legal_hold_case_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`case_id`),
	CONSTRAINT `security_audit_legal_hold_context_check` CHECK((
      (`security_audit_legal_hold`.`security_context_kind` = 'tenant' AND `security_audit_legal_hold`.`tenant_id` = `security_audit_legal_hold`.`context_id` AND `security_audit_legal_hold`.`provider_context_id` IS NULL)
      OR (`security_audit_legal_hold`.`security_context_kind` = 'provider' AND `security_audit_legal_hold`.`tenant_id` IS NULL AND `security_audit_legal_hold`.`provider_context_id` = `security_audit_legal_hold`.`context_id`)
    )),
	CONSTRAINT `security_audit_legal_hold_release_check` CHECK((`security_audit_legal_hold`.`state` = 'active' AND `security_audit_legal_hold`.`released_at` IS NULL) OR (`security_audit_legal_hold`.`state` = 'released' AND `security_audit_legal_hold`.`released_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `security_audit_retention_certificate` (
	`id` varchar(36) PRIMARY KEY,
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`policy_version` int NOT NULL,
	`retention_days` int NOT NULL,
	`legal_hold` boolean NOT NULL,
	`tenant_deleted` boolean NOT NULL,
	`retained_count` int NOT NULL,
	`minimized_count` int NOT NULL,
	`disposal_eligible_count` int NOT NULL,
	`event_watermark` varchar(64) NOT NULL,
	`issued_at` timestamp(3) NOT NULL,
	CONSTRAINT `security_audit_retention_certificate_id_unique` UNIQUE INDEX(`security_context_kind`,`context_id`,`id`),
	CONSTRAINT `security_audit_retention_certificate_count_check` CHECK(`security_audit_retention_certificate`.`retention_days` >= 0 AND `security_audit_retention_certificate`.`policy_version` > 0 AND `security_audit_retention_certificate`.`retained_count` >= 0 AND `security_audit_retention_certificate`.`minimized_count` >= 0 AND `security_audit_retention_certificate`.`disposal_eligible_count` >= 0),
	CONSTRAINT `security_audit_retention_certificate_context_check` CHECK((
      (`security_audit_retention_certificate`.`security_context_kind` = 'tenant' AND `security_audit_retention_certificate`.`tenant_id` = `security_audit_retention_certificate`.`context_id` AND `security_audit_retention_certificate`.`provider_context_id` IS NULL)
      OR (`security_audit_retention_certificate`.`security_context_kind` = 'provider' AND `security_audit_retention_certificate`.`tenant_id` IS NULL AND `security_audit_retention_certificate`.`provider_context_id` = `security_audit_retention_certificate`.`context_id`)
    ))
);
--> statement-breakpoint
CREATE TABLE `security_audit_retention_policy` (
	`security_context_kind` enum('tenant','provider') NOT NULL,
	`context_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`provider_context_id` varchar(36),
	`retention_days` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `security_audit_retention_policy_partition_unique` UNIQUE INDEX(`security_context_kind`,`context_id`),
	CONSTRAINT `security_audit_retention_policy_days_check` CHECK(`security_audit_retention_policy`.`retention_days` >= 0 AND `security_audit_retention_policy`.`version` > 0),
	CONSTRAINT `security_audit_retention_policy_context_check` CHECK((
      (`security_audit_retention_policy`.`security_context_kind` = 'tenant' AND `security_audit_retention_policy`.`tenant_id` = `security_audit_retention_policy`.`context_id` AND `security_audit_retention_policy`.`provider_context_id` IS NULL)
      OR (`security_audit_retention_policy`.`security_context_kind` = 'provider' AND `security_audit_retention_policy`.`tenant_id` IS NULL AND `security_audit_retention_policy`.`provider_context_id` = `security_audit_retention_policy`.`context_id`)
    ))
);
--> statement-breakpoint
CREATE TABLE `teaching_assignment` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teacher_profile_id` varchar(36) NOT NULL,
	`subject_id` varchar(36) NOT NULL,
	`class_group_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date,
	`status` enum('planned','active','ended','cancelled') NOT NULL DEFAULT 'planned',
	`reason` varchar(1000) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `teaching_assignment_tenant_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `teaching_assignment_version_check` CHECK(`teaching_assignment`.`version` > 0),
	CONSTRAINT `teaching_assignment_range_check` CHECK(`teaching_assignment`.`ends_on` IS NULL OR `teaching_assignment`.`ends_on` > `teaching_assignment`.`starts_on`)
);
--> statement-breakpoint
CREATE TABLE `teaching_assignment_event` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teaching_assignment_id` varchar(36) NOT NULL,
	`replacement_assignment_id` varchar(36),
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('created','planned-updated','activated','ended','cancelled','replaced') NOT NULL,
	`from_version` int NOT NULL,
	`to_version` int NOT NULL,
	`effective_on` date NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `teaching_assignment_event_version_check` CHECK(`teaching_assignment_event`.`from_version` >= 0 AND `teaching_assignment_event`.`to_version` = `teaching_assignment_event`.`from_version` + 1)
);
--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_policy_version` varchar(64);--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_denied_operation_ids` json;--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_denied_permission_keys` json;--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_deny_mutations` boolean;--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_review_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout` ADD `overlay_expires_at` timestamp(3);--> statement-breakpoint
CREATE UNIQUE INDEX `class_group_tenant_id_year_unique` ON `class_group` (`tenant_id`,`id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `security_audit_legal_hold_state_idx` ON `security_audit_legal_hold` (`security_context_kind`,`context_id`,`state`);--> statement-breakpoint
CREATE INDEX `security_audit_retention_certificate_context_idx` ON `security_audit_retention_certificate` (`security_context_kind`,`context_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `teaching_assignment_scope_idx` ON `teaching_assignment` (`tenant_id`,`teacher_profile_id`,`subject_id`,`class_group_id`,`academic_year_id`,`status`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `teaching_assignment_event_scope_idx` ON `teaching_assignment_event` (`tenant_id`,`teaching_assignment_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `teaching_assignment` ADD CONSTRAINT `teaching_assignment_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_profile_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment` ADD CONSTRAINT `teaching_assignment_subject_fkey` FOREIGN KEY (`tenant_id`,`subject_id`) REFERENCES `subject`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment` ADD CONSTRAINT `teaching_assignment_class_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`,`academic_year_id`) REFERENCES `class_group`(`tenant_id`,`id`,`academic_year_id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment` ADD CONSTRAINT `teaching_assignment_academic_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment` ADD CONSTRAINT `teaching_assignment_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment_event` ADD CONSTRAINT `teaching_assignment_event_assignment_fkey` FOREIGN KEY (`tenant_id`,`teaching_assignment_id`) REFERENCES `teaching_assignment`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment_event` ADD CONSTRAINT `teaching_assignment_event_replacement_fkey` FOREIGN KEY (`tenant_id`,`replacement_assignment_id`) REFERENCES `teaching_assignment`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teaching_assignment_event` ADD CONSTRAINT `teaching_assignment_event_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`);