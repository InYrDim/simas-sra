import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createApplicantApplicationSubmission } from "@/lib/applicant-application-submission";
import { applicantApplicationSubmissionStore } from "@/lib/applicant-application-submission-data";
import { applicationApprovalStore } from "@/lib/provider-application-data";
import { createApproveSimasApplicationCommand } from "@/lib/provider-applications";

const databaseUrl = process.env.DATABASE_URL;
after(() => closeDatabasePool());
const mysqlTest = databaseUrl ? test : test.skip;

mysqlTest("MySQL atomically promotes the existing applicant and makes identical approval retries idempotent", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ownerUserId = randomUUID();
  const providerUserId = randomUUID();
  const accountId = randomUUID();
  const sessionIds = [randomUUID(), randomUUID()];
  const credentialHash = "existing-password-hash";
  const canonicalNpsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  let applicationId: string | undefined;
  let tenantId: string | undefined;

  try {
    await connection.execute(
      "INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, 'Applicant Owner', ?, false, NOW(3), NOW(3)), (?, 'Provider', ?, false, NOW(3), NOW(3))",
      [ownerUserId, `${ownerUserId}@example.test`, providerUserId, `${providerUserId}@example.test`],
    );
    await connection.execute("INSERT INTO `applicant` (`user_id`, `created_at`) VALUES (?, NOW(3))", [ownerUserId]);
    await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW(3))", [providerUserId]);
    await connection.execute(
      "INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `created_at`, `updated_at`) VALUES (?, ?, 'credential', ?, ?, NOW(3), NOW(3))",
      [accountId, ownerUserId, ownerUserId, credentialHash],
    );
    for (const sessionId of sessionIds) {
      await connection.execute(
        "INSERT INTO `session` (`id`, `expires_at`, `token`, `created_at`, `updated_at`, `user_id`) VALUES (?, DATE_ADD(NOW(3), INTERVAL 1 DAY), ?, NOW(3), NOW(3), ?)",
        [sessionId, randomUUID(), ownerUserId],
      );
    }

    const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
    const submitted = await submit(ownerUserId, randomUUID(), {
      schoolName: "SMA Approval Integration",
      npsn: canonicalNpsn,
      educationLevel: "SMA",
      address: "Jalan Integration 14",
      contactName: "Snapshot Contact",
      contactPosition: "Operator",
      contactEmail: "different-contact@example.test",
      contactWhatsapp: "081234567890",
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    applicationId = submitted.applicationId;

    const approve = createApproveSimasApplicationCommand({
      authorize: async () => ({ userId: providerUserId }),
      store: applicationApprovalStore,
      now: () => new Date("2026-07-19T04:30:00.000Z"),
    });
    const approved = await approve({ applicationId, subdomain: " approval-integration " });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    tenantId = approved.tenantId;
    assert.equal(approved.status, "approved");
    assert.deepEqual(await approve({ applicationId, subdomain: "approval-integration" }), {
      ok: true,
      status: "already-approved",
      tenantId,
    });
    assert.deepEqual(await approve({ applicationId, subdomain: "different-domain" }), {
      ok: false,
      code: "decision-conflict",
      status: "approved",
    });

    const [owners] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `tenant_id`, `tenant_role` FROM `user` WHERE `id` = ?",
      [ownerUserId],
    );
    assert.deepEqual({ tenantId: owners[0].tenant_id, role: owners[0].tenant_role }, { tenantId, role: "school-admin" });

    const [accounts] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id`, `user_id`, `password` FROM `account` WHERE `user_id` = ?",
      [ownerUserId],
    );
    assert.deepEqual(accounts.map((row) => ({ id: row.id, userId: row.user_id, password: row.password })), [
      { id: accountId, userId: ownerUserId, password: credentialHash },
    ]);

    const [tenants] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id`, `npsn`, `domain`, `source_application_id` FROM `tenant` WHERE `source_application_id` = ?",
      [applicationId],
    );
    assert.deepEqual(tenants.map((row) => ({ id: row.id, npsn: row.npsn, domain: row.domain, sourceApplicationId: row.source_application_id })), [
      { id: tenantId, npsn: canonicalNpsn, domain: "approval-integration", sourceApplicationId: applicationId },
    ]);

    const [applicants] = await connection.execute<mysql.RowDataPacket[]>("SELECT `user_id` FROM `applicant` WHERE `user_id` = ?", [ownerUserId]);
    const [sessions] = await connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `session` WHERE `user_id` = ?", [ownerUserId]);
    const [bindings] = await connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `applicant_school_binding` WHERE `user_id` = ?", [ownerUserId]);
    const [activations] = await connection.execute<mysql.RowDataPacket[]>("SELECT `user_id` FROM `temporary_credential_activation` WHERE `user_id` = ?", [ownerUserId]);
    const [outbox] = await connection.execute<mysql.RowDataPacket[]>("SELECT `event_type`, `aggregate_id` FROM `transactional_outbox` WHERE `aggregate_id` = ?", [applicationId]);
    assert.equal(applicants.length, 0);
    assert.equal(sessions.length, 0);
    assert.equal(bindings.length, 1);
    assert.equal(activations.length, 0);
    assert.deepEqual(outbox.map((row) => ({ eventType: row.event_type, aggregateId: row.aggregate_id })), [
      { eventType: "simas.application.approved", aggregateId: applicationId },
    ]);
  } finally {
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
    if (applicationId) await connection.execute("DELETE FROM `transactional_outbox` WHERE `aggregate_id` = ?", [applicationId]);
    if (tenantId) await connection.execute("DELETE FROM `tenant` WHERE `id` = ?", [tenantId]);
    if (applicationId) await connection.execute("DELETE FROM `simas_application` WHERE `id` = ?", [applicationId]);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `session` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `account` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `applicant` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `provider_admin` WHERE `user_id` = ?", [providerUserId]);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?, ?)", [ownerUserId, providerUserId]);
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
    await connection.end();
  }
});
