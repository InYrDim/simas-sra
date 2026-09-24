SET @validation_claim_token_sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'people_import_validation_job'
      AND column_name = 'claim_token'
  ),
  'SELECT 1',
  'ALTER TABLE `people_import_validation_job` ADD COLUMN `claim_token` varchar(36) NULL'
);
--> statement-breakpoint
PREPARE validation_claim_token_stmt FROM @validation_claim_token_sql;
--> statement-breakpoint
EXECUTE validation_claim_token_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE validation_claim_token_stmt;
--> statement-breakpoint
SET @execution_claim_token_sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'people_import_execution_row'
      AND column_name = 'claim_token'
  ),
  'SELECT 1',
  'ALTER TABLE `people_import_execution_row` ADD COLUMN `claim_token` varchar(36) NULL'
);
--> statement-breakpoint
PREPARE execution_claim_token_stmt FROM @execution_claim_token_sql;
--> statement-breakpoint
EXECUTE execution_claim_token_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE execution_claim_token_stmt;
