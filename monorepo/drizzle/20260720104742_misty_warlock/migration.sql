CREATE TABLE `school_person_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('archived') NOT NULL,
	`affected_profiles` json NOT NULL,
	`from_version` int NOT NULL,
	`to_version` int NOT NULL,
	`sensitive_before` json,
	`sensitive_after` json,
	`reason` varchar(1000),
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_person_audit_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`),
	CONSTRAINT `school_person_audit_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`)
);
--> statement-breakpoint
CREATE INDEX `school_person_audit_tenant_person_idx` ON `school_person_audit` (`tenant_id`,`person_id`,`occurred_at`);