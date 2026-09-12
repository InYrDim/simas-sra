// Apply the people-import migrations to the dev DB (drizzle-kit push is blocked
// by an unrelated pre-existing class_group index drift). Idempotent: each
// statement is wrapped so existing objects are skipped.
//
// Run: pnpm exec tsx scripts/apply-people-import-migrations.ts

import "dotenv/config";
import { readFile } from "node:fs/promises";

import { closeDatabasePool, db } from "@/db";
import { sql } from "drizzle-orm";

const files = [
  "drizzle/20260720213000_add-people-import-validation/migration.sql",
  "drizzle/20260720230000_add-people-import-review/migration.sql",
  "drizzle/20260721010000_add-people-import-execution/migration.sql",
];

async function main() {
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      // Skip CREATE TABLE/INDEX if the object already exists; skip ALTER that
      // would re-add an existing column by attempting and ignoring 1060/1050.
      try {
        await db.execute(sql.raw(statement));
        console.log(`OK   ${file}: ${statement.slice(0, 70).replace(/\s+/g, " ")}`);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "ER_TABLE_EXISTS_ERROR" || code === "ER_DUP_KEYNAME" || code === "ER_DUP_FIELDNAME") {
          console.log(`SKIP ${file}: ${code} (already exists)`);
        } else {
          throw error;
        }
      }
    }
  }
  console.log("People-import migrations applied.");
}

main()
  .catch((error: unknown) => {
    console.error("Apply failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
