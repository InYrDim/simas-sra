CREATE TABLE `staff_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`staff_id` varchar(36),
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('created-person','created-staff','attached-staff','edited','status-transitioned','service-corrected','archive-denied','archived','reactivated') NOT NULL,
	`from_person_version` int NOT NULL,
	`to_person_version` int NOT NULL,
	`from_staff_version` int NOT NULL,
	`to_staff_version` int NOT NULL,
	`sensitive_before` json,
	`sensitive_after` json,
	`lifecycle_before` json,
	`lifecycle_after` json,
	`reason` varchar(1000),
	`occurred_at` timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_position_assignment` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`position` enum('administration','finance','library','laboratory','security','cleaning','other') NOT NULL,
	`position_other` varchar(100),
	`work_unit` varchar(150),
	`notes` text,
	`started_at` date NOT NULL,
	`ended_at` date,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `staff_position_assignment_range_check` CHECK(`staff_position_assignment`.`ended_at` IS NULL OR `staff_position_assignment`.`ended_at` >= `staff_position_assignment`.`started_at`),
	CONSTRAINT `staff_position_assignment_other_check` CHECK(`staff_position_assignment`.`position` <> 'other' OR `staff_position_assignment`.`position_other` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `staff_profile` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`staff_number` varchar(50) NOT NULL,
	`normalized_staff_number` varchar(50) NOT NULL,
	`position` enum('administration','finance','library','laboratory','security','cleaning','other') NOT NULL,
	`position_other` varchar(100),
	`employment_type` enum('civil-servant','government-contract','foundation-permanent','foundation-contract','honorary','other') NOT NULL,
	`employment_type_other` varchar(100),
	`service_start_date` date NOT NULL,
	`status` enum('active','leave','ended') NOT NULL DEFAULT 'active',
	`archived` boolean NOT NULL DEFAULT false,
	`archived_at` timestamp(3),
	`archive_reason` varchar(500),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `staff_profile_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `staff_profile_tenant_person_unique` UNIQUE INDEX(`tenant_id`,`person_id`),
	CONSTRAINT `staff_profile_tenant_number_unique` UNIQUE INDEX(`tenant_id`,`normalized_staff_number`),
	CONSTRAINT `staff_profile_position_other_check` CHECK(`staff_profile`.`position` <> "other" OR `staff_profile`.`position_other` IS NOT NULL),
	CONSTRAINT `staff_profile_employment_other_check` CHECK(`staff_profile`.`employment_type` <> "other" OR `staff_profile`.`employment_type_other` IS NOT NULL),
	CONSTRAINT `staff_profile_version_check` CHECK(`staff_profile`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `staff_relationship` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `staff_service_period` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`status` enum('active','leave','ended') NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(500) NOT NULL,
	`notes` text,
	`corrected` boolean NOT NULL DEFAULT false,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `staff_service_period_range_check` CHECK(`staff_service_period`.`ended_at` IS NULL OR `staff_service_period`.`ended_at` >= `staff_service_period`.`started_at`)
);
--> statement-breakpoint
CREATE INDEX `staff_audit_tenant_staff_idx` ON `staff_audit` (`tenant_id`,`staff_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `staff_position_assignment_tenant_staff_idx` ON `staff_position_assignment` (`tenant_id`,`staff_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `staff_profile_tenant_status_archive_idx` ON `staff_profile` (`tenant_id`,`status`,`archived`);--> statement-breakpoint
CREATE INDEX `staff_relationship_tenant_staff_active_idx` ON `staff_relationship` (`tenant_id`,`staff_id`,`active`);--> statement-breakpoint
CREATE INDEX `staff_service_period_tenant_staff_idx` ON `staff_service_period` (`tenant_id`,`staff_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `staff_audit` ADD CONSTRAINT `staff_audit_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `staff_audit` ADD CONSTRAINT `staff_audit_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_audit` ADD CONSTRAINT `staff_audit_tenant_staff_fkey` FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_position_assignment` ADD CONSTRAINT `staff_position_assignment_tenant_staff_fkey` FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_position_assignment` ADD CONSTRAINT `staff_position_assignment_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_profile` ADD CONSTRAINT `staff_profile_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `staff_profile` ADD CONSTRAINT `staff_profile_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_relationship` ADD CONSTRAINT `staff_relationship_tenant_staff_fkey` FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_service_period` ADD CONSTRAINT `staff_service_period_tenant_staff_fkey` FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `staff_service_period` ADD CONSTRAINT `staff_service_period_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);