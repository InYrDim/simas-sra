CREATE TABLE `subject` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`code` varchar(30) NOT NULL,
	`normalized_code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`normalized_name` varchar(150) NOT NULL,
	`education_levels` varchar(50) NOT NULL,
	`description` text,
	`archived` boolean NOT NULL DEFAULT false,
	`archived_at` timestamp(3),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `subject_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `subject_tenant_normalized_code_unique` UNIQUE INDEX(`tenant_id`,`normalized_code`),
	CONSTRAINT `subject_tenant_normalized_name_unique` UNIQUE INDEX(`tenant_id`,`normalized_name`),
	CONSTRAINT `subject_version_check` CHECK(`subject`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `subject_history` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`subject_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('created','edited','archived','reactivated') NOT NULL,
	`from_version` int NOT NULL,
	`to_version` int NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `subject_history_version_check` CHECK(`subject_history`.`from_version` >= 0 AND `subject_history`.`to_version` = `subject_history`.`from_version` + 1)
);
--> statement-breakpoint
CREATE INDEX `subject_tenant_archive_name_idx` ON `subject` (`tenant_id`,`archived`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `subject_history_tenant_subject_idx` ON `subject_history` (`tenant_id`,`subject_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `subject` ADD CONSTRAINT `subject_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `subject_history` ADD CONSTRAINT `subject_history_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `subject_history` ADD CONSTRAINT `subject_history_tenant_subject_fkey` FOREIGN KEY (`tenant_id`,`subject_id`) REFERENCES `subject`(`tenant_id`,`id`);