import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../drizzle/20260720030107_clammy_katie_power/migration.sql",
  import.meta.url,
);

test("Tenant operational expansion remains compatible with legacy rows and writers", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /ADD `operational_status` enum\('active','closed'\);/);
  assert.match(migration, /ADD `reconciliation_status` enum\('not_required','needs_reconciliation'\);/);
  assert.match(migration, /ADD `deletion_waiting_days` int;/);
  assert.doesNotMatch(migration, /ADD `operational_status`[^;]+NOT NULL/);
  assert.doesNotMatch(migration, /INSERT INTO `?tenant`?/);
  assert.doesNotMatch(migration, /closure|deletion_schedule/i);
  assert.match(migration, /deletion_waiting_days` >= 1/);
  assert.match(migration, /deletion_waiting_days` <= 365/);
});

test("expansion persists resumable observability and scopes repeated outbox events", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE `tenant_operational_migration_checkpoint`/);
  for (const column of [
    "last_tenant_id",
    "examined_count",
    "migrated_count",
    "reconciliation_count",
    "access_difference_count",
    "completed_at",
  ]) assert.match(migration, new RegExp("`" + column + "`"));

  assert.match(migration, /ADD `event_identity` varchar\(255\) DEFAULT 'legacy' NOT NULL/);
  assert.match(migration, /transactional_outbox_event_identity_unique[^\n]+`event_identity`/);
});
