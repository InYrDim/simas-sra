SET @ppdb_draft_fields_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ppdb_session'
    AND COLUMN_NAME = 'draft_fields'
);
--> statement-breakpoint
SET @ppdb_add_draft_fields_sql = IF(
  @ppdb_draft_fields_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `draft_fields` json',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_draft_fields_statement FROM @ppdb_add_draft_fields_sql;
--> statement-breakpoint
EXECUTE ppdb_add_draft_fields_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_draft_fields_statement;
--> statement-breakpoint
UPDATE `ppdb_session` SET `draft_fields` = COALESCE(`draft_fields`, `fields`, JSON_ARRAY());
