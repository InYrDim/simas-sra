SET @ppdb_result_check_closed_at_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'result_check_closed_at'
);
--> statement-breakpoint
SET @ppdb_add_result_check_closed_at_sql = IF(
  @ppdb_result_check_closed_at_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `result_check_closed_at` timestamp(3)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_result_check_closed_at_statement FROM @ppdb_add_result_check_closed_at_sql;
--> statement-breakpoint
EXECUTE ppdb_add_result_check_closed_at_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_result_check_closed_at_statement;
