CREATE TABLE `people_import_batch` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `source_storage_key` varchar(700) NOT NULL,
  `source_byte_size` int NOT NULL,
  `created_by_user_id` varchar(36) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `people_import_batch_tenant_id_id_unique` (`tenant_id`,`id`),
  UNIQUE KEY `people_import_batch_storage_key_unique` (`source_storage_key`),
  CONSTRAINT `people_import_batch_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `people_import_batch_actor_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `people_import_batch_size_check` CHECK (`source_byte_size` > 0 AND `source_byte_size` <= 10485760),
  CONSTRAINT `people_import_batch_storage_scope_check` CHECK (`source_storage_key` LIKE CONCAT('tenants/', `tenant_id`, '/people-import/%'))
);
CREATE TABLE `people_import_validation_job` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `batch_id` varchar(36) NOT NULL,
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending', `attempts` int NOT NULL DEFAULT 0,
  `available_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `claimed_by` varchar(100), `claimed_at` timestamp(3),
  `last_error_code` varchar(100), `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `completed_at` timestamp(3),
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_job_batch_unique` (`tenant_id`,`batch_id`), KEY `people_import_job_claim_idx` (`status`,`available_at`),
  CONSTRAINT `people_import_job_batch_fk` FOREIGN KEY (`tenant_id`,`batch_id`) REFERENCES `people_import_batch` (`tenant_id`,`id`)
);
CREATE TABLE `people_import_revision` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `batch_id` varchar(36) NOT NULL,
  `entity_kind` enum('student','teacher','staff') NOT NULL, `template_version` varchar(20) NOT NULL,
  `row_count` int NOT NULL, `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_revision_job_unique` (`tenant_id`,`batch_id`,`id`),
  CONSTRAINT `people_import_revision_batch_fk` FOREIGN KEY (`tenant_id`,`batch_id`) REFERENCES `people_import_batch` (`tenant_id`,`id`)
);
CREATE TABLE `people_import_row` (
  `id` varchar(36) NOT NULL, `tenant_id` varchar(36) NOT NULL, `revision_id` varchar(36) NOT NULL, `row_number` int NOT NULL,
  `state` enum('ready','warning','rejected') NOT NULL, `values_json` json NOT NULL, `findings_json` json NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `people_import_row_number_unique` (`tenant_id`,`revision_id`,`row_number`),
  CONSTRAINT `people_import_row_revision_fk` FOREIGN KEY (`revision_id`) REFERENCES `people_import_revision` (`id`)
);
