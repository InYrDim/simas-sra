CREATE TABLE `school_accreditation` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`profile_id` varchar(36) NOT NULL,
	`rating` enum('A','B','C','Terakreditasi','Tidak Terakreditasi') NOT NULL,
	`certificate_number` varchar(100) NOT NULL,
	`issuing_institution` varchar(150) NOT NULL,
	`determination_date` varchar(10) NOT NULL,
	`expiry_date` varchar(10),
	`supersedes_id` varchar(36),
	`correction_id` varchar(36),
	`invalidation_reason` varchar(500),
	`invalidated_at` timestamp(3),
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_accreditation_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `school_accreditation_period_check` CHECK(`school_accreditation`.`expiry_date` IS NULL OR `school_accreditation`.`expiry_date` >= `school_accreditation`.`determination_date`)
);
--> statement-breakpoint
CREATE TABLE `school_asset` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`storage_key` varchar(700) NOT NULL,
	`mime_type` enum('image/png','image/jpeg','image/webp') NOT NULL,
	`byte_size` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`created_by_user_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_asset_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `school_asset_storage_key_unique` UNIQUE INDEX(`storage_key`),
	CONSTRAINT `school_asset_size_check` CHECK(`school_asset`.`byte_size` > 0 AND `school_asset`.`byte_size` <= 2097152),
	CONSTRAINT `school_asset_dimensions_check` CHECK(`school_asset`.`width` >= 256 AND `school_asset`.`height` >= 256 AND `school_asset`.`width` = `school_asset`.`height`)
);
--> statement-breakpoint
ALTER TABLE `school_profile` ADD `logo_asset_id` varchar(36);--> statement-breakpoint
CREATE INDEX `school_accreditation_tenant_period_idx` ON `school_accreditation` (`tenant_id`,`determination_date`,`expiry_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_profile_tenant_id_id_unique` ON `school_profile` (`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_profile_id_school_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `school_profile`(`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_created_by_user_id_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_tenant_profile_fkey` FOREIGN KEY (`tenant_id`,`profile_id`) REFERENCES `school_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_tenant_supersedes_fkey` FOREIGN KEY (`tenant_id`,`supersedes_id`) REFERENCES `school_accreditation`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `school_accreditation` ADD CONSTRAINT `school_accreditation_tenant_correction_fkey` FOREIGN KEY (`tenant_id`,`correction_id`) REFERENCES `school_accreditation`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `school_asset` ADD CONSTRAINT `school_asset_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `school_asset` ADD CONSTRAINT `school_asset_created_by_user_id_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `school_profile` ADD CONSTRAINT `school_profile_tenant_logo_asset_fkey` FOREIGN KEY (`tenant_id`,`logo_asset_id`) REFERENCES `school_asset`(`tenant_id`,`id`);