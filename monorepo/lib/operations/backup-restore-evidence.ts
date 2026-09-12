import { createHash } from "node:crypto";

export const BACKUP_RESTORE_EVIDENCE_VERSION = "mysql-backup-restore-rehearsal@1";
export const DISPOSABLE_TARGET_ACKNOWLEDGEMENT = "I_ACKNOWLEDGE_THIS_DATABASE_IS_DISPOSABLE";
export const DISPOSABLE_DATABASE_PREFIX = "simas_restore_rehearsal_";

export type DatabaseIdentity = Readonly<{ host: string; port: number; database: string }>;
export type BackupRestoreInvariant = Readonly<{ name: string; source: string; restored: string; matched: boolean }>;
export type BackupRestoreEvidence = Readonly<{
  evidenceVersion: typeof BACKUP_RESTORE_EVIDENCE_VERSION;
  evidenceKind: "backup-restore-rehearsal";
  synthetic: boolean;
  runId: string;
  startedAt: string;
  completedAt: string;
  source: DatabaseIdentity;
  disposableTarget: DatabaseIdentity;
  artifact: Readonly<{ fileName: string; sha256: string; bytes: number }>;
  tools: Readonly<{ mysqldump: string; mysql: string }>;
  invariants: readonly BackupRestoreInvariant[];
  auditChainVerified: boolean;
  succeeded: boolean;
}>;

export type BackupRestorePlan = Readonly<{
  sourceUrl: URL;
  targetUrl: URL;
  source: DatabaseIdentity;
  target: DatabaseIdentity;
  outputDirectory: string;
}>;

const HASH = /^[a-f0-9]{64}$/;
const SECRET_KEY = /(password|passwd|secret|token|credential|database_url|mysql_pwd)/i;
const URL_CREDENTIAL = /:\/\/[^/\s:@]+:[^/\s@]+@/;

function databaseIdentity(url: URL): DatabaseIdentity {
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.protocol !== "mysql:" || !url.hostname || !database || !/^\d+$/.test(url.port || "3306")) throw new Error("invalid-mysql-url");
  return Object.freeze({ host: url.hostname, port: Number(url.port || "3306"), database });
}

function sameDatabase(left: DatabaseIdentity, right: DatabaseIdentity): boolean {
  return left.host.toLowerCase() === right.host.toLowerCase() && left.port === right.port && left.database.toLowerCase() === right.database.toLowerCase();
}

function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretKey);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => SECRET_KEY.test(key) || containsSecretKey(nested));
}

export function planBackupRestoreRehearsal(input: Readonly<{ sourceUrl: string; targetUrl: string; disposableAcknowledgement: string; outputDirectory: string }>): BackupRestorePlan {
  if (input.disposableAcknowledgement !== DISPOSABLE_TARGET_ACKNOWLEDGEMENT) throw new Error("disposable-target-acknowledgement-required");
  const sourceUrl = new URL(input.sourceUrl);
  const targetUrl = new URL(input.targetUrl);
  const source = databaseIdentity(sourceUrl);
  const target = databaseIdentity(targetUrl);
  if (sameDatabase(source, target)) throw new Error("source-and-target-must-differ");
  if (!target.database.startsWith(DISPOSABLE_DATABASE_PREFIX)) throw new Error("target-database-is-not-explicitly-disposable");
  if (!input.outputDirectory.trim()) throw new Error("output-directory-required");
  return Object.freeze({ sourceUrl, targetUrl, source, target, outputDirectory: input.outputDirectory });
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateBackupRestoreEvidence(value: unknown, options: Readonly<{ allowSynthetic?: boolean }> = {}): readonly string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["evidence-must-be-an-object"];
  const evidence = value as Partial<BackupRestoreEvidence>;
  if (evidence.evidenceVersion !== BACKUP_RESTORE_EVIDENCE_VERSION) errors.push("unsupported-evidence-version");
  if (evidence.evidenceKind !== "backup-restore-rehearsal") errors.push("invalid-evidence-kind");
  if (evidence.synthetic && !options.allowSynthetic) errors.push("synthetic-evidence-is-not-real-evidence");
  if (!evidence.runId || !evidence.startedAt || !evidence.completedAt) errors.push("run-identity-and-timestamps-required");
  if (!evidence.source || !evidence.disposableTarget) errors.push("database-identities-required");
  else {
    if (sameDatabase(evidence.source, evidence.disposableTarget)) errors.push("source-and-target-must-differ");
    if (!evidence.disposableTarget.database.startsWith(DISPOSABLE_DATABASE_PREFIX)) errors.push("target-database-is-not-explicitly-disposable");
  }
  if (!evidence.artifact || !HASH.test(evidence.artifact.sha256 ?? "") || !Number.isSafeInteger(evidence.artifact.bytes) || (evidence.artifact.bytes ?? 0) <= 0) errors.push("valid-artifact-hash-and-size-required");
  if (!evidence.invariants?.length || evidence.invariants.some((item) => !item.matched)) errors.push("all-restore-invariants-must-match");
  if (!evidence.auditChainVerified) errors.push("audit-chain-verification-required");
  if (!evidence.succeeded) errors.push("successful-rehearsal-required");
  const serialized = JSON.stringify(value);
  if (URL_CREDENTIAL.test(serialized) || containsSecretKey(value)) errors.push("evidence-must-not-contain-secrets");
  return Object.freeze(errors);
}

export function publicDatabaseIdentity(url: URL): DatabaseIdentity {
  return databaseIdentity(url);
}
