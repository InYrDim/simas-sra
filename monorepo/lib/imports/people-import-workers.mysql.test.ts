import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { buildPeopleImportTemplate, createPeopleImportService, type ImportRow } from "@/lib/imports/people-import";
import { closePeopleImportPool, peopleImportStore } from "@/lib/imports/people-import-data";
import {
  closePeopleImportExecutionPool,
  confirmPeopleImportExecution,
  getPeopleImportExecution,
  peopleImportExecutionStore,
} from "@/lib/imports/people-import-execution-data";

import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

const url = process.env.DATABASE_URL;
const mysqlTest = url ? test : test.skip;
const id = () => randomUUID();

const validRow: ImportRow = {
  rowNumber: 2,
  state: "ready",
  values: {
    fullName: "Siswa Valid",
    birthPlace: "Palu",
    birthDate: "2010-01-01",
    gender: "female",
    street: "Jalan Valid",
    nis: "9001",
    entryDate: "2026-01-01",
  },
  findings: [],
};

async function applyMigrations(connection: mysql.Connection) {
  const files = [
    "20260720213000_add-people-import-validation/migration.sql",
    "20260720230000_add-people-import-review/migration.sql",
    "20260721010000_add-people-import-execution/migration.sql",
    "20260804000000_fence-people-import-worker-claims/migration.sql",
  ];
  for (const file of files) {
    const sql = await readFile(new URL(`../../drizzle/${file}`, import.meta.url), "utf8");
    for (const statement of sql.replaceAll("--> statement-breakpoint", "").split(";").map((item) => item.trim()).filter(Boolean)) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (![1050, 1060, 1061, 1359, 1826, 3822].includes((error as { errno?: number }).errno ?? 0)) throw error;
      }
    }
  }
}

type Fixture = {
  connection: mysql.Connection;
  tenantId: string;
  adminId: string;
  domain: string;
  principal: MasterDataPrincipal;
  batchId: string;
  revisionId: string;
  rowId: string;
  executionId?: string;
};

