CREATE TABLE `whatsapp_bot_connection` (
	`tenant_id` varchar(36) NOT NULL,
	`openwa_session_id` varchar(36) NOT NULL,
	`openwa_session_name` varchar(128) NOT NULL,
	`openwa_webhook_id` varchar(64) NOT NULL,
	`status` enum('connected','error') NOT NULL DEFAULT 'connected',
	`bot_phone` varchar(32),
	`bot_push_name` varchar(255),
	`last_error` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_bot_connection_tenant_unique` UNIQUE INDEX(`tenant_id`),
	CONSTRAINT `whatsapp_bot_connection_session_id_unique` UNIQUE INDEX(`openwa_session_id`),
	CONSTRAINT `whatsapp_bot_connection_session_name_unique` UNIQUE INDEX(`openwa_session_name`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_bot_message` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`openwa_message_id` varchar(128) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`event` varchar(64) NOT NULL DEFAULT 'message.received',
	`direction` enum('inbound') NOT NULL DEFAULT 'inbound',
	`chat_id` varchar(32) NOT NULL,
	`from_wa` varchar(32) NOT NULL,
	`to_wa` varchar(32),
	`body` text,
	`message_type` varchar(32),
	`has_media` boolean NOT NULL DEFAULT false,
	`is_group` boolean NOT NULL DEFAULT false,
	`kind` varchar(32),
	`metadata` json,
	`message_timestamp` bigint,
	`received_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_bot_message_tenant_idempotency_unique` UNIQUE INDEX(`tenant_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `whatsapp_bot_connection_tenant_status_idx` ON `whatsapp_bot_connection` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_bot_message_tenant_received_idx` ON `whatsapp_bot_message` (`tenant_id`,`received_at`);--> statement-breakpoint
ALTER TABLE `whatsapp_bot_connection` ADD CONSTRAINT `whatsapp_bot_connection_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`);