CREATE TABLE `quiz_attendance` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `status` enum('present','absent','late') NOT NULL,
  `notes` varchar(500),
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_attendance_tenant_id_id_unique` (`tenant_id`,`id`),
  UNIQUE KEY `quiz_attendance_tenant_session_student_unique` (`tenant_id`,`session_id`,`student_id`),
  CONSTRAINT `quiz_attendance_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `quiz_attendance_tenant_session_fkey` FOREIGN KEY (`tenant_id`,`session_id`) REFERENCES `quiz_session` (`tenant_id`,`id`),
  CONSTRAINT `quiz_attendance_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile` (`tenant_id`,`id`)
);
CREATE INDEX `quiz_attendance_tenant_session_idx` ON `quiz_attendance` (`tenant_id`,`session_id`);
