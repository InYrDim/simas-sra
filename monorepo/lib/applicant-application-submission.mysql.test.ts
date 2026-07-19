import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createApplicantApplicationSubmission } from "@/lib/applicant-application-submission";
import { applicantApplicationSubmissionStore } from "@/lib/applicant-application-submission-data";
import { applicationDecisionStore } from "@/lib/application-decision-data";
import { createRejectSimasApplicationCommand } from "@/lib/provider-applications";

const databaseUrl = process.env.DATABASE_URL;
after(() => closeDatabasePool());
const mysqlTest = databaseUrl ? test : test.skip;
const input = { schoolName: "SMA Integration", npsn: "20888881", educationLevel: "SMA", address: "Jalan Integration 1", contactName: "Siti", contactPosition: "Kepala Sekolah", contactEmail: "siti-integration@example.test", contactWhatsapp: "081234567890" };

async function fixture() {
  const connection = await mysql.createConnection(databaseUrl!);
  const userIds = [randomUUID(), randomUUID()];
  const providerId = randomUUID();
  for (const [index, id] of userIds.entries()) {
    await connection.execute("INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, ?, ?, false, NOW(3), NOW(3))", [id, `Applicant ${index}`, `${id}@example.test`]);
    await connection.execute("INSERT INTO `applicant` (`user_id`, `created_at`) VALUES (?, NOW(3))", [id]);
  }
  await connection.execute("INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, 'Provider', ?, false, NOW(3), NOW(3))", [providerId, `${providerId}@example.test`]);
  await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW(3))", [providerId]);
  return {
    connection,
    userIds,
    providerId,
    async cleanup() {
      await connection.execute("DELETE FROM `simas_application` WHERE `owner_user_id` IN (?, ?)", userIds);
      await connection.execute("DELETE FROM `applicant_school_binding` WHERE `user_id` IN (?, ?)", userIds);
      await connection.execute("DELETE FROM `applicant` WHERE `user_id` IN (?, ?)", userIds);
      await connection.execute("DELETE FROM `provider_admin` WHERE `user_id` = ?", [providerId]);
      await connection.execute("DELETE FROM `user` WHERE `id` IN (?, ?, ?)", [...userIds, providerId]);
      await connection.end();
    },
  };
}

