CREATE TABLE `transactional_outbox` (
	`id` varchar(36) PRIMARY KEY,
	`event_type` varchar(100) NOT NULL,
	`aggregate_type` varchar(64) NOT NULL,
	`aggregate_id` varchar(36) NOT NULL,
	`payload` json NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	`published_at` timestamp(3),
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	CONSTRAINT `transactional_outbox_event_aggregate_unique` UNIQUE INDEX(`event_type`,`aggregate_type`,`aggregate_id`),
	CONSTRAINT `transactional_outbox_attempts_check` CHECK(`transactional_outbox`.`attempts` >= 0)
);
--> statement-breakpoint
CREATE INDEX `transactional_outbox_pending_idx` ON `transactional_outbox` (`published_at`,`occurred_at`);