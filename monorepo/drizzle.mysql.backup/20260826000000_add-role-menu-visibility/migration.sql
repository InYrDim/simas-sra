CREATE TABLE `tenant_role_menu_visibility` (
	`tenant_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`menu_key` varchar(100) NOT NULL,
	`visible` boolean NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `tenant_role_menu_visibility_unique` UNIQUE INDEX(`tenant_id`,`role_id`,`menu_key`),
	CONSTRAINT `tenant_role_menu_visibility_role_fkey` FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`),
	CONSTRAINT `tenant_role_menu_visibility_role_idx` INDEX(`tenant_id`,`role_id`)
);
