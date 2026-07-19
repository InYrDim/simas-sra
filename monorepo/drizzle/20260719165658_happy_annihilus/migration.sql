ALTER TABLE `simas_application` MODIFY COLUMN `owner_user_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `binding_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `attempt_number` int NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `idempotency_key` varchar(255) NOT NULL;--> statement-breakpoint
DROP VIEW `school_admin_activation`;--> statement-breakpoint
ALTER TABLE `simas_application` MODIFY COLUMN `payload_hash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `simas_application` DROP CONSTRAINT `simas_application_attempt_number_check`;--> statement-breakpoint
ALTER TABLE `simas_application` ADD CONSTRAINT `simas_application_attempt_number_check` CHECK (`simas_application`.`attempt_number` > 0);