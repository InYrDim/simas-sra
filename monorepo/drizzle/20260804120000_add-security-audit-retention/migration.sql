CREATE TABLE `security_audit_retention_policy` (
  `security_context_kind` enum('tenant','provider') NOT NULL,
  `context_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36),
  `provider_context_id` varchar(36),
  `retention_days` int NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `updated_at` timestamp(3) NOT NULL,
  CONSTRAINT `security_audit_retention_policy_partition_unique` UNIQUE (`security_context_kind`,`context_id`),
  CONSTRAINT `security_audit_retention_policy_days_check` CHECK (`retention_days` >= 0 AND `version` > 0),
  CONSTRAINT `security_audit_retention_policy_context_check` CHECK ((`security_context_kind` = 'tenant' AND `tenant_id` = `context_id` AND `provider_context_id` IS NULL) OR (`security_context_kind` = 'provider' AND `tenant_id` IS NULL AND `provider_context_id` = `context_id`)),

);
--> statement-breakpoint
CREATE TABLE `security_audit_legal_hold` (
  `id` varchar(36) PRIMARY KEY,
  `security_context_kind` enum('tenant','provider') NOT NULL,
  `context_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36),
  `provider_context_id` varchar(36),
  `case_id` varchar(128) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `state` enum('active','released') NOT NULL DEFAULT 'active',
  `created_at` timestamp(3) NOT NULL,
  `released_at` timestamp(3),
  CONSTRAINT `security_audit_legal_hold_case_unique` UNIQUE (`security_context_kind`,`context_id`,`case_id`),
  CONSTRAINT `security_audit_legal_hold_context_check` CHECK ((`security_context_kind` = 'tenant' AND `tenant_id` = `context_id` AND `provider_context_id` IS NULL) OR (`security_context_kind` = 'provider' AND `tenant_id` IS NULL AND `provider_context_id` = `context_id`)),
  CONSTRAINT `security_audit_legal_hold_release_check` CHECK ((`state` = 'active' AND `released_at` IS NULL) OR (`state` = 'released' AND `released_at` IS NOT NULL)),

);
--> statement-breakpoint
CREATE INDEX `security_audit_legal_hold_state_idx` ON `security_audit_legal_hold` (`security_context_kind`,`context_id`,`state`);
--> statement-breakpoint
CREATE TABLE `security_audit_retention_certificate` (
  `id` varchar(36) PRIMARY KEY,
  `security_context_kind` enum('tenant','provider') NOT NULL,
  `context_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36),
  `provider_context_id` varchar(36),
  `policy_version` int NOT NULL,
  `retention_days` int NOT NULL,
  `legal_hold` boolean NOT NULL,
  `tenant_deleted` boolean NOT NULL,
  `retained_count` int NOT NULL,
  `minimized_count` int NOT NULL,
  `disposal_eligible_count` int NOT NULL,
  `event_watermark` varchar(64) NOT NULL,
  `issued_at` timestamp(3) NOT NULL,
  CONSTRAINT `security_audit_retention_certificate_id_unique` UNIQUE (`security_context_kind`,`context_id`,`id`),
  CONSTRAINT `security_audit_retention_certificate_count_check` CHECK (`retention_days` >= 0 AND `policy_version` > 0 AND `retained_count` >= 0 AND `minimized_count` >= 0 AND `disposal_eligible_count` >= 0),
  CONSTRAINT `security_audit_retention_certificate_context_check` CHECK ((`security_context_kind` = 'tenant' AND `tenant_id` = `context_id` AND `provider_context_id` IS NULL) OR (`security_context_kind` = 'provider' AND `tenant_id` IS NULL AND `provider_context_id` = `context_id`)),

);
--> statement-breakpoint
CREATE INDEX `security_audit_retention_certificate_context_idx` ON `security_audit_retention_certificate` (`security_context_kind`,`context_id`,`issued_at`);
