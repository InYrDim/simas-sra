import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../drizzle/20260731083635_expand-tenant-rbac-security/migration.sql",
  import.meta.url,
);
const emergencyOverlayMigrationUrl = new URL(
  "../../drizzle/20260805120000_persist-emergency-rbac-overlay/migration.sql",
  import.meta.url,
);

const expectedTables = [
  "school_admin_authority",
  "school_admin_proof",
  "security_audit_event",
  "security_audit_head",
  "security_command",
  "security_migration_checkpoint",
  "security_outbox",
  "security_reconciliation_finding",
  "tenant_account_lifecycle_case",
  "tenant_account_security",
  "tenant_rbac_rollout",
  "tenant_role",
  "tenant_role_assignment",
  "tenant_role_permission",
].sort();

test("RBAC persistence migration is additive and leaves legacy authorization storage intact", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const createdTables = [...sql.matchAll(/CREATE TABLE `([^`]+)`/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, expectedTables);
  assert.doesNotMatch(sql, /^(?:DROP|RENAME|TRUNCATE|DELETE|UPDATE)\b/im);
  assert.doesNotMatch(sql, /ALTER TABLE `(?:user|tenant|school_person|transactional_outbox)`/i);
  assert.doesNotMatch(sql, /ALTER TABLE `user`[^]*tenant_role/i);
  assert.match(sql, /CREATE TABLE `tenant_role`/);
  assert.match(sql, /CREATE TABLE `tenant_role_assignment`/);
  assert.match(sql, /CREATE TABLE `school_admin_authority`/);
  assert.match(sql, /CREATE TABLE `security_audit_event`/);
});

test("emergency overlay migration persists the complete body and enforces atomic cleanup", async () => {
  const sql = await readFile(emergencyOverlayMigrationUrl, "utf8");
  for (const column of [
    "overlay_policy_version",
    "overlay_denied_operation_ids",
    "overlay_denied_permission_keys",
    "overlay_deny_mutations",
    "overlay_review_at",
    "overlay_expires_at",
  ]) assert.match(sql, new RegExp("ADD COLUMN `" + column + "`"), column);
  assert.match(sql, /DROP CHECK `tenant_rbac_rollout_emergency_check`/);
  assert.match(sql, /overlay_hash` REGEXP '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(sql, /overlay_review_at` <= `overlay_expires_at`/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE `user`/i);
});

test("RBAC persistence migration carries the required MySQL integrity contracts", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const constraint of [
    "tenant_role_tenant_name_unique",
    "tenant_role_assignment_user_role_unique",
    "tenant_role_assignment_user_fkey",
    "tenant_role_assignment_role_fkey",
    "school_admin_authority_tenant_user_unique",
    "school_admin_authority_user_fkey",
    "school_admin_proof_pending_unique",
    "tenant_account_security_user_fkey",
    "tenant_account_case_pending_unique",
    "tenant_account_case_user_fkey",
    "security_audit_event_target_role_fkey",
    "security_audit_event_target_assignment_fkey",
    "security_audit_event_target_authority_fkey",
    "security_audit_event_target_proof_fkey",
    "security_audit_event_sequence_unique",
    "security_audit_event_key_unique",
    "security_command_idempotency_unique",
    "security_outbox_event_unique",
    "security_command_fingerprint_check",
    "security_migration_checkpoint_state_check",
    "security_reconciliation_user_scope_check",
  ]) {
    assert.match(sql, new RegExp(`\\b${constraint}\\b`), constraint);
  }

  assert.match(sql, /enum\('draft','active','archived'\)/);
  assert.match(sql, /enum\('active','suspended'\)/);
  assert.match(sql, /enum\('none','active','disabled'\)/);
  assert.match(sql, /enum\('pending','completed','expired','cancelled'\)/);
  assert.match(sql, /`http_mode` enum\('legacy','intersection','rbac','rbac-emergency'\)/);
  assert.match(sql, /`worker_mode` enum\('legacy','intersection','rbac','rbac-emergency'\)/);
  assert.match(sql, /`next_sequence` bigint unsigned/);
  assert.match(sql, /`previous_hash` varchar\(64\)/);
  assert.match(sql, /`event_hash` varchar\(64\)/);
  assert.match(sql, /permission_key` COLLATE utf8mb4_bin REGEXP/);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
});
