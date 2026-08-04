ALTER TABLE `people_import_validation_job` ADD COLUMN `claim_token` varchar(36) NULL;
--> statement-breakpoint
ALTER TABLE `people_import_execution_row` ADD COLUMN `claim_token` varchar(36) NULL;
