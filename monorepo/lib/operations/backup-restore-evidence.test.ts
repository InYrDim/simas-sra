import assert from "node:assert/strict";
import test from "node:test";

import { BACKUP_RESTORE_EVIDENCE_VERSION, DISPOSABLE_TARGET_ACKNOWLEDGEMENT, planBackupRestoreRehearsal, validateBackupRestoreEvidence } from "@/lib/operations/backup-restore-evidence";

const valid = {
  evidenceVersion: BACKUP_RESTORE_EVIDENCE_VERSION, evidenceKind: "backup-restore-rehearsal", synthetic: false,
  runId: "rehearsal-20260805", startedAt: "2026-08-05T10:00:00.000Z", completedAt: "2026-08-05T10:10:00.000Z",
  source: { host: "db.internal", port: 3306, database: "simas" },
  disposableTarget: { host: "restore.internal", port: 3306, database: "simas_restore_rehearsal_20260805" },
  artifact: { fileName: "backup.sql", sha256: "a".repeat(64), bytes: 4096 },
  tools: { mysqldump: "8.4", mysql: "8.4" },
  invariants: [{ name: "tenant-count", source: "12", restored: "12", matched: true }], auditChainVerified: true, succeeded: true,
} as const;

test("rehearsal plan requires a distinct explicitly disposable restore target", () => {
  const plan = planBackupRestoreRehearsal({ sourceUrl: "mysql://source-user:source-pass@db.internal/simas", targetUrl: "mysql://restore-user:restore-pass@restore.internal/simas_restore_rehearsal_20260805", disposableAcknowledgement: DISPOSABLE_TARGET_ACKNOWLEDGEMENT, outputDirectory: ".operational-evidence" });
  assert.deepEqual(plan.source, { host: "db.internal", port: 3306, database: "simas" });
  assert.deepEqual(plan.target, { host: "restore.internal", port: 3306, database: "simas_restore_rehearsal_20260805" });
  assert.throws(() => planBackupRestoreRehearsal({ sourceUrl: "mysql://u:p@db/simas", targetUrl: "mysql://u:p@db/simas", disposableAcknowledgement: DISPOSABLE_TARGET_ACKNOWLEDGEMENT, outputDirectory: "out" }), /source-and-target-must-differ/);
  assert.throws(() => planBackupRestoreRehearsal({ sourceUrl: "mysql://u:p@db/simas", targetUrl: "mysql://u:p@db/production", disposableAcknowledgement: DISPOSABLE_TARGET_ACKNOWLEDGEMENT, outputDirectory: "out" }), /not-explicitly-disposable/);
});

test("real evidence requires successful matched restore checks and no synthetic claim", () => {
  assert.deepEqual(validateBackupRestoreEvidence(valid), []);
  assert.deepEqual(validateBackupRestoreEvidence({ ...valid, synthetic: true }), ["synthetic-evidence-is-not-real-evidence"]);
  assert.ok(validateBackupRestoreEvidence({ ...valid, auditChainVerified: false, invariants: [{ ...valid.invariants[0], matched: false }] }).includes("all-restore-invariants-must-match"));
});

test("evidence rejects credential-bearing fields and URLs", () => {
  assert.ok(validateBackupRestoreEvidence({ ...valid, password: "do-not-store" }).includes("evidence-must-not-contain-secrets"));
  assert.ok(validateBackupRestoreEvidence({ ...valid, source: { ...valid.source, host: "mysql://user:pass@db" } }).includes("evidence-must-not-contain-secrets"));
  assert.ok(validateBackupRestoreEvidence({ ...valid, metadata: { nested: { accessToken: "do-not-store" } } }).includes("evidence-must-not-contain-secrets"));
});
