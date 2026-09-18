ALTER TABLE `tenant` MODIFY COLUMN `npsn` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant` DROP FOREIGN KEY `tenant_source_application_fkey`;--> statement-breakpoint
ALTER TABLE `tenant` MODIFY COLUMN `source_application_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_source_application_fkey` FOREIGN KEY (`source_application_id`) REFERENCES `simas_application`(`id`);--> statement-breakpoint
ALTER TABLE `tenant` MODIFY COLUMN `approved_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_onboarding_trial_state_check` CHECK((
	(`onboarding_completed_at` IS NULL AND `trial_started_at` IS NULL AND `trial_ends_at` IS NULL)
	OR (`onboarding_completed_at` IS NOT NULL AND `trial_started_at` = `onboarding_completed_at` AND `trial_ends_at` = DATE_ADD(`trial_started_at`, INTERVAL 1 MONTH))
));