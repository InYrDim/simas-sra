ALTER TABLE `tenant_rbac_rollout`
  DROP CHECK `tenant_rbac_rollout_emergency_check`,
  ADD COLUMN `overlay_policy_version` varchar(64),
  ADD COLUMN `overlay_denied_operation_ids` json,
  ADD COLUMN `overlay_denied_permission_keys` json,
  ADD COLUMN `overlay_deny_mutations` boolean,
  ADD COLUMN `overlay_review_at` timestamp(3),
  ADD COLUMN `overlay_expires_at` timestamp(3);
--> statement-breakpoint
ALTER TABLE `tenant_rbac_rollout`
  ADD CONSTRAINT `tenant_rbac_rollout_emergency_check` CHECK ((
    `http_mode` = 'rbac-emergency' AND `worker_mode` = 'rbac-emergency'
    AND `overlay_hash` REGEXP '^[a-f0-9]{64}$'
    AND `overlay_policy_version` IS NOT NULL
    AND `overlay_denied_operation_ids` IS NOT NULL
    AND `overlay_denied_permission_keys` IS NOT NULL
    AND `overlay_deny_mutations` IS NOT NULL
    AND `overlay_review_at` IS NOT NULL
    AND `overlay_expires_at` IS NOT NULL
    AND `overlay_review_at` <= `overlay_expires_at`
  ) OR (
    `http_mode` <> 'rbac-emergency' AND `worker_mode` <> 'rbac-emergency'
    AND `overlay_hash` IS NULL
    AND `overlay_policy_version` IS NULL
    AND `overlay_denied_operation_ids` IS NULL
    AND `overlay_denied_permission_keys` IS NULL
    AND `overlay_deny_mutations` IS NULL
    AND `overlay_review_at` IS NULL
    AND `overlay_expires_at` IS NULL
  ));
