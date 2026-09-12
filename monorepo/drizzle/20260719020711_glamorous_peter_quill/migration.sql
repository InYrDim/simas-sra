RENAME TABLE `school_admin_activation` TO `temporary_credential_activation`;--> statement-breakpoint
ALTER TABLE `temporary_credential_activation` DROP CONSTRAINT `school_admin_activation_password_state_check`;--> statement-breakpoint
ALTER TABLE `temporary_credential_activation` ADD CONSTRAINT `temporary_credential_activation_password_state_check` CHECK (((`temporary_credential_activation`.`password_change_required` = true AND `temporary_credential_activation`.`password_changed_at` IS NULL) OR (`temporary_credential_activation`.`password_change_required` = false AND `temporary_credential_activation`.`password_changed_at` IS NOT NULL)));--> statement-breakpoint
CREATE VIEW `school_admin_activation` AS
SELECT
  `user_id`,
  `tenant_id`,
  `temporary_credential_issued_at`,
  `first_authenticated_at`,
  `password_change_required`,
  `password_changed_at`
FROM `temporary_credential_activation`;