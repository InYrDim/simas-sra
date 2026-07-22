ALTER TABLE `simas_application` DROP FOREIGN KEY `simas_application_owner_user_id_user_id_fkey`;--> statement-breakpoint
ALTER TABLE `simas_application` DROP FOREIGN KEY `simas_application_binding_id_applicant_school_binding_id_fkey`;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `owner_user_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `binding_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_owner_user_id_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_binding_id_applicant_school_binding_id_fkey` FOREIGN KEY (`binding_id`) REFERENCES `applicant_school_binding`(`id`);--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `attempt_number` int NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `idempotency_key` varchar(255) NOT NULL;--> statement-breakpoint
DROP VIEW `school_admin_activation`;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `payload_hash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` DROP CONSTRAINT `simas_application_attempt_number_check`;--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_attempt_number_check` CHECK (`simas_application`.`attempt_number` > 0);