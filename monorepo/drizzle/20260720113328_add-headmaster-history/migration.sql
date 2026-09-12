CREATE TABLE `headmaster_assignment` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`started_at` date NOT NULL,
	`ended_at` date,
	`reason` varchar(1000) NOT NULL,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`open_slot` varchar(7) GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN 'current' ELSE NULL END) VIRTUAL,
	CONSTRAINT `headmaster_assignment_open_unique` UNIQUE INDEX(`tenant_id`,`open_slot`),
	CONSTRAINT `headmaster_assignment_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `headmaster_assignment_range_check` CHECK(`headmaster_assignment`.`ended_at` IS NULL OR `headmaster_assignment`.`ended_at` >= `headmaster_assignment`.`started_at`)
);
--> statement-breakpoint
CREATE TABLE `headmaster_assignment_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`assignment_id` varchar(36) NOT NULL,
	`previous_assignment_id` varchar(36),
	`teacher_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('assigned','replaced') NOT NULL,
	`effective_date` date NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `headmaster_assignment_tenant_history_idx` ON `headmaster_assignment` (`tenant_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `headmaster_audit_tenant_assignment_idx` ON `headmaster_assignment_audit` (`tenant_id`,`assignment_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment` ADD CONSTRAINT `headmaster_assignment_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment` ADD CONSTRAINT `headmaster_assignment_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`created_by_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment_audit` ADD CONSTRAINT `headmaster_audit_tenant_assignment_fkey` FOREIGN KEY (`tenant_id`,`assignment_id`) REFERENCES `headmaster_assignment`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment_audit` ADD CONSTRAINT `headmaster_audit_tenant_previous_fkey` FOREIGN KEY (`tenant_id`,`previous_assignment_id`) REFERENCES `headmaster_assignment`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment_audit` ADD CONSTRAINT `headmaster_audit_tenant_teacher_fkey` FOREIGN KEY (`tenant_id`,`teacher_id`) REFERENCES `teacher_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `headmaster_assignment_audit` ADD CONSTRAINT `headmaster_audit_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`);