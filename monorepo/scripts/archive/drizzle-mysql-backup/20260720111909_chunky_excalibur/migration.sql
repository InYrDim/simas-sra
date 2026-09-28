CREATE TABLE `class_membership` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`class_group_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`planned` boolean NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(1000) NOT NULL,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`active_student_slot` varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL AND planned = false THEN student_id ELSE NULL END) VIRTUAL,
	`planned_student_slot` varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL AND planned = true THEN student_id ELSE NULL END) VIRTUAL,
	CONSTRAINT `class_membership_open_active_unique` UNIQUE INDEX(`tenant_id`,`active_student_slot`),
	CONSTRAINT `class_membership_open_planned_unique` UNIQUE INDEX(`tenant_id`,`planned_student_slot`),
	CONSTRAINT `class_membership_range_check` CHECK(`class_membership`.`ended_at` IS NULL OR `class_membership`.`ended_at` >= `class_membership`.`started_at`)
);
--> statement-breakpoint
CREATE TABLE `class_relationship_event` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`kind` enum('membership','homeroom') NOT NULL,
	`relationship_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('opened','transferred','assigned','replaced') NOT NULL,
	`effective_date` date NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `homeroom_assignment` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`class_group_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(1000) NOT NULL,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`open_group_slot` varchar(36) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN class_group_id ELSE NULL END) VIRTUAL,
	`open_teacher_year_slot` varchar(73) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN CONCAT(teacher_id, ':', academic_year_id) ELSE NULL END) VIRTUAL,
	CONSTRAINT `homeroom_open_group_unique` UNIQUE INDEX(`tenant_id`,`open_group_slot`),
	CONSTRAINT `homeroom_open_teacher_year_unique` UNIQUE INDEX(`tenant_id`,`open_teacher_year_slot`),
	CONSTRAINT `homeroom_range_check` CHECK(`homeroom_assignment`.`ended_at` IS NULL OR `homeroom_assignment`.`ended_at` >= `homeroom_assignment`.`started_at`)
);
--> statement-breakpoint
CREATE INDEX `class_membership_tenant_student_history_idx` ON `class_membership` (`tenant_id`,`student_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `class_membership_tenant_group_history_idx` ON `class_membership` (`tenant_id`,`class_group_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `class_relationship_event_tenant_relationship_idx` ON `class_relationship_event` (`tenant_id`,`kind`,`relationship_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `homeroom_tenant_group_history_idx` ON `homeroom_assignment` (`tenant_id`,`class_group_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `homeroom_tenant_teacher_history_idx` ON `homeroom_assignment` (`tenant_id`,`teacher_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `class_membership` ADD CONSTRAINT `class_membership_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_membership` ADD CONSTRAINT `class_membership_tenant_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`) REFERENCES `class_group`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_membership` ADD CONSTRAINT `class_membership_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_membership` ADD CONSTRAINT `class_membership_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `class_relationship_event` ADD CONSTRAINT `class_relationship_event_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `homeroom_assignment` ADD CONSTRAINT `homeroom_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `homeroom_assignment` ADD CONSTRAINT `homeroom_tenant_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`) REFERENCES `class_group`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `homeroom_assignment` ADD CONSTRAINT `homeroom_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `homeroom_assignment` ADD CONSTRAINT `homeroom_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);