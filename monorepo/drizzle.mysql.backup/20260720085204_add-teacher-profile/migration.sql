CREATE TABLE `teacher_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36),
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('created-person','created-teacher','attached-teacher','edited','status-transitioned','service-corrected','archive-denied','archived','reactivated') NOT NULL,
	`from_person_version` int NOT NULL,
	`to_person_version` int NOT NULL,
	`from_teacher_version` int NOT NULL,
	`to_teacher_version` int NOT NULL,
	`sensitive_before` json,
	`sensitive_after` json,
	`lifecycle_before` json,
	`lifecycle_after` json,
	`reason` varchar(1000),
	`occurred_at` timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacher_profile` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`teacher_number` varchar(50) NOT NULL,
	`normalized_teacher_number` varchar(50) NOT NULL,
	`nuptk` varchar(16),
	`employment_type` enum('civil-servant','government-contract','foundation-permanent','foundation-contract','honorary') NOT NULL,
	`service_start_date` date NOT NULL,
	`status` enum('active','leave','ended') NOT NULL DEFAULT 'active',
	`archived` boolean NOT NULL DEFAULT false,
	`archived_at` timestamp(3),
	`archive_reason` varchar(500),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `teacher_profile_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `teacher_profile_tenant_person_unique` UNIQUE INDEX(`tenant_id`,`person_id`),
	CONSTRAINT `teacher_profile_tenant_number_unique` UNIQUE INDEX(`tenant_id`,`normalized_teacher_number`),
	CONSTRAINT `teacher_profile_tenant_nuptk_unique` UNIQUE INDEX(`tenant_id`,`nuptk`),
	CONSTRAINT `teacher_profile_nuptk_check` CHECK(`teacher_profile`.`nuptk` IS NULL OR `teacher_profile`.`nuptk` REGEXP '^[0-9]{16}$'),
	CONSTRAINT `teacher_profile_version_check` CHECK(`teacher_profile`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `teacher_relationship` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `teacher_service_period` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`status` enum('active','leave','ended') NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(500) NOT NULL,
	`notes` text,
	`corrected` boolean NOT NULL DEFAULT false,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `teacher_service_period_range_check` CHECK(`teacher_service_period`.`ended_at` IS NULL OR `teacher_service_period`.`ended_at` >= `teacher_service_period`.`started_at`)
);
--> statement-breakpoint
CREATE INDEX `teacher_audit_tenant_teacher_idx` ON `teacher_audit` (`tenant_id`,`teacher_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `teacher_profile_tenant_status_archive_idx` ON `teacher_profile` (`tenant_id`,`status`,`archived`);--> statement-breakpoint
CREATE INDEX `teacher_relationship_tenant_teacher_active_idx` ON `teacher_relationship` (`tenant_id`,`teacher_id`,`active`);--> statement-breakpoint
CREATE INDEX `teacher_service_period_tenant_teacher_idx` ON `teacher_service_period` (`tenant_id`,`teacher_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `teacher_audit` ADD CONSTRAINT `teacher_audit_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `teacher_audit` ADD CONSTRAINT `teacher_audit_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teacher_audit` ADD CONSTRAINT `teacher_audit_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teacher_profile` ADD CONSTRAINT `teacher_profile_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `teacher_profile` ADD CONSTRAINT `teacher_profile_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teacher_relationship` ADD CONSTRAINT `teacher_relationship_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teacher_service_period` ADD CONSTRAINT `teacher_service_period_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `teacher_service_period` ADD CONSTRAINT `teacher_service_period_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);