CREATE TABLE `tenant_operational_migration_checkpoint` (
	`migration_key` varchar(100) PRIMARY KEY,
	`last_tenant_id` varchar(36),
	`examined_count` int NOT NULL DEFAULT 0,
	`migrated_count` int NOT NULL DEFAULT 0,
	`reconciliation_count` int NOT NULL DEFAULT 0,
	`access_difference_count` int NOT NULL DEFAULT 0,
	`completed_at` timestamp(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_operational_migration_examined_check` CHECK(`tenant_operational_migration_checkpoint`.`examined_count` >= 0),
	CONSTRAINT `tenant_operational_migration_migrated_check` CHECK(`tenant_operational_migration_checkpoint`.`migrated_count` >= 0),
	CONSTRAINT `tenant_operational_migration_reconciliation_check` CHECK(`tenant_operational_migration_checkpoint`.`reconciliation_count` >= 0),
	CONSTRAINT `tenant_operational_migration_access_difference_check` CHECK(`tenant_operational_migration_checkpoint`.`access_difference_count` >= 0)
);
--> statement-breakpoint
DROP INDEX `transactional_outbox_event_aggregate_unique` ON `transactional_outbox`;--> statement-breakpoint
ALTER TABLE `tenant` ADD `operational_status` enum('active','closed');--> statement-breakpoint
ALTER TABLE `tenant` ADD `reconciliation_status` enum('not_required','needs_reconciliation');--> statement-breakpoint
ALTER TABLE `tenant` ADD `deletion_waiting_days` int;--> statement-breakpoint
ALTER TABLE `transactional_outbox` ADD `event_identity` varchar(255) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `transactional_outbox_event_identity_unique` ON `transactional_outbox` (`event_type`,`aggregate_type`,`aggregate_id`,`event_identity`);--> statement-breakpoint
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_deletion_waiting_days_check` CHECK (`tenant`.`deletion_waiting_days` IS NULL OR (`tenant`.`deletion_waiting_days` >= 1 AND `tenant`.`deletion_waiting_days` <= 365));