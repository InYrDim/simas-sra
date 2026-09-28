import "dotenv/config";

import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

import { BACKUP_RESTORE_EVIDENCE_VERSION, DISPOSABLE_TARGET_ACKNOWLEDGEMENT, planBackupRestoreRehearsal, sha256, validateBackupRestoreEvidence, type BackupRestoreEvidence, type DatabaseIdentity } from "@/lib/operations/backup-restore-evidence";

const sourceUrl = process.env.BACKUP_SOURCE_DATABASE_URL;
const targetUrl = process.env.RESTORE_TARGET_DATABASE_URL;
const acknowledgement = process.env.BACKUP_RESTORE_DISPOSABLE_TARGET;
const evidenceRoot = resolve(process.cwd(), ".operational-evidence");
const requestedDirectory = resolve(evidenceRoot, process.env.BACKUP_RESTORE_RUN_NAME ?? "latest");
if (!requestedDirectory.startsWith(`${evidenceRoot}${sep}`)) throw new Error("Evidence output must remain under .operational-evidence");
if (!sourceUrl || !targetUrl) throw new Error("BACKUP_SOURCE_DATABASE_URL and RESTORE_TARGET_DATABASE_URL are required");

function mysqlArgs(url: URL): string[] {
  return [`--host=${url.hostname}`, `--port=${url.port || "3306"}`, `--user=${decodeURIComponent(url.username)}`, "--protocol=TCP", "--default-character-set=utf8mb4", decodeURIComponent(url.pathname.slice(1))];
}

function safeChildEnv(url: URL): NodeJS.ProcessEnv {
  return { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) };
}

async function runToFile(command: string, args: readonly string[], env: NodeJS.ProcessEnv, output: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const destination = createWriteStream(output, { flags: "wx", mode: 0o600 });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000); });
    child.stdout.pipe(destination);
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} failed with exit code ${code}: ${stderr.replace(/:\/\/[^@\s]+@/g, "://[redacted]@")} `)));
  });
}

async function runFromFile(command: string, args: readonly string[], env: NodeJS.ProcessEnv, input: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000); });
    createReadStream(input).pipe(child.stdin);
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} failed with exit code ${code}: ${stderr.replace(/:\/\/[^@\s]+@/g, "://[redacted]@")} `)));
  });
}

async function scalar(connection: Connection, query: string): Promise<string> {
  const [rows] = await connection.query<(RowDataPacket & { value: string | number | bigint })[]>(query);
  return String(rows[0]?.value ?? "0");
}

async function snapshot(connection: Connection): Promise<Readonly<Record<string, string>>> {
  return Object.freeze({
    tenants: await scalar(connection, "SELECT COUNT(*) value FROM tenant"),
    rolloutRows: await scalar(connection, "SELECT COUNT(*) value FROM tenant_rbac_rollout"),
    auditEvents: await scalar(connection, "SELECT COUNT(*) value FROM security_audit_event"),
    auditEndpointMismatches: await scalar(connection, "SELECT COUNT(*) value FROM security_audit_head h WHERE h.next_sequence <> COALESCE((SELECT MAX(e.sequence)+1 FROM security_audit_event e WHERE e.security_context_kind=h.security_context_kind AND e.context_id=h.context_id),1) OR h.head_hash <> COALESCE((SELECT e.event_hash FROM security_audit_event e WHERE e.security_context_kind=h.security_context_kind AND e.context_id=h.context_id ORDER BY e.sequence DESC LIMIT 1),REPEAT('0',64))"),
  });
}

async function targetIsEmpty(connection: Connection, identity: DatabaseIdentity): Promise<boolean> {
  const [rows] = await connection.execute<(RowDataPacket & { value: number })[]>("SELECT COUNT(*) value FROM information_schema.tables WHERE table_schema=?", [identity.database]);
  return Number(rows[0]?.value ?? 0) === 0;
}

async function main(): Promise<void> {
  const plan = planBackupRestoreRehearsal({ sourceUrl: sourceUrl!, targetUrl: targetUrl!, disposableAcknowledgement: acknowledgement ?? "", outputDirectory: requestedDirectory });
  if (acknowledgement !== DISPOSABLE_TARGET_ACKNOWLEDGEMENT) throw new Error("Disposable target acknowledgement is required");
  await mkdir(requestedDirectory, { recursive: true, mode: 0o700 });
  const source = await mysql.createConnection({ uri: sourceUrl! });
  const target = await mysql.createConnection({ uri: targetUrl! });
  const startedAt = new Date();
  const runId = randomUUID();
  const dumpPath = resolve(requestedDirectory, `${runId}.sql`);
  try {
    if (!await targetIsEmpty(target, plan.target)) throw new Error("Disposable restore target must contain zero tables before rehearsal");
    const before = await snapshot(source);
    await runToFile("mysqldump", ["--single-transaction", "--routines", "--triggers", "--set-gtid-purged=OFF", ...mysqlArgs(plan.sourceUrl)], safeChildEnv(plan.sourceUrl), dumpPath);
    await runFromFile("mysql", mysqlArgs(plan.targetUrl), safeChildEnv(plan.targetUrl), dumpPath);
    const after = await snapshot(target);
    const bytes = await readFile(dumpPath);
    const invariants = Object.entries(before).map(([name, sourceValue]) => ({ name, source: sourceValue, restored: after[name] ?? "missing", matched: sourceValue === after[name] }));
    const evidence: BackupRestoreEvidence = {
      evidenceVersion: BACKUP_RESTORE_EVIDENCE_VERSION, evidenceKind: "backup-restore-rehearsal", synthetic: false, runId,
      startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(), source: plan.source, disposableTarget: plan.target,
      artifact: { fileName: basename(dumpPath), sha256: sha256(bytes), bytes: bytes.byteLength }, tools: { mysqldump: "system-path", mysql: "system-path" },
      invariants, auditChainVerified: after.auditEndpointMismatches === "0", succeeded: invariants.every((item) => item.matched) && after.auditEndpointMismatches === "0",
    };
    const errors = validateBackupRestoreEvidence(evidence);
    const evidencePath = resolve(requestedDirectory, `${runId}.evidence.json`);
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ succeeded: errors.length === 0, evidencePath: evidencePath.slice(process.cwd().length + 1), errors }, null, 2));
    if (errors.length > 0) process.exitCode = 1;
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: "backup-restore-rehearsal-failed", message: error instanceof Error ? error.message.replace(/:\/\/[^@\s]+@/g, "://[redacted]@") : "unknown-error" }));
  process.exitCode = 1;
});
