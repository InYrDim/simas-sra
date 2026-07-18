CREATE TABLE `provider_admin` (
	`user_id` varchar(36) PRIMARY KEY,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_admin_user_id_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `simas_application` (
	`id` varchar(36) PRIMARY KEY,
	`school_name` varchar(255) NOT NULL,
	`npsn` varchar(20) NOT NULL,
	`education_level` varchar(64) NOT NULL,
	`address` text NOT NULL,
	`contact_name` varchar(255) NOT NULL,
	`contact_position` varchar(255) NOT NULL,
	`contact_email` varchar(255) NOT NULL,
	`contact_whatsapp` varchar(32) NOT NULL,
	`needs_note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`submitted_at` timestamp(3) NOT NULL DEFAULT (now()),
	`decided_at` timestamp(3),
	`decided_by_provider_admin_id` varchar(36),
	`rejection_reason` text,
	`approved_tenant_id` varchar(36),
	CONSTRAINT `simas_application_approved_tenant_id_unique` UNIQUE INDEX(`approved_tenant_id`),
	CONSTRAINT `simas_application_decided_by_provider_admin_fkey` FOREIGN KEY (`decided_by_provider_admin_id`) REFERENCES `provider_admin`(`user_id`),
	CONSTRAINT `simas_application_approved_tenant_fkey` FOREIGN KEY (`approved_tenant_id`) REFERENCES `tenant`(`id`),
	CONSTRAINT `simas_application_decision_state_check` CHECK((
		(`status` = 'pending' AND `decided_at` IS NULL AND `decided_by_provider_admin_id` IS NULL AND `rejection_reason` IS NULL AND `approved_tenant_id` IS NULL)
		OR (`status` = 'approved' AND `decided_at` IS NOT NULL AND `decided_by_provider_admin_id` IS NOT NULL AND `rejection_reason` IS NULL AND `approved_tenant_id` IS NOT NULL)
		OR (`status` = 'rejected' AND `decided_at` IS NOT NULL AND `decided_by_provider_admin_id` IS NOT NULL AND CHAR_LENGTH(TRIM(`rejection_reason`)) > 0 AND `approved_tenant_id` IS NULL)
	))
);
--> statement-breakpoint
ALTER TABLE `tenant`
	ADD COLUMN `npsn` varchar(20),
	ADD COLUMN `source_application_id` varchar(36),
	ADD COLUMN `approved_at` timestamp(3),
	ADD COLUMN `onboarding_completed_at` timestamp(3),
	ADD COLUMN `trial_started_at` timestamp(3),
	ADD CONSTRAINT `npsn_unique` UNIQUE INDEX(`npsn`),
	ADD CONSTRAINT `source_application_id_unique` UNIQUE INDEX(`source_application_id`),
	ADD CONSTRAINT `tenant_source_application_fkey` FOREIGN KEY (`source_application_id`) REFERENCES `simas_application`(`id`);
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `tenant_role` enum('school-admin','pimpinan','staff','guru','siswa','guest');
--> statement-breakpoint
CREATE TABLE `school_admin_activation` (
	`user_id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`temporary_credential_issued_at` timestamp(3) NOT NULL,
	`first_authenticated_at` timestamp(3),
	`password_change_required` boolean NOT NULL DEFAULT true,
	`password_changed_at` timestamp(3),
	CONSTRAINT `school_admin_activation_user_id_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `school_admin_activation_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`),
	CONSTRAINT `school_admin_activation_password_state_check` CHECK((
		(`password_change_required` = true AND `password_changed_at` IS NULL)
		OR (`password_change_required` = false AND `password_changed_at` IS NOT NULL)
	))
);
