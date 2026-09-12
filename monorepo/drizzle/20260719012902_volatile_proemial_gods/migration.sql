CREATE TABLE `applicant` (
	`user_id` varchar(36) PRIMARY KEY,
	`created_at` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `applicant_school_binding` (
	`id` varchar(36) PRIMARY KEY,
	`user_id` varchar(36) NOT NULL,
	`canonical_npsn` varchar(8) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `applicant_school_binding_user_id_unique` UNIQUE INDEX(`user_id`),
	CONSTRAINT `applicant_school_binding_canonical_npsn_unique` UNIQUE INDEX(`canonical_npsn`)
);
--> statement-breakpoint
ALTER TABLE `simas_application` ADD `owner_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `simas_application` ADD `binding_id` varchar(36);--> statement-breakpoint
ALTER TABLE `simas_application` ADD `attempt_number` int;--> statement-breakpoint
ALTER TABLE `simas_application` ADD `idempotency_key` varchar(255);--> statement-breakpoint
ALTER TABLE `simas_application` ADD `payload_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `simas_application` ADD `pending_binding_id` varchar(36) GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN binding_id ELSE NULL END) VIRTUAL;--> statement-breakpoint
CREATE UNIQUE INDEX `simas_application_binding_attempt_unique` ON `simas_application` (`binding_id`,`attempt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `simas_application_owner_idempotency_unique` ON `simas_application` (`owner_user_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `simas_application_pending_binding_unique` ON `simas_application` (`pending_binding_id`);--> statement-breakpoint
ALTER TABLE `applicant` ADD CONSTRAINT `applicant_user_id_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `applicant_school_binding` ADD CONSTRAINT `applicant_school_binding_user_id_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_owner_user_id_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_binding_id_applicant_school_binding_id_fkey` FOREIGN KEY (`binding_id`) REFERENCES `applicant_school_binding`(`id`);--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_attempt_number_check` CHECK (`simas_application`.`attempt_number` IS NULL OR `simas_application`.`attempt_number` > 0);