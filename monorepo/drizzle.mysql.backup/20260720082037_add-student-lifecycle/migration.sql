CREATE TABLE `student_lifecycle_period` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`status` enum('active','graduated','transferred','withdrawn') NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(500) NOT NULL,
	`notes` text,
	`corrected` boolean NOT NULL DEFAULT false,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `student_lifecycle_period_range_check` CHECK(`student_lifecycle_period`.`ended_at` IS NULL OR `student_lifecycle_period`.`ended_at` >= `student_lifecycle_period`.`started_at`)
);
--> statement-breakpoint
CREATE TABLE `student_relationship` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
ALTER TABLE `student_audit` MODIFY COLUMN `operation` enum('created-person','created-student','attached-student','edited','status-transitioned','graduation-corrected','archive-denied','archived','reactivated') NOT NULL;--> statement-breakpoint
ALTER TABLE `student_audit` ADD `lifecycle_before` json;--> statement-breakpoint
ALTER TABLE `student_audit` ADD `lifecycle_after` json;--> statement-breakpoint
ALTER TABLE `student_audit` ADD `reason` varchar(1000);--> statement-breakpoint
ALTER TABLE `student_profile` ADD `archived_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `student_profile` ADD `archive_reason` varchar(500);--> statement-breakpoint
CREATE INDEX `student_lifecycle_period_tenant_student_idx` ON `student_lifecycle_period` (`tenant_id`,`student_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `student_relationship_tenant_student_active_idx` ON `student_relationship` (`tenant_id`,`student_id`,`active`);--> statement-breakpoint
ALTER TABLE `student_lifecycle_period` ADD CONSTRAINT `student_lifecycle_period_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `student_lifecycle_period` ADD CONSTRAINT `student_lifecycle_period_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `student_relationship` ADD CONSTRAINT `student_relationship_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile`(`tenant_id`,`id`);