CREATE TABLE `school_profile` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`address_street` varchar(255) NOT NULL DEFAULT '',
	`address_village` varchar(255) NOT NULL DEFAULT '',
	`address_district` varchar(255) NOT NULL DEFAULT '',
	`address_city` varchar(255) NOT NULL DEFAULT '',
	`address_province` varchar(255) NOT NULL DEFAULT '',
	`address_postal_code` varchar(5) NOT NULL DEFAULT '',
	`institutional_email` varchar(255),
	`institutional_phone` varchar(32),
	`website` varchar(2048),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`description` text,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `school_profile_tenant_id_unique` UNIQUE INDEX(`tenant_id`),
	CONSTRAINT `school_profile_version_check` CHECK(`school_profile`.`version` > 0),
	CONSTRAINT `school_profile_latitude_check` CHECK(`school_profile`.`latitude` IS NULL OR (`school_profile`.`latitude` >= -90 AND `school_profile`.`latitude` <= 90)),
	CONSTRAINT `school_profile_longitude_check` CHECK(`school_profile`.`longitude` IS NULL OR (`school_profile`.`longitude` >= -180 AND `school_profile`.`longitude` <= 180)),
	CONSTRAINT `school_profile_coordinates_check` CHECK((`school_profile`.`latitude` IS NULL) = (`school_profile`.`longitude` IS NULL))
);
--> statement-breakpoint
CREATE TABLE `school_profile_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`profile_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation` varchar(100) NOT NULL,
	`from_version` int NOT NULL,
	`to_version` int NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_profile_audit_version_check` CHECK(`school_profile_audit`.`from_version` > 0 AND `school_profile_audit`.`to_version` = `school_profile_audit`.`from_version` + 1)
);
--> statement-breakpoint
CREATE INDEX `school_profile_audit_tenant_profile_idx` ON `school_profile_audit` (`tenant_id`,`profile_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `school_profile` ADD CONSTRAINT `school_profile_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `school_profile_audit` ADD CONSTRAINT `school_profile_audit_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `school_profile_audit` ADD CONSTRAINT `school_profile_audit_profile_id_school_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `school_profile`(`id`);--> statement-breakpoint
ALTER TABLE `school_profile_audit` ADD CONSTRAINT `school_profile_audit_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);