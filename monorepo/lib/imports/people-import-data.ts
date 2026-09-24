import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { PeopleImportStore } from "@/lib/imports/people-import";
import { importIdentityFingerprint } from "@/lib/imports/people-import-review";
import {
  closeWorkerTenantAuthorizationPool,
  createWorkerTenantAuthorizationEvaluator,
} from "@/lib/authorization/tenant-authorization-worker-data";
import {
  peopleImportBatch,
  peopleImportDecision,
  peopleImportExecutionRow,
  peopleImportRevision,
  peopleImportRow,
  peopleImportValidationJob,
  tenant,
  tenantRbacRollout,
} from "@/db/schema";

async function validationAuthority(input: { domain: string; actorId?: string; rolloutEpoch?: string | null }) {
  if (!input.actorId || input.rolloutEpoch === null || input.rolloutEpoch === undefined) return false;
  const result = await createWorkerTenantAuthorizationEvaluator(input.actorId).evaluate({
    domain: input.domain,
    operationId: "people-imports.upload",
    surface: "worker",
    expectedRolloutEpoch: BigInt(input.rolloutEpoch),
  });
  return result.kind === "authorized";
}

export const peopleImportStore: PeopleImportStore = {
  async createBatch(input) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO people_import_batch (id,tenant_id,source_storage_key,source_byte_size,created_by_user_id,created_at) VALUES (${input.batchId},${input.tenantId},${input.storageKey},${input.byteSize},${input.actorId},now())`);
      await tx.execute(sql`INSERT INTO people_import_validation_job (id,tenant_id,batch_id,status,attempts,created_at) VALUES (${input.jobId},${input.tenantId},${input.batchId},'pending',0,now())`);
    });
    return { batchId: input.batchId, jobId: input.jobId };
  },

  async claimJob(workerId) {
    const result = await db.transaction(async (tx) => {
      const rowsResult = await tx.execute(sql`
        SELECT j.id, j.tenant_id, t.domain, j.batch_id, j.attempts, b.source_storage_key, b.created_by_user_id, rollout.epoch AS rollout_epoch
        FROM people_import_validation_job j
        JOIN people_import_batch b ON b.tenant_id = j.tenant_id AND b.id = j.batch_id
        JOIN tenant t ON t.id = j.tenant_id
        LEFT JOIN tenant_rbac_rollout rollout ON rollout.tenant_id = j.tenant_id
        WHERE (j.status = 'pending' AND j.available_at <= now())
           OR (j.status = 'processing' AND j.claimed_at < now() - interval '5 minutes')
        ORDER BY j.created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);
      const row = rowsResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return null;
      }

      if (!(await validationAuthority({ domain: String(row.domain), actorId: row.created_by_user_id ? String(row.created_by_user_id) : undefined, rolloutEpoch: row.rollout_epoch === null ? null : String(row.rollout_epoch) }))) {
        await tx.execute(sql`UPDATE people_import_validation_job SET status = 'failed', last_error_code = 'authority-revoked', claimed_by = NULL, claim_token = NULL WHERE id = ${row.id}`);
        return null;
      }

      const claimToken = randomUUID();
      await tx.execute(sql`
        UPDATE people_import_validation_job
        SET status = 'processing', attempts = attempts + 1, claimed_by = ${workerId}, claim_token = ${claimToken}, claimed_at = now()
        WHERE id = ${row.id}
          AND (status = 'pending' OR (status = 'processing' AND claimed_at < now() - interval '5 minutes'))
      `);

      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        domain: String(row.domain),
        batchId: String(row.batch_id),
        storageKey: String(row.source_storage_key),
        attempts: Number(row.attempts) + 1,
        actorId: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
        claimedBy: workerId,
        claimToken,
        rolloutEpoch: row.rollout_epoch === null ? null : String(row.rollout_epoch),
      } as const;
    });

    return result;
  },

  async completeValidation(input) {
    await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        SELECT status, claimed_by, claim_token
        FROM people_import_validation_job
        WHERE id = ${input.jobId} AND tenant_id = ${input.tenantId} AND batch_id = ${input.batchId}
        FOR UPDATE
      `);
      const jobRows = result.rows as Array<{ status: string; claimed_by: string | null; claim_token: string | null }>;
      const job = jobRows[0];

      if (!job) return;
      if (job.status === "completed") return;
      if (job.status !== "processing" || job.claimed_by !== input.claimedBy || job.claim_token !== input.claimToken) {
        throw new Error("Job is not claimed");
      }

      if (!(await validationAuthority({ domain: input.domain, actorId: input.actorId, rolloutEpoch: input.rolloutEpoch }))) {
        throw new Error("authority-revoked");
      }

      if (input.rows.length > 5000 || input.version !== "1.0.0" || new Set(input.rows.map((row) => row.rowNumber)).size !== input.rows.length) {
        throw new Error("invalid-batch");
      }

      for (const row of input.rows) {
        const validated = await import("@/lib/imports/people-import").then(m => m.validatePeopleImportValues(input.kind, row.values));
        if (JSON.stringify(row.values) !== JSON.stringify(validated.values) || JSON.stringify(row.findings) !== JSON.stringify(validated.findings) || row.state !== (validated.findings.some((finding) => finding.severity === "rejected") ? "rejected" : validated.findings.length ? "warning" : "ready")) {
          throw new Error("invalid-batch");
        }
      }

      const revisionId = randomUUID();
      await tx.execute(sql`INSERT INTO people_import_revision (id,tenant_id,batch_id,entity_kind,template_version,row_count) VALUES (${revisionId},${input.tenantId},${input.batchId},${input.kind},${input.version},${input.rows.length})`);

      for (const row of input.rows) {
        await tx.execute(sql`
          INSERT INTO people_import_row (id,tenant_id,revision_id,row_number,state,values_json,findings_json,identity_fingerprint,candidates_json)
          VALUES (${randomUUID()},${input.tenantId},${revisionId},${row.rowNumber},${row.state},${JSON.stringify(row.values)},${JSON.stringify(row.findings)},${importIdentityFingerprint(input.kind, row.values)},${JSON.stringify([])})
        `);
      }

      await tx.execute(sql`
        UPDATE people_import_validation_job
        SET status = 'completed', completed_at = now(), claimed_by = NULL, claim_token = NULL
        WHERE id = ${input.jobId} AND tenant_id = ${input.tenantId} AND claimed_by = ${input.claimedBy} AND claim_token = ${input.claimToken}
      `);
    });
  },

  async failJob(input) {
    // input.retryable must be interpolated as raw SQL — binding it as a parameter
    // makes Postgres see CASE WHEN $1 with an indeterminate type.
    const retryableFlag = sql.raw(input.retryable ? "true" : "false");
    const retryableStatus = sql.raw(input.retryable ? "'pending'" : "'failed'");
    await db.execute(sql`
      UPDATE people_import_validation_job
      SET status = ${retryableStatus},
          available_at = CASE WHEN ${retryableFlag}
            THEN now() + make_interval(mins => LEAST(attempts, 5))
            ELSE available_at END,
          last_error_code = ${input.code},
          claimed_by = NULL,
          claim_token = NULL
      WHERE id = ${input.jobId} AND tenant_id = ${input.tenantId} AND status = 'processing' AND claimed_by = ${input.claimedBy} AND claim_token = ${input.claimToken}
    `);
  },
};

export async function closePeopleImportPool() {
  // Pool managed globally via db/index.ts
  await closeWorkerTenantAuthorizationPool();
}
