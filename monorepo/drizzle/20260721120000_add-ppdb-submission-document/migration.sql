ALTER TABLE `ppdb_submission`
  ADD CONSTRAINT `ppdb_submission_tenant_id_id_unique` UNIQUE (`tenant_id`, `id`);

CREATE TABLE `ppdb_submission_document` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `submission_id` varchar(36) NOT NULL,
  `field_id` varchar(100) NOT NULL,
  `storage_key` varchar(700) NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `mime_type` enum('application/pdf','image/jpeg','image/png') NOT NULL,
  `byte_size` int NOT NULL,
  `created_at` timestamp(3) NOT NULL,
  CONSTRAINT `ppdb_submission_document_id` PRIMARY KEY (`id`),
  CONSTRAINT `ppdb_submission_document_storage_key_unique` UNIQUE (`storage_key`),
  CONSTRAINT `ppdb_submission_document_field_unique` UNIQUE (`tenant_id`, `submission_id`, `field_id`),
  CONSTRAINT `ppdb_submission_document_submission_fkey`
    FOREIGN KEY (`tenant_id`, `submission_id`)
    REFERENCES `ppdb_submission` (`tenant_id`, `id`),
  CONSTRAINT `ppdb_submission_document_tenant_id_tenant_id_fk`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `ppdb_submission_document_size_check`
    CHECK (`byte_size` > 0 AND `byte_size` <= 2097152)
);

CREATE INDEX `ppdb_submission_document_submission_idx`
  ON `ppdb_submission_document` (`tenant_id`, `submission_id`);
