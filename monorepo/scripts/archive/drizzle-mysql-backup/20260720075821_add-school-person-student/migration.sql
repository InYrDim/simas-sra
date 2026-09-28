CREATE TABLE `school_person` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`normalized_name` varchar(150) NOT NULL,
	`preferred_name` varchar(150),
	`birth_place` varchar(100) NOT NULL,
	`normalized_birth_place` varchar(100) NOT NULL,
	`birth_date` date NOT NULL,
	`gender` enum('male','female') NOT NULL,
	`nik` varchar(16),
	`nip` varchar(18),
	`religion` varchar(50),
	`street` varchar(255) NOT NULL,
	`village` varchar(100),
	`district` varchar(100),
	`city` varchar(100),
	`province` varchar(100),
	`postal_code` varchar(10),
	`phone` varchar(20),
	`email` varchar(255),
	`account_user_id` varchar(36),
	`archived` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `school_person_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `school_person_tenant_nik_unique` UNIQUE INDEX(`tenant_id`,`nik`),
	CONSTRAINT `school_person_tenant_nip_unique` UNIQUE INDEX(`tenant_id`,`nip`),
	CONSTRAINT `school_person_tenant_account_unique` UNIQUE INDEX(`tenant_id`,`account_user_id`),
	CONSTRAINT `school_person_nik_check` CHECK(`school_person`.`nik` IS NULL OR `school_person`.`nik` REGEXP '^[0-9]{16}$'),
	CONSTRAINT `school_person_nip_check` CHECK(`school_person`.`nip` IS NULL OR `school_person`.`nip` REGEXP '^[0-9]{18}$'),
	CONSTRAINT `school_person_version_check` CHECK(`school_person`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `student_audit` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`student_id` varchar(36),
	`actor_user_id` varchar(36) NOT NULL,
	`operation` enum('created-person','created-student','attached-student','edited') NOT NULL,
	`from_person_version` int NOT NULL,
	`to_person_version` int NOT NULL,
	`from_student_version` int NOT NULL,
	`to_student_version` int NOT NULL,
	`sensitive_before` json,
	`sensitive_after` json,
	`occurred_at` timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_profile` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`nis` varchar(50) NOT NULL,
	`normalized_nis` varchar(50) NOT NULL,
	`nisn` varchar(10),
	`external_student_id` varchar(100),
	`entry_date` date NOT NULL,
	`status` enum('active','graduated','transferred','withdrawn') NOT NULL DEFAULT 'active',
	`archived` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `student_profile_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `student_profile_tenant_person_unique` UNIQUE INDEX(`tenant_id`,`person_id`),
	CONSTRAINT `student_profile_tenant_nis_unique` UNIQUE INDEX(`tenant_id`,`normalized_nis`),
	CONSTRAINT `student_profile_tenant_nisn_unique` UNIQUE INDEX(`tenant_id`,`nisn`),
	CONSTRAINT `student_profile_nisn_check` CHECK(`student_profile`.`nisn` IS NULL OR `student_profile`.`nisn` REGEXP '^[0-9]{10}$'),
	CONSTRAINT `student_profile_version_check` CHECK(`student_profile`.`version` > 0)
);
--> statement-breakpoint
CREATE INDEX `school_person_tenant_name_idx` ON `school_person` (`tenant_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `student_audit_tenant_student_idx` ON `student_audit` (`tenant_id`,`student_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `student_profile_tenant_status_archive_idx` ON `student_profile` (`tenant_id`,`status`,`archived`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tenant_id_id_unique` ON `user` (`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `school_person` ADD CONSTRAINT `school_person_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `school_person` ADD CONSTRAINT `school_person_tenant_account_fkey` FOREIGN KEY (`tenant_id`,`account_user_id`) REFERENCES `user`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `student_audit` ADD CONSTRAINT `student_audit_actor_user_id_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`);--> statement-breakpoint
ALTER TABLE `student_audit` ADD CONSTRAINT `student_audit_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `student_audit` ADD CONSTRAINT `student_audit_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile`(`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `student_profile` ADD CONSTRAINT `student_profile_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);--> statement-breakpoint
ALTER TABLE `student_profile` ADD CONSTRAINT `student_profile_tenant_person_fkey` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person`(`tenant_id`,`id`);