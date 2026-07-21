ALTER TABLE `people_import_batch` ADD COLUMN `read_only_at` timestamp(3) GENERATED ALWAYS AS (`created_at` + INTERVAL 30 DAY) STORED;
CREATE TABLE `people_import_control` (
  `tenant_id` varchar(36) PRIMARY KEY, `emergency_stop` boolean NOT NULL DEFAULT false, `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `people_import_control_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
);
CREATE TABLE `people_import_execution` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `batch_id` varchar(36) NOT NULL, `revision_id` varchar(36) NOT NULL,
  `row_set_hash` char(64) NOT NULL, `selected_count` int NOT NULL, `status` enum('queued','processing','completed','partially_completed','stopped') NOT NULL DEFAULT 'queued',
  `actor_user_id` varchar(36) NOT NULL, `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `completed_at` timestamp(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_execution_idempotency` (`tenant_id`,`batch_id`,`revision_id`,`row_set_hash`),
  UNIQUE KEY `people_import_execution_tenant_id_id` (`tenant_id`,`id`),
  CONSTRAINT `people_import_execution_batch_fk` FOREIGN KEY (`tenant_id`,`batch_id`) REFERENCES `people_import_batch` (`tenant_id`,`id`),
  CONSTRAINT `people_import_execution_revision_fk` FOREIGN KEY (`revision_id`) REFERENCES `people_import_revision` (`id`),
  CONSTRAINT `people_import_execution_actor_fk` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user` (`tenant_id`,`id`)
);
CREATE TABLE `people_import_execution_row` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `execution_id` varchar(36) NOT NULL, `revision_id` varchar(36) NOT NULL, `row_id` varchar(36) NOT NULL,
  `planned_action` enum('create','link','skip','reject') NOT NULL, `target_person_id` varchar(36) NULL,
  `outcome` enum('created','linked','skipped','rejected','failed','already-committed') NULL, `record_id` varchar(36) NULL, `error_code` varchar(100) NULL,
  `claimed_by` varchar(100) NULL, `claimed_at` timestamp(3) NULL, `completed_at` timestamp(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_execution_selected_row` (`tenant_id`,`execution_id`,`row_id`),
  KEY `people_import_execution_claim` (`outcome`,`claimed_at`,`execution_id`),
  CONSTRAINT `people_import_execution_row_execution_fk` FOREIGN KEY (`tenant_id`,`execution_id`) REFERENCES `people_import_execution` (`tenant_id`,`id`),
  CONSTRAINT `people_import_execution_row_source_fk` FOREIGN KEY (`row_id`) REFERENCES `people_import_row` (`id`),
  CONSTRAINT `people_import_execution_row_target_fk` FOREIGN KEY (`tenant_id`,`target_person_id`) REFERENCES `school_person` (`tenant_id`,`id`)
);
CREATE TABLE `people_import_success` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `batch_id` varchar(36) NOT NULL, `revision_id` varchar(36) NOT NULL, `row_id` varchar(36) NOT NULL,
  `execution_id` varchar(36) NOT NULL, `outcome` enum('created','linked') NOT NULL, `person_id` varchar(36) NOT NULL, `profile_id` varchar(36) NOT NULL, `committed_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_success_once` (`tenant_id`,`batch_id`,`revision_id`,`row_id`),
  CONSTRAINT `people_import_success_person_fk` FOREIGN KEY (`tenant_id`,`person_id`) REFERENCES `school_person` (`tenant_id`,`id`)
);
CREATE TABLE `people_import_audit` (
  `id` varchar(36) NOT NULL PRIMARY KEY, `tenant_id` varchar(36) NOT NULL, `execution_id` varchar(36) NOT NULL, `row_id` varchar(36) NOT NULL,
  `actor_user_id` varchar(36) NOT NULL, `outcome` enum('created','linked') NOT NULL, `person_id` varchar(36) NOT NULL, `profile_id` varchar(36) NOT NULL, `occurred_at` timestamp(3) NOT NULL,
  UNIQUE KEY `people_import_audit_row` (`tenant_id`,`execution_id`,`row_id`),
  CONSTRAINT `people_import_audit_actor_fk` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user` (`tenant_id`,`id`)
);
