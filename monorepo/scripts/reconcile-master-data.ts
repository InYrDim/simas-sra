import "dotenv/config";

import { readFile } from "node:fs/promises";

import {
  reconcileMasterData,
  type ReconciliationSnapshot,
} from "@/lib/master-data-reconciliation";

async function main() {
  const snapshotPath = process.argv[2];
  if (!snapshotPath) {
    throw new Error(
      "Usage: pnpm db:reconcile:master-data <read-only-snapshot.json>",
    );
  }

  const snapshot = JSON.parse(
    await readFile(snapshotPath, "utf8"),
  ) as ReconciliationSnapshot;
  const report = reconcileMasterData(snapshot);

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    "Master Data reconciliation failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