mysqlTest("MySQL permits one owner for a canonical NPSN under concurrent first submissions", async () => {
  const data = await fixture();
  try {
    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const results = await Promise.all([
      submit(data.userIds[0], `key-${randomUUID()}`, input),
      submit(data.userIds[1], `key-${randomUUID()}`, input),
    ]);

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && "code" in result && result.code === "npsn-conflict").length, 1);
    const [bindings] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `applicant_school_binding` WHERE `canonical_npsn` = ?", [input.npsn]);
    const [applications] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `id`, `attempt_number` FROM `simas_application` WHERE `owner_user_id` IN (?, ?)", data.userIds);
    assert.equal(bindings.length, 1);
    assert.deepEqual(applications.map((row) => row.attempt_number), [1]);
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL serializes different-key double submit to one pending application", async () => {
  const data = await fixture();
  try {
    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const secondInput = { ...input, npsn: "20888882" };
    const results = await Promise.all([
      submit(data.userIds[0], `key-${randomUUID()}`, secondInput),
      submit(data.userIds[0], `key-${randomUUID()}`, secondInput),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && "code" in result && result.code === "existing-pending").length, 1);
    const [applications] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `simas_application` WHERE `owner_user_id` = ? AND `status` = 'pending'", [data.userIds[0]]);
    assert.equal(applications.length, 1);
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL makes identical rejection retries idempotent and preserves the first decision", async () => {
  const data = await fixture();
  try {
    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const submitted = await submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888886" });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const reject = createRejectSimasApplicationCommand({
      authorize: async () => ({ userId: data.providerId }),
      store: applicationDecisionStore,
      now: () => new Date("2026-07-19T03:00:00Z"),
    });

    assert.deepEqual(await reject({ applicationId: submitted.applicationId, reason: "Data perlu diperbaiki" }), { ok: true, status: "rejected" });
    assert.deepEqual(await reject({ applicationId: submitted.applicationId, reason: " Data  perlu diperbaiki " }), { ok: true, status: "already-rejected" });
    assert.deepEqual(await reject({ applicationId: submitted.applicationId, reason: "Alasan berbeda" }), { ok: false, code: "decision-conflict", status: "rejected" });

    const [rows] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `status`, `rejection_reason`, `decided_by_provider_admin_id`, `decided_at` FROM `simas_application` WHERE `id` = ?", [submitted.applicationId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "rejected");
    assert.equal(rows[0].rejection_reason, "Data perlu diperbaiki");
    assert.equal(rows[0].decided_by_provider_admin_id, data.providerId);
    assert.equal(new Date(rows[0].decided_at).toISOString(), "2026-07-19T03:00:00.000Z");
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL serializes concurrent resubmission to one monotonic next attempt", async () => {
  const data = await fixture();
  try {
    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const first = await submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888887" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const reject = createRejectSimasApplicationCommand({ authorize: async () => ({ userId: data.providerId }), store: applicationDecisionStore });
    assert.equal((await reject({ applicationId: first.applicationId, reason: "Perbaiki data" })).ok, true);

    const results = await Promise.all([
      submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888887", address: "Alamat revisi A" }),
      submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888887", address: "Alamat revisi B" }),
    ]);

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && "code" in result && result.code === "existing-pending").length, 1);
    const [rows] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `attempt_number`, `status` FROM `simas_application` WHERE `owner_user_id` = ? ORDER BY `attempt_number`", [data.userIds[0]]);
    assert.deepEqual(rows.map((row) => [row.attempt_number, row.status]), [[1, "rejected"], [2, "pending"]]);
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL reject versus submit leaves one legal complete history", async () => {
  const data = await fixture();
  try {
    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const first = await submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888888" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const reject = createRejectSimasApplicationCommand({ authorize: async () => ({ userId: data.providerId }), store: applicationDecisionStore });

    const [rejection, resubmission] = await Promise.all([
      reject({ applicationId: first.applicationId, reason: "Perbaiki data" }),
      submit(data.userIds[0], `key-${randomUUID()}`, { ...input, npsn: "20888888", address: "Alamat revisi" }),
    ]);

    assert.equal(rejection.ok, true);
    assert.equal(resubmission.ok || ("code" in resubmission && resubmission.code === "existing-pending"), true);
    const [rows] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `attempt_number`, `status`, `rejection_reason` FROM `simas_application` WHERE `owner_user_id` = ? ORDER BY `attempt_number`", [data.userIds[0]]);
    assert.deepEqual([rows[0].attempt_number, rows[0].status, rows[0].rejection_reason], [1, "rejected", "Perbaiki data"]);
        assert.equal(rows.length, resubmission.ok ? 2 : 1);
        if (resubmission.ok) assert.deepEqual([rows[1].attempt_number, rows[1].status, rows[1].rejection_reason], [2, "pending", null]);
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL enforces unique user binding, attempt, idempotency, and pending binding", async () => {
  const data = await fixture();
  const bindingId = randomUUID();
  const insertApplication = "INSERT INTO `simas_application` (`id`, `school_name`, `npsn`, `education_level`, `address`, `contact_name`, `contact_position`, `contact_email`, `contact_whatsapp`, `status`, `submitted_at`, `decided_at`, `decided_by_provider_admin_id`, `rejection_reason`, `owner_user_id`, `binding_id`, `attempt_number`, `idempotency_key`, `payload_hash`) VALUES (?, 'SMA Integration', '20888884', 'SMA', 'Jalan Integration 1', 'Siti', 'Kepala Sekolah', 'siti@example.test', '+6281234567890', ?, NOW(3), ?, ?, ?, ?, ?, ?, ?, REPEAT('a', 64))";
  try {
    await data.connection.execute("INSERT INTO `applicant_school_binding` (`id`, `user_id`, `canonical_npsn`, `created_at`) VALUES (?, ?, '20888884', NOW(3))", [bindingId, data.userIds[0]]);
    await assert.rejects(data.connection.execute("INSERT INTO `applicant_school_binding` (`id`, `user_id`, `canonical_npsn`, `created_at`) VALUES (?, ?, '20888885', NOW(3))", [randomUUID(), data.userIds[0]]), /applicant_school_binding_user_id_unique/);

    await data.connection.execute(insertApplication, [randomUUID(), "rejected", new Date(), data.providerId, "Data perlu diperbaiki", data.userIds[0], bindingId, 1, "constraint-key-1"]);
    await assert.rejects(data.connection.execute(insertApplication, [randomUUID(), "rejected", new Date(), data.providerId, "Data perlu diperbaiki", data.userIds[0], bindingId, 1, "constraint-key-2"]), /simas_application_binding_attempt_unique/);
    await assert.rejects(data.connection.execute(insertApplication, [randomUUID(), "rejected", new Date(), data.providerId, "Data perlu diperbaiki", data.userIds[0], bindingId, 2, "constraint-key-1"]), /simas_application_owner_idempotency_unique/);

    await data.connection.execute(insertApplication, [randomUUID(), "pending", null, null, null, data.userIds[0], bindingId, 2, "constraint-key-2"]);
    await assert.rejects(data.connection.execute(insertApplication, [randomUUID(), "pending", null, null, null, data.userIds[0], bindingId, 3, "constraint-key-3"]), /simas_application_pending_binding_unique/);
  } finally { await data.cleanup(); }
});

mysqlTest("MySQL rolls back a new binding when application creation fails", async () => {
  const data = await fixture();
  try {
    await assert.rejects(applicantApplicationSubmissionStore.transaction(async (tx) => {
      await tx.createBinding({ id: randomUUID(), userId: data.userIds[0], canonicalNpsn: "20888883" });
      throw new Error("injected failure");
    }), /injected failure/);
    const [bindings] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `applicant_school_binding` WHERE `user_id` = ?", [data.userIds[0]]);
    assert.equal(bindings.length, 0);
  } finally { await data.cleanup(); }
});
