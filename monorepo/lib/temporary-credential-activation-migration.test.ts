import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../drizzle/20260719020711_glamorous_peter_quill/migration.sql",
  import.meta.url,
);

test("temporary credential activation migration preserves legacy rows in place", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /RENAME TABLE `school_admin_activation` TO `temporary_credential_activation`/,
  );
  assert.doesNotMatch(migration, /INSERT INTO `temporary_credential_activation`/);
  assert.doesNotMatch(migration, /CREATE TABLE `temporary_credential_activation`/);
});

test("temporary credential activation migration keeps old rollout writers compatible", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /CREATE VIEW `school_admin_activation` AS/);
  for (const column of [
    "user_id",
    "tenant_id",
    "temporary_credential_issued_at",
    "first_authenticated_at",
    "password_change_required",
    "password_changed_at",
  ]) {
    assert.ok(migration.includes("`" + column + "`"));
  }
});
