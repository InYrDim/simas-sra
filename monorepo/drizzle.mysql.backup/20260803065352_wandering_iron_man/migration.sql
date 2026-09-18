CREATE TABLE `academic_operation_preview` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`operation_id` varchar(128) NOT NULL,
	`token_digest` varchar(64) NOT NULL,
	`intent_digest` varchar(64) NOT NULL,
	`normalized_intent` json NOT NULL,
	`state` enum('pending','committed','invalidated','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expires_at` timestamp(3) NOT NULL,
	`idempotency_key` varchar(128),
	`outcome` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`committed_at` timestamp(3),
	`invalidated_at` timestamp(3),
	CONSTRAINT `academic_preview_token_digest_unique` UNIQUE INDEX(`token_digest`),
	CONSTRAINT `academic_preview_actor_idempotency_unique` UNIQUE INDEX(`tenant_id`,`actor_user_id`,`idempotency_key`),
	CONSTRAINT `academic_operation_preview_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`),
	CONSTRAINT `academic_preview_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `user`(`tenant_id`,`id`)
);
--> statement-breakpoint
CREATE INDEX `academic_preview_tenant_state_expiry_idx` ON `academic_operation_preview` (`tenant_id`,`state`,`expires_at`);