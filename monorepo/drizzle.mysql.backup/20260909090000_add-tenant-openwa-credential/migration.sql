CREATE TABLE `tenant_openwa_credential` (
	`tenant_id` varchar(36) PRIMARY KEY NOT NULL,
	`api_base_url` varchar(255),
	`api_key_ciphertext` varchar(512) NOT NULL,
	`session_key` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_openwa_credential_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE no action ON UPDATE no action
);