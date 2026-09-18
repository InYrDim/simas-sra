SET @ppdb_submission_form_fields_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ppdb_submission'
    AND COLUMN_NAME = 'form_fields'
);
--> statement-breakpoint
SET @ppdb_add_submission_form_fields_sql = IF(
  @ppdb_submission_form_fields_exists = 0,
  'ALTER TABLE `ppdb_submission` ADD COLUMN `form_fields` json',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_submission_form_fields_statement FROM @ppdb_add_submission_form_fields_sql;
--> statement-breakpoint
EXECUTE ppdb_add_submission_form_fields_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_submission_form_fields_statement;
--> statement-breakpoint
UPDATE `ppdb_submission` AS submission
INNER JOIN `ppdb_session` AS session
  ON session.`tenant_id` = submission.`tenant_id`
  AND session.`id` = submission.`session_id`
SET submission.`form_fields` = COALESCE(submission.`form_fields`, session.`fields`, JSON_ARRAY());
