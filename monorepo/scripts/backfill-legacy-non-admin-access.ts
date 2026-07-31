import "dotenv/config";

import { randomUUID } from "node:crypto";

import { closeDatabasePool } from "@/db";
import {
  runLegacyNonAdminBackfillPass,
  verifyLegacyNonAdminBackfill,
} from "@/lib/authorization/legacy-non-admin-backfill-data";

const batchSize = 100;
const command = process.argv[2] ?? "backfill";
const force = process.argv.includes("--force");

async function backfillRun() {
  const runId = randomUUID();
  let examined = 0;
  let migrated = 0;
  let findings = 0;
  let blockingFindings = 0;
  for (;;) {
    const pass = await runLegacyNonAdminBackfillPass({ batchSize, runId, force });
    examined = pass.examined;
    migrated = pass.migrated;
    findings = pass.findings;
    blockingFindings = pass.blockingFindings;
    if (pass.done) break;
  }
  console.info({
    event: "legacy_non_admin_backfill_completed",
    runId,
    examined,
    migrated,
    findings,
    blockingFindings,
  });
  if (blockingFindings > 0) process.exitCode = 1;
}

async function verifyRun() {
  const verification = await verifyLegacyNonAdminBackfill();
  console.info({
    event: "legacy_non_admin_backfill_verify",
    equivalent: verification.equivalent,
    contractDigest: verification.contractDigest,
    registryVersion: verification.registryVersion,
    operationMapVersion: verification.operationMapVersion,
    watermark: verification.watermark,
    evaluatedUserCount: verification.evaluatedUserCount,
    roleCount: verification.roleCount,
    assignmentCount: verification.assignmentCount,
    mismatchedRoleCount: verification.mismatchedRoleIds.length,
    widenedTupleCount: verification.widened.length,
    narrowedTupleCount: verification.narrowed.length,
  });
  if (!verification.equivalent) {
    console.error({
      event: "legacy_non_admin_backfill_mismatch",
      mismatchedRoleIds: verification.mismatchedRoleIds,
      widened: verification.widened,
      narrowed: verification.narrowed,
    });
    process.exitCode = 1;
  }
}

async function main() {
  try {
    if (command === "backfill") await backfillRun();
    else if (command === "verify") await verifyRun();
    else {
      console.error({ event: "legacy_non_admin_backfill_usage", usage: "backfill | verify [--force]" });
      process.exitCode = 2;
    }
  } finally {
    await closeDatabasePool();
  }
}

void main();
