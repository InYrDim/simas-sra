CREATE TABLE `quiz_session` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `academic_year_id` varchar(36) NOT NULL,
  `subject_id` varchar(36) NOT NULL,
  `class_group_id` varchar(36) NOT NULL,
  `mode` enum('daring','luring') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` enum('draft','active','ended','graded') NOT NULL DEFAULT 'draft',
  `duration_minutes` int,
  `started_at` timestamp(3),
  `ended_at` timestamp(3),
  `version` int NOT NULL DEFAULT 1,
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(3) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_session_tenant_id_id_unique` (`tenant_id`,`id`),
  CONSTRAINT `quiz_session_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `quiz_session_tenant_year_fkey` FOREIGN KEY (`tenant_id`,`academic_year_id`) REFERENCES `academic_year` (`tenant_id`,`id`),
  CONSTRAINT `quiz_session_tenant_subject_fkey` FOREIGN KEY (`tenant_id`,`subject_id`) REFERENCES `subject` (`tenant_id`,`id`),
  CONSTRAINT `quiz_session_tenant_class_group_fkey` FOREIGN KEY (`tenant_id`,`class_group_id`) REFERENCES `class_group` (`tenant_id`,`id`),
  CONSTRAINT `quiz_session_version_check` CHECK (`version`>0)
);
CREATE INDEX `quiz_session_tenant_status_idx` ON `quiz_session` (`tenant_id`,`status`);
CREATE INDEX `quiz_session_tenant_class_group_idx` ON `quiz_session` (`tenant_id`,`class_group_id`);

CREATE TABLE `quiz_question` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` enum('multiple_choice','true_false','essay') NOT NULL,
  `options` json,
  `correct_answer` varchar(500),
  `points` int NOT NULL DEFAULT 1,
  `order_index` int NOT NULL DEFAULT 0,
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_question_tenant_id_id_unique` (`tenant_id`,`id`),
  CONSTRAINT `quiz_question_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `quiz_question_tenant_session_fkey` FOREIGN KEY (`tenant_id`,`session_id`) REFERENCES `quiz_session` (`tenant_id`,`id`),
  CONSTRAINT `quiz_question_points_check` CHECK (`points`>0)
);
CREATE INDEX `quiz_question_tenant_session_idx` ON `quiz_question` (`tenant_id`,`session_id`);

CREATE TABLE `quiz_answer_sheet` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `status` enum('in_progress','submitted','graded') NOT NULL DEFAULT 'in_progress',
  `total_score` int,
  `max_score` int,
  `submitted_at` timestamp(3),
  `graded_at` timestamp(3),
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(3) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_answer_sheet_tenant_id_id_unique` (`tenant_id`,`id`),
  UNIQUE KEY `quiz_answer_sheet_tenant_session_student_unique` (`tenant_id`,`session_id`,`student_id`),
  CONSTRAINT `quiz_answer_sheet_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `quiz_answer_sheet_tenant_session_fkey` FOREIGN KEY (`tenant_id`,`session_id`) REFERENCES `quiz_session` (`tenant_id`,`id`),
  CONSTRAINT `quiz_answer_sheet_tenant_student_fkey` FOREIGN KEY (`tenant_id`,`student_id`) REFERENCES `student_profile` (`tenant_id`,`id`)
);
CREATE INDEX `quiz_answer_sheet_tenant_session_idx` ON `quiz_answer_sheet` (`tenant_id`,`session_id`);

CREATE TABLE `quiz_answer` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `answer_sheet_id` varchar(36) NOT NULL,
  `question_id` varchar(36) NOT NULL,
  `answer_text` varchar(500),
  `is_correct` tinyint,
  `score` int,
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_answer_tenant_id_id_unique` (`tenant_id`,`id`),
  UNIQUE KEY `quiz_answer_sheet_question_unique` (`tenant_id`,`answer_sheet_id`,`question_id`),
  CONSTRAINT `quiz_answer_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `quiz_answer_tenant_sheet_fkey` FOREIGN KEY (`tenant_id`,`answer_sheet_id`) REFERENCES `quiz_answer_sheet` (`tenant_id`,`id`),
  CONSTRAINT `quiz_answer_tenant_question_fkey` FOREIGN KEY (`tenant_id`,`question_id`) REFERENCES `quiz_question` (`tenant_id`,`id`)
);
CREATE INDEX `quiz_answer_tenant_sheet_idx` ON `quiz_answer` (`tenant_id`,`answer_sheet_id`);
