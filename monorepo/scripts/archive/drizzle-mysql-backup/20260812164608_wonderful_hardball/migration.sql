CREATE TABLE `attendance_session` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`layer` enum('gerbang','kelas') NOT NULL,
	`session_date` date NOT NULL,
	`planned_start` time(0) NOT NULL,
	`planned_end` time(0) NOT NULL,
	`opened_at` timestamp(3) NOT NULL,
	`closed_at` timestamp(3),
	`opened_by_user_id` varchar(36) NOT NULL,
	`status` enum('open','closed') NOT NULL,
	`notes` varchar(500),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `attendance_session_tenant_layer_date_unique` UNIQUE INDEX(`tenant_id`,`layer`,`session_date`),
	CONSTRAINT `attendance_session_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `attendance_session_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`),
	CONSTRAINT `attendance_session_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`opened_by_user_id`) REFERENCES `user`(`tenant_id`,`id`),
	CONSTRAINT `attendance_session_version_check` CHECK(`attendance_session`.`version` > 0),
	CONSTRAINT `attendance_session_window_check` CHECK(`attendance_session`.`planned_end` > `attendance_session`.`planned_start`)
);
--> statement-breakpoint
ALTER TABLE `attendance_record` ADD `session_id` varchar(36);--> statement-breakpoint
ALTER TABLE `attendance_record` ADD `out_of_session` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `attendance_record_tenant_session_idx` ON `attendance_record` (`tenant_id`,`session_id`);--> statement-breakpoint
ALTER TABLE `attendance_record` ADD CONSTRAINT `attendance_record_tenant_session_fkey` FOREIGN KEY (`tenant_id`,`session_id`) REFERENCES `attendance_session`(`tenant_id`,`id`);