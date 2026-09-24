CREATE TABLE `attendance_record` (
	`id` varchar(36) PRIMARY KEY,
	`tenant_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`layer` enum('gerbang','kelas') NOT NULL,
	`mode` enum('manual','qr','kartu') NOT NULL,
	`recorded_at` timestamp(3) NOT NULL,
	`status` enum('masuk','keluar','hadir','izin','sakit','alpa') NOT NULL,
	`recorded_by_user_id` varchar(36) NOT NULL,
	`notes` varchar(500),
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `attendance_record_tenant_id_id_unique` UNIQUE INDEX(`tenant_id`,`id`),
	CONSTRAINT `attendance_record_tenant_id_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`),
	CONSTRAINT `attendance_record_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile`(`tenant_id`,`id`),
	CONSTRAINT `attendance_record_tenant_actor_fkey` FOREIGN KEY (`tenant_id`,`recorded_by_user_id`) REFERENCES `user`(`tenant_id`,`id`),
	CONSTRAINT `attendance_record_version_check` CHECK(`attendance_record`.`version` > 0),
	CONSTRAINT `attendance_record_layer_status_check` CHECK((
        (`attendance_record`.`layer` = 'gerbang' AND `attendance_record`.`status` IN ('masuk', 'keluar'))
        OR (`attendance_record`.`layer` = 'kelas' AND `attendance_record`.`status` IN ('hadir', 'izin', 'sakit', 'alpa'))
      ))
);
--> statement-breakpoint
CREATE INDEX `attendance_record_tenant_student_layer_recorded_idx` ON `attendance_record` (`tenant_id`,`student_id`,`layer`,`recorded_at`);