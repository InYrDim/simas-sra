CREATE TABLE `class_group` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`education_level` enum('SD','SMP','SMA','SMK') NOT NULL,
	`grade` int NOT NULL,
	`group_name` varchar(100) NOT NULL,
	`normalized_group_name` varchar(100) NOT NULL,
	`code` varchar(30),
	`normalized_code` varchar(30),
	`capacity` int,
	`primary_location_id` varchar(36),
	`lifecycle` enum('draft','active','closed','cancelled') NOT NULL DEFAULT 'draft',
	`archived` boolean NOT NULL DEFAULT false,
	`archived_at` timestamp(3),
	`archive_reason` varchar(1000),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `class_group_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `class_group_year_name_unique` UNIQUE INDEX(`tenant_id`,`academic_year_id`,`normalized_group_name`),
	CONSTRAINT `class_group_tenant_code_unique` UNIQUE INDEX(`tenant_id`,`normalized_code`),
	CONSTRAINT `class_group_grade_check` CHECK(`class_group`.`grade` BETWEEN 1 AND 12),
	CONSTRAINT `class_group_capacity_check` CHECK(`class_group`.`capacity` IS NULL OR (`class_group`.`capacity` BETWEEN 1 AND 999)),
	CONSTRAINT `class_group_version_check` CHECK(`class_group`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `class_group_history` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`class_group_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` varchar(50) NOT NULL,
	`from_version` int NOT NULL,
	`to_version` int NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `class_group_history_version_check` CHECK(`class_group_history`.`from_version` >= 0 AND `class_group_history`.`to_version` = `class_group_history`.`from_version` + 1)
);
--> statement-breakpoint
CREATE TABLE `class_group_relationship` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`class_group_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE INDEX `class_group_tenant_archive_name_idx` ON `class_group` (`tenant_id`,`archived`,`normalized_group_name`);--> statement-breakpoint
CREATE INDEX `class_group_history_tenant_group_idx` ON `class_group_history` (`tenant_id`,`class_group_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `class_group_relationship_tenant_active_idx` ON `class_group_relationship` (`tenant_id`,`class_group_id`,`active`);--> statement-breakpoint
ALTER TABLE `class_group` ADD CONSTRAINT `class_group_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `class_group` ADD CONSTRAINT `class_group_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_group_history` ADD CONSTRAINT `class_group_history_tenant_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`) REFERENCES `class_group`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_group_history` ADD CONSTRAINT `class_group_history_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_group_relationship` ADD CONSTRAINT `class_group_relationship_tenant_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`) REFERENCES `class_group`(`tenant_id`,`id`);