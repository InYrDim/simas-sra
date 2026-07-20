CREATE TABLE `academic_semester` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`kind` enum('odd','even') NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`status` enum('pending','active','completed') NOT NULL DEFAULT 'pending',
	`active_slot` varchar(36) GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN tenant_id ELSE NULL END) VIRTUAL,
	CONSTRAINT `academic_semester_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `academic_semester_year_kind_unique` UNIQUE INDEX(`academic_year_id`,`kind`),
	CONSTRAINT `academic_semester_active_slot_unique` UNIQUE INDEX(`active_slot`),
	CONSTRAINT `academic_semester_period_check` CHECK(`academic_semester`.`start_date` <= `academic_semester`.`end_date`)
);
--> statement-breakpoint
CREATE TABLE `academic_year` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`label` varchar(100) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`lifecycle` enum('draft','active','closed','cancelled') NOT NULL DEFAULT 'draft',
	`archived` boolean NOT NULL DEFAULT false,
	`active_slot` varchar(36) GENERATED ALWAYS AS (CASE WHEN lifecycle = 'active' AND archived = false THEN tenant_id ELSE NULL END) VIRTUAL,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `academic_year_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `academic_year_tenant_label_unique` UNIQUE INDEX(`tenant_id`,`label`),
	CONSTRAINT `academic_year_active_slot_unique` UNIQUE INDEX(`active_slot`),
	CONSTRAINT `academic_year_period_check` CHECK(`academic_year`.`start_date` < `academic_year`.`end_date`),
	CONSTRAINT `academic_year_version_check` CHECK(`academic_year`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `academic_year_history` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` varchar(50) NOT NULL,
	`effective_date` date NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	`from_lifecycle` enum('draft','active','closed','cancelled'),
	`to_lifecycle` enum('draft','active','closed','cancelled') NOT NULL
);
--> statement-breakpoint
CREATE INDEX `academic_year_tenant_period_idx` ON `academic_year` (`tenant_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `academic_year_history_tenant_year_idx` ON `academic_year_history` (`tenant_id`,`academic_year_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `academic_semester` ADD CONSTRAINT `academic_semester_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `academic_year` ADD CONSTRAINT `academic_year_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `academic_year_history` ADD CONSTRAINT `academic_year_history_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `academic_year_history` ADD CONSTRAINT `academic_year_history_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);