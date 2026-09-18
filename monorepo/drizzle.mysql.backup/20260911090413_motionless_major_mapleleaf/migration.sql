CREATE TABLE `whatsapp_bot_request` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`requested_phone` varchar(16) NOT NULL,
	`desired_session_name` varchar(50),
	`pic_name` varchar(128) NOT NULL,
	`note` text,
	`status` enum('pending','approved','fulfilled','rejected') NOT NULL DEFAULT 'pending',
	`provider_note` text,
	`resolution_method` enum('self_service','provider'),
	`openwa_session_id` varchar(36),
	`resolved_at` timestamp(3),
	`resolved_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_bot_request_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`)
);
--> statement-breakpoint
CREATE INDEX `whatsapp_bot_request_tenant_status_idx` ON `whatsapp_bot_request` (`tenant_id`,`status`);