import "dotenv/config";

import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error(
    "DATABASE_URL is required for the School Admin lifecycle MySQL release test; skipped database tests are not a passing release gate.",
  );
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "lib/authorization/school-admin-lifecycle.mysql.test.ts"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
