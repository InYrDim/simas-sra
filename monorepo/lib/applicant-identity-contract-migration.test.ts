import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../drizzle/20260719165658_happy_annihilus/migration.sql",
  import.meta.url,
);

test("contract migration removes legacy activation access and requires application identity", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /DROP VIEW `school_admin_activation`/);
  for (const column of [
    "owner_user_id",
    "binding_id",
    "attempt_number",
    "idempotency_key",
    "payload_hash",
  ]) {
    assert.match(
      migration,
      new RegExp("MODIFY COLUMN `" + column + "` [^;]+ NOT NULL"),
    );
  }
  assert.match(
    migration,
    /simas_application_attempt_number_check` CHECK \(`simas_application`\.`attempt_number` > 0\)/,
  );
});

test("contract migration does not recreate removed legacy contracts", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.doesNotMatch(migration, /CREATE VIEW `school_admin_activation`/);
  assert.doesNotMatch(migration, /CREATE TABLE `school_admin_activation`/);
});
