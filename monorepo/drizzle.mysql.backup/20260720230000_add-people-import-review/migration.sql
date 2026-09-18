ALTER TABLE `people_import_revision`
  ADD COLUMN `parent_revision_id` varchar(36) NULL,
  ADD COLUMN `source_storage_key` varchar(700) NULL,
  ADD CONSTRAINT `people_import_revision_parent_fk` FOREIGN KEY (`parent_revision_id`) REFERENCES `people_import_revision` (`id`),
  ADD CONSTRAINT `people_import_revision_source_scope_check` CHECK (`source_storage_key` IS NULL OR `source_storage_key` LIKE CONCAT('tenants/', `tenant_id`, '/people-import/%'));
--> statement-breakpoint
ALTER TABLE `people_import_row`
  ADD COLUMN `identity_fingerprint` char(64) NULL,
  ADD COLUMN `candidates_json` json NULL;
--> statement-breakpoint
UPDATE `people_import_row` SET `identity_fingerprint`=SHA2(CONCAT(`row_number`,':',CAST(`values_json` AS CHAR)),256), `candidates_json`=JSON_ARRAY();
--> statement-breakpoint
ALTER TABLE `people_import_row`
  MODIFY `identity_fingerprint` char(64) NOT NULL,
  MODIFY `candidates_json` json NOT NULL;
--> statement-breakpoint
CREATE TABLE `people_import_decision` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `revision_id` varchar(36) NOT NULL,
  `row_id` varchar(36) NOT NULL,
  `action` enum('link','create-distinct','skip') NOT NULL,
  `target_person_id` varchar(36) NULL,
  `actor_user_id` varchar(36) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `people_import_decision_row_unique` (`tenant_id`,`revision_id`,`row_id`),
  CONSTRAINT `people_import_decision_revision_fk` FOREIGN KEY (`revision_id`) REFERENCES `people_import_revision` (`id`),
  CONSTRAINT `people_import_decision_row_fk` FOREIGN KEY (`row_id`) REFERENCES `people_import_row` (`id`),
  CONSTRAINT `people_import_decision_target_fk` FOREIGN KEY (`tenant_id`,`target_person_id`) REFERENCES `school_person` (`tenant_id`,`id`),
  CONSTRAINT `people_import_decision_actor_fk` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user` (`tenant_id`,`id`),
  CONSTRAINT `people_import_decision_target_check` CHECK ((`action`='link' AND `target_person_id` IS NOT NULL) OR (`action`<>'link' AND `target_person_id` IS NULL))
);