async function createFixture(connection: mysql.Connection, withExecutionRow = false): Promise<Fixture> {
  const tenantId = id(), adminId = id(), providerId = id(), bindingId = id(), applicationId = id();
  const batchId = id(), revisionId = id(), rowId = id(), domain = `people-worker-${id()}`;
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  await connection.execute("INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,'Worker Admin',?,false,NOW(3),NOW(3)),(?,'Worker Provider',?,false,NOW(3),NOW(3))", [adminId, `${adminId}@test.invalid`, providerId, `${providerId}@test.invalid`]);
  await connection.execute("INSERT INTO provider_admin(user_id,created_at) VALUES (?,NOW(3))", [providerId]);
  await connection.execute("INSERT INTO applicant_school_binding(id,user_id,canonical_npsn,created_at) VALUES (?,?,?,NOW(3))", [bindingId, adminId, npsn]);
  await connection.execute("INSERT INTO simas_application(id,school_name,npsn,education_level,address,contact_name,contact_position,contact_email,contact_whatsapp,status,submitted_at,owner_user_id,binding_id,attempt_number,idempotency_key,payload_hash) VALUES (?,'Worker Test',?,'SMA','A','K','O',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))", [applicationId, npsn, `${applicationId}@test.invalid`, adminId, bindingId, id()]);
  await connection.execute("INSERT INTO tenant(id,name,domain,npsn,source_application_id,approved_at,operational_status,settings,created_at,updated_at) VALUES (?,'Worker Test',?,?,?,NOW(3),'active',?,NOW(3),NOW(3))", [tenantId, domain, npsn, applicationId, JSON.stringify({ features: { masterData: true, masterDataRead: true, masterDataWrite: true, masterDataImportValidation: true, masterDataImportExecution: true } })]);
  await connection.execute("INSERT INTO tenant_rbac_rollout(tenant_id,http_mode,worker_mode,epoch,resolver_version,registry_version,operation_map_version,updated_at) VALUES (?,'legacy','legacy',1,'tenant-authorization@1','tenant-permissions@2','tenant-operations@4',NOW(3))", [tenantId]);
  await connection.execute("UPDATE simas_application SET status='approved',decided_at=NOW(3),decided_by_provider_admin_id=?,approved_tenant_id=? WHERE id=?", [providerId, tenantId, applicationId]);
  await connection.execute("UPDATE user SET tenant_id=?,tenant_role='school-admin' WHERE id=?", [tenantId, adminId]);
  await connection.execute("INSERT INTO school_admin_authority(id,tenant_id,user_id,authority_state,version,granted_at,created_at,updated_at) VALUES (?,?,?,'active',1,NOW(3),NOW(3),NOW(3))", [id(), tenantId, adminId]);
  await connection.execute("INSERT INTO people_import_batch(id,tenant_id,source_storage_key,source_byte_size,created_by_user_id,created_at) VALUES (?,?,CONCAT('tenants/',?,'/people-import/worker.xlsx'),1,?,NOW(3))", [batchId, tenantId, tenantId, adminId]);
  await connection.execute("INSERT INTO people_import_revision(id,tenant_id,batch_id,entity_kind,template_version,row_count) VALUES (?,?,?,'student','1.0.0',1)", [revisionId, tenantId, batchId]);
  await connection.execute("INSERT INTO people_import_row(id,tenant_id,revision_id,`row_number`,state,values_json,findings_json,identity_fingerprint,candidates_json) VALUES (?,?,?,2,'ready',?,'[]',REPEAT('w',64),'[]')", [rowId, tenantId, revisionId, JSON.stringify(validRow.values)]);
  const principal: MasterDataPrincipal = { userId: adminId, tenantId, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
  const fixture: Fixture = { connection, tenantId, adminId, domain, principal, batchId, revisionId, rowId };
  if (withExecutionRow) {
    const confirmation = await confirmPeopleImportExecution(principal, revisionId, [rowId], 30);
    assert.equal(confirmation.ok, true);
    if (!confirmation.ok) throw new Error("execution fixture confirmation failed");
    fixture.executionId = confirmation.executionId;
  }
  return fixture;
}

async function cleanupFixture(fixture: Fixture) {
  const { connection, tenantId, adminId } = fixture;
  for (const trigger of ["people_import_test_audit_failure", "people_import_test_crash", "people_import_test_success_failure"]) await connection.query(`DROP TRIGGER IF EXISTS ${trigger}`);
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  await connection.execute("DELETE FROM transactional_outbox WHERE aggregate_type='people-import-execution' AND payload->>'$.tenantId'=?", [tenantId]);
  for (const table of ["people_import_audit", "people_import_success", "people_import_execution_row", "people_import_execution", "people_import_control", "people_import_row", "people_import_revision", "people_import_validation_job", "people_import_batch", "student_lifecycle_period", "student_audit", "student_profile", "school_person"]) await connection.execute(`DELETE FROM \`${table}\` WHERE tenant_id=?`, [tenantId]);
  await connection.execute("DELETE FROM school_admin_authority WHERE tenant_id=?", [tenantId]);
  await connection.execute("UPDATE user SET tenant_id=NULL,tenant_role=NULL WHERE id=?", [adminId]);
  await connection.execute("DELETE FROM tenant_rbac_rollout WHERE tenant_id=?", [tenantId]);
  await connection.execute("DELETE FROM tenant WHERE id=?", [tenantId]);
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

async function validationFixture(connection: mysql.Connection) {
  const fixture = await createFixture(connection);
  const service = createPeopleImportService({
    store: peopleImportStore,
    storage: {
      async write() {},
      async read() { return await buildPeopleImportTemplate("student"); },
      async remove() {},
    },
  });
  const upload = await service.upload(fixture.principal, await buildPeopleImportTemplate("student"));
  assert.equal(upload.ok, true);
  if (!upload.ok) throw new Error("validation fixture upload failed");
  return { fixture, service, job: await peopleImportStore.claimJob("validation-fixture") };
}

mysqlTest("validation rejects an invalid batch item and completes the same job on retry", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, service, job } = await validationFixture(connection);
  try {
    assert.ok(job);
    if (!job) return;
    await assert.rejects(() => peopleImportStore.completeValidation({ jobId: job.id, ...job, domain: fixture.domain, kind: "student", version: "1.0.0", rows: [{ ...validRow, state: "ready", values: { ...validRow.values, birthDate: "not-a-date" } }] }), /invalid-batch/);
    const [beforeRetry] = await connection.query<mysql.RowDataPacket[]>("SELECT COUNT(*) revisions FROM people_import_revision WHERE tenant_id=? AND batch_id=?", [fixture.tenantId, job.batchId]);
    assert.equal(Number(beforeRetry[0].revisions), 0);
    await peopleImportStore.failJob({ jobId: job.id, tenantId: job.tenantId, claimedBy: job.claimedBy, claimToken: job.claimToken, code: "validation-failed", retryable: true });
    await connection.execute("UPDATE people_import_validation_job SET available_at=NOW(3) WHERE id=?", [job.id]);
    assert.equal(await service.runNext("validation-retry"), true);
    const [afterRetry] = await connection.query<mysql.RowDataPacket[]>("SELECT status FROM people_import_validation_job WHERE id=?", [job.id]);
    assert.equal(afterRetry[0].status, "completed");
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

mysqlTest("validation rejects stale process version and rollout epoch inside completion transaction", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, job } = await validationFixture(connection);
  try {
    assert.ok(job);
    if (!job) return;
    await connection.execute("UPDATE tenant_rbac_rollout SET resolver_version='unknown-worker-version' WHERE tenant_id=?", [fixture.tenantId]);
    await assert.rejects(() => peopleImportStore.completeValidation({ jobId: job.id, ...job, domain: fixture.domain, kind: "student", version: "1.0.0", rows: [] }), /authority-revoked/);
    await connection.execute("UPDATE tenant_rbac_rollout SET resolver_version='tenant-authorization@1',epoch=epoch+1 WHERE tenant_id=?", [fixture.tenantId]);
    await assert.rejects(() => peopleImportStore.completeValidation({ jobId: job.id, ...job, domain: fixture.domain, kind: "student", version: "1.0.0", rows: [] }), /authority-revoked/);
    const [revisions] = await connection.query<mysql.RowDataPacket[]>("SELECT COUNT(*) count FROM people_import_revision WHERE tenant_id=? AND batch_id=?", [fixture.tenantId, job.batchId]);
    assert.equal(Number(revisions[0].count), 0);
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

mysqlTest("validation crash boundary fences the old claimant and lets the retry claimant complete", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, service, job } = await validationFixture(connection);
  try {
    assert.ok(job);
    if (!job) return;
    await connection.execute("UPDATE people_import_validation_job SET claimed_at=DATE_SUB(NOW(3),INTERVAL 6 MINUTE) WHERE id=?", [job.id]);
    const retryJob = await peopleImportStore.claimJob("validation-crash-retry");
    assert.ok(retryJob);
    if (!retryJob) return;
    await assert.rejects(() => peopleImportStore.completeValidation({ jobId: job.id, ...job, domain: fixture.domain, kind: "student", version: "1.0.0", rows: [validRow] }), /Job is not claimed/);
    await peopleImportStore.completeValidation({ jobId: retryJob.id, ...retryJob, domain: fixture.domain, kind: "student", version: "1.0.0", rows: [] });
    const [revisions] = await connection.query<mysql.RowDataPacket[]>("SELECT COUNT(*) count FROM people_import_revision WHERE tenant_id=? AND batch_id=?", [fixture.tenantId, job.batchId]);
    assert.equal(Number(revisions[0].count), 1);
    assert.equal(await service.runNext("validation-after-reclaim"), false);
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

async function claimedExecutionFixture(connection: mysql.Connection) {
  const fixture = await createFixture(connection, true);
  const claim = await peopleImportExecutionStore.claimNext("execution-fixture");
  assert.ok(claim);
  if (!claim) throw new Error("execution fixture claim failed");
  return { fixture, claim };
}

mysqlTest("execution audit failure rolls back domain, success, audit, and outbox writes", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, claim } = await claimedExecutionFixture(connection);
  try {
    await connection.execute("INSERT INTO people_import_audit(id,tenant_id,execution_id,row_id,actor_user_id,outcome,person_id,profile_id,occurred_at) VALUES (?,?,?,?,?,'created',?,?,NOW(3))", [id(), fixture.tenantId, fixture.executionId!, fixture.rowId, fixture.adminId, id(), id()]);
    await assert.rejects(() => peopleImportExecutionStore.executeRow(claim), /Duplicate entry/);
    const [state] = await connection.query<mysql.RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM school_person WHERE tenant_id=?) people,(SELECT COUNT(*) FROM student_profile WHERE tenant_id=?) profiles,(SELECT COUNT(*) FROM people_import_success WHERE tenant_id=?) successes,(SELECT COUNT(*) FROM people_import_audit WHERE tenant_id=?) audits,(SELECT COUNT(*) FROM transactional_outbox WHERE aggregate_type='people-import-execution' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.tenantId'))=?) outbox", [fixture.tenantId, fixture.tenantId, fixture.tenantId, fixture.tenantId, fixture.tenantId]);
    assert.deepEqual(state[0], { people: 0, profiles: 0, successes: 0, audits: 1, outbox: 0 });
    await peopleImportExecutionStore.recordFailure(claim, new Error("audit failure"));
    assert.equal((await getPeopleImportExecution(fixture.tenantId, fixture.executionId!))?.counts.failed, 1);
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

mysqlTest("execution crash boundary fences the old claimant and lets the retry claimant finish", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, claim } = await claimedExecutionFixture(connection);
  try {
    await connection.execute("UPDATE people_import_execution_row SET claimed_at=DATE_SUB(NOW(3),INTERVAL 6 MINUTE) WHERE tenant_id=? AND execution_id=? AND row_id=?", [fixture.tenantId, claim.executionId, claim.rowId]);
    const retryClaim = await peopleImportExecutionStore.claimNext("execution-crash-retry");
    assert.ok(retryClaim);
    if (!retryClaim) return;
    await peopleImportExecutionStore.executeRow(claim);
    const [stillPending] = await connection.query<mysql.RowDataPacket[]>("SELECT outcome FROM people_import_execution_row WHERE tenant_id=? AND execution_id=? AND row_id=?", [fixture.tenantId, claim.executionId, claim.rowId]);
    assert.equal(stillPending[0].outcome, null);
    await peopleImportExecutionStore.executeRow(retryClaim);
    const result = await getPeopleImportExecution(fixture.tenantId, fixture.executionId!);
    assert.equal(result?.counts.created, 1);
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

mysqlTest("execution rejects invalid stored batch items without creating a profile", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, claim } = await claimedExecutionFixture(connection);
  try {
    await connection.execute("UPDATE people_import_row SET values_json=? WHERE id=?", [JSON.stringify({ ...validRow.values, birthDate: "not-a-date" }), fixture.rowId]);
    await assert.rejects(() => peopleImportExecutionStore.executeRow(claim), /row-invalid/);
    await peopleImportExecutionStore.recordFailure(claim, new Error("row-invalid"));
    const [state] = await connection.query<mysql.RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM school_person WHERE tenant_id=?) people,(SELECT COUNT(*) FROM student_profile WHERE tenant_id=?) profiles", [fixture.tenantId, fixture.tenantId]);
    assert.deepEqual(state[0], { people: 0, profiles: 0 });
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

mysqlTest("execution rejects stale process version and epoch captured at claim time", async () => {
  const connection = await mysql.createConnection(url!);
  await applyMigrations(connection);
  const { fixture, claim } = await claimedExecutionFixture(connection);
  try {
    await connection.execute("UPDATE tenant_rbac_rollout SET resolver_version='unknown-worker-version' WHERE tenant_id=?", [fixture.tenantId]);
    await assert.rejects(() => peopleImportExecutionStore.executeRow(claim), /authority-revoked/);
    await peopleImportExecutionStore.recordFailure(claim, new Error("authority-revoked"));
    const second = await createFixture(connection, true);
    const secondClaim = await peopleImportExecutionStore.claimNext("epoch-worker");
    assert.ok(secondClaim);
    await connection.execute("UPDATE tenant_rbac_rollout SET resolver_version='tenant-authorization@1',epoch=epoch+1 WHERE tenant_id=?", [second.tenantId]);
    if (secondClaim) {
      await assert.rejects(() => peopleImportExecutionStore.executeRow(secondClaim), /authority-revoked/);
      await peopleImportExecutionStore.recordFailure(secondClaim, new Error("authority-revoked"));
    }
    await cleanupFixture(second);
  } finally { await cleanupFixture(fixture); await connection.end(); }
});

after(async () => { await closePeopleImportPool(); await closePeopleImportExecutionPool(); });
