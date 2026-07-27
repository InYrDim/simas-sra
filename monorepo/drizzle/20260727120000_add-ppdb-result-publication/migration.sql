SET @ppdb_accepted_feedback_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'accepted_feedback'
);
--> statement-breakpoint
SET @ppdb_add_accepted_feedback_sql = IF(
  @ppdb_accepted_feedback_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `accepted_feedback` text',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_accepted_feedback_statement FROM @ppdb_add_accepted_feedback_sql;
--> statement-breakpoint
EXECUTE ppdb_add_accepted_feedback_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_accepted_feedback_statement;
--> statement-breakpoint
SET @ppdb_accepted_next_steps_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'accepted_next_steps'
);
--> statement-breakpoint
SET @ppdb_add_accepted_next_steps_sql = IF(
  @ppdb_accepted_next_steps_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `accepted_next_steps` text',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_accepted_next_steps_statement FROM @ppdb_add_accepted_next_steps_sql;
--> statement-breakpoint
EXECUTE ppdb_add_accepted_next_steps_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_accepted_next_steps_statement;
--> statement-breakpoint
SET @ppdb_rejected_feedback_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'rejected_feedback'
);
--> statement-breakpoint
SET @ppdb_add_rejected_feedback_sql = IF(
  @ppdb_rejected_feedback_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `rejected_feedback` text',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_rejected_feedback_statement FROM @ppdb_add_rejected_feedback_sql;
--> statement-breakpoint
EXECUTE ppdb_add_rejected_feedback_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_rejected_feedback_statement;
--> statement-breakpoint
SET @ppdb_rejected_next_steps_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'rejected_next_steps'
);
--> statement-breakpoint
SET @ppdb_add_rejected_next_steps_sql = IF(
  @ppdb_rejected_next_steps_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `rejected_next_steps` text',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_rejected_next_steps_statement FROM @ppdb_add_rejected_next_steps_sql;
--> statement-breakpoint
EXECUTE ppdb_add_rejected_next_steps_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_rejected_next_steps_statement;
--> statement-breakpoint
SET @ppdb_whatsapp_group_url_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'whatsapp_group_url'
);
--> statement-breakpoint
SET @ppdb_add_whatsapp_group_url_sql = IF(
  @ppdb_whatsapp_group_url_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `whatsapp_group_url` varchar(2048)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_whatsapp_group_url_statement FROM @ppdb_add_whatsapp_group_url_sql;
--> statement-breakpoint
EXECUTE ppdb_add_whatsapp_group_url_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_whatsapp_group_url_statement;
--> statement-breakpoint
SET @ppdb_results_published_at_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppdb_session' AND COLUMN_NAME = 'results_published_at'
);
--> statement-breakpoint
SET @ppdb_add_results_published_at_sql = IF(
  @ppdb_results_published_at_exists = 0,
  'ALTER TABLE `ppdb_session` ADD COLUMN `results_published_at` timestamp(3)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE ppdb_add_results_published_at_statement FROM @ppdb_add_results_published_at_sql;
--> statement-breakpoint
EXECUTE ppdb_add_results_published_at_statement;
--> statement-breakpoint
DEALLOCATE PREPARE ppdb_add_results_published_at_statement;
