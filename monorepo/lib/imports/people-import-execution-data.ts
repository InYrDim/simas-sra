import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { buildExecutionConfirmation, type ClaimedExecutionRow, type ExecutionOutcome, type ExecutionRow, type PeopleImportExecutionStore } from "@/lib/imports/people-import-execution";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";
import { validatePeopleImportValues, type PeopleImportKind } from "@/lib/imports/people-import";
import { closeWorkerTenantAuthorizationPool, createWorkerTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-worker-data";
import {
  peopleImportBatch,
  peopleImportExecution,
  peopleImportExecutionRow,
  peopleImportRevision,
  peopleImportRow,
  peopleImportSuccess,
  peopleImportAudit,
  peopleImportControl,
  tenant,
  user,
  schoolAdminAuthority,
  transactionalOutbox,
} from "@/db/schema";

const json = <T>(value: unknown): T => (typeof value === "string" ? (JSON.parse(value) as T) : (value as T));
export const peopleImportRetentionDays = (environment: Record<string, string | undefined> = process.env) => {
  const n = Number(environment.PEOPLE_IMPORT_FILE_RETENTION_DAYS);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const SAFE_ERROR_CODES = new Set(["authority-revoked", "row-invalid", "profile-identifier-conflict", "match-decision-required", "match-ineligible", "validation-failed"]);

export async function confirmPeopleImportExecution(principal: MasterDataPrincipal, revisionId: string, selectedRowIds: string[], retentionDays = peopleImportRetentionDays()) {
  if (!principal.capabilities.write) return { ok: false, code: "read-only" } as const;
  if (!retentionDays) return { ok: false, code: "retention-not-configured" } as const;
  return await db.transaction(async (tx) => {
    const revisionResult = await tx.execute(sql`
      SELECT r.id, r.batch_id, r.created_at, b.read_only_at
      FROM people_import_revision r
      JOIN people_import_batch b ON b.tenant_id = r.tenant_id AND b.id = r.batch_id
      WHERE r.tenant_id = ${principal.tenantId} AND r.id = ${revisionId}
      FOR UPDATE
    `);
    const revision = revisionResult.rows[0] as { id: string; batch_id: string; read_only_at: Date } | undefined;
    if (!revision) return { ok: false, code: "not-found" } as const;
    if (new Date(revision.read_only_at) <= new Date()) return { ok: false, code: "read-only" } as const;

    const rawResult = await tx.execute(sql`
      SELECT r.id, r.row_number, r.state, d.action, d.target_person_id
      FROM people_import_row r
      LEFT JOIN people_import_decision d ON d.tenant_id = r.tenant_id AND d.revision_id = r.revision_id AND d.row_id = r.id
      WHERE r.tenant_id = ${principal.tenantId} AND r.revision_id = ${revisionId}
    `);
    const rows: ExecutionRow[] = (rawResult.rows as Array<{ id: string; row_number: number; state: string; action: string | null; target_person_id: string | null }>).map((r) => ({
      id: r.id,
      rowNumber: r.row_number,
      state: r.state as ExecutionRow["state"],
      decision: r.action ? { action: r.action as NonNullable<ExecutionRow["decision"]>["action"], targetPersonId: r.target_person_id ?? undefined } as ExecutionRow["decision"] : null,
    }));
    let confirmation;
    try {
      confirmation = buildExecutionConfirmation(revisionId, rows, selectedRowIds);
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "invalid" } as const;
    }

    const executionId = randomUUID();
    await tx.execute(sql`
      INSERT INTO people_import_execution (id, tenant_id, batch_id, revision_id, row_set_hash, selected_count, actor_user_id)
      VALUES (${executionId}, ${principal.tenantId}, ${revision.batch_id}, ${revisionId}, ${confirmation.rowSetHash}, ${confirmation.selectedRowIds.length}, ${principal.userId})
      ON CONFLICT (tenant_id, batch_id, revision_id, row_set_hash) DO NOTHING
    `);
    const existingResult = await tx.execute(sql`
      SELECT id FROM people_import_execution WHERE tenant_id = ${principal.tenantId} AND batch_id = ${revision.batch_id} AND revision_id = ${revisionId} AND row_set_hash = ${confirmation.rowSetHash}
    `);
    const existing = existingResult.rows[0] as { id: string } | undefined;
    const id = existing ? existing.id : executionId;

    for (const row of rows.filter((r) => confirmation.selectedRowIds.includes(r.id))) {
      const action = row.state === "rejected" ? "reject" : row.decision?.action === "skip" ? "skip" : row.decision?.action === "link" ? "link" : "create";
      await tx.execute(sql`
        INSERT INTO people_import_execution_row (id, tenant_id, execution_id, revision_id, row_id, planned_action, target_person_id)
        VALUES (${randomUUID()}, ${principal.tenantId}, ${id}, ${revisionId}, ${row.id}, ${action}, ${row.decision?.action === "link" ? row.decision.targetPersonId : null})
        ON CONFLICT (tenant_id, execution_id, row_id) DO NOTHING
      `);
    }
    return { ok: true, executionId: id, confirmation } as const;
  });
}

async function insertProfile(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], kind: string, tenantId: string, personId: string, profileId: string, v: Record<string, string>, actorId: string) {
  const now = new Date();
  if (kind === "student") {
    await tx.execute(sql`
      INSERT INTO student_profile (id, tenant_id, person_id, nis, normalized_nis, nisn, entry_date, status, archived, version, created_at, updated_at)
      VALUES (${profileId}, ${tenantId}, ${personId}, ${v.nis}, ${v.nis.toLowerCase()}, ${v.nisn || null}, ${v.entryDate}, 'active', false, 1, ${now}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO student_lifecycle_period (id, tenant_id, student_id, status, started_at, reason, created_by_user_id, created_at)
      VALUES (${randomUUID()}, ${tenantId}, ${profileId}, ${v.entryDate}, 'Impor awal', ${actorId}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO student_audit (id, tenant_id, person_id, student_id, actor_user_id, operation, from_person_version, to_person_version, from_student_version, to_student_version, lifecycle_after, occurred_at)
      VALUES (${randomUUID()}, ${tenantId}, ${personId}, ${profileId}, ${actorId}, 'created-student', 0, 1, 0, 1, ${JSON.stringify({ status: "active", startedAt: v.entryDate })}, ${now})
    `);
  } else if (kind === "teacher") {
    await tx.execute(sql`
      INSERT INTO teacher_profile (id, tenant_id, person_id, teacher_number, normalized_teacher_number, nuptk, employment_type, service_start_date, status, archived, version, created_at, updated_at)
      VALUES (${profileId}, ${tenantId}, ${personId}, ${v.teacherNumber}, ${v.teacherNumber.toLowerCase()}, ${v.nuptk || null}, ${v.employmentType}, ${v.serviceStartDate}, 'active', false, 1, ${now}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO teacher_service_period (id, tenant_id, teacher_id, status, started_at, reason, created_by_user_id, created_at)
      VALUES (${randomUUID()}, ${tenantId}, ${profileId}, ${v.serviceStartDate}, 'Impor awal', ${actorId}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO teacher_audit (id, tenant_id, person_id, teacher_id, actor_user_id, operation, from_person_version, to_person_version, from_teacher_version, to_teacher_version, lifecycle_after, occurred_at)
      VALUES (${randomUUID()}, ${tenantId}, ${personId}, ${profileId}, ${actorId}, 'created-teacher', 0, 1, 0, 1, ${JSON.stringify({ status: "active", startedAt: v.serviceStartDate })}, ${now})
    `);
  } else {
    await tx.execute(sql`
      INSERT INTO staff_profile (id, tenant_id, person_id, staff_number, normalized_staff_number, position, employment_type, service_start_date, status, archived, version, created_at, updated_at)
      VALUES (${profileId}, ${tenantId}, ${personId}, ${v.staffNumber}, ${v.staffNumber.toLowerCase()}, ${v.position}, ${v.employmentType}, ${v.serviceStartDate}, 'active', false, 1, ${now}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO staff_service_period (id, tenant_id, staff_id, status, started_at, reason, created_by_user_id, created_at)
      VALUES (${randomUUID()}, ${tenantId}, ${profileId}, ${v.serviceStartDate}, 'Impor awal', ${actorId}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO staff_position_assignment (id, tenant_id, staff_id, position, started_at, created_by_user_id, created_at)
      VALUES (${randomUUID()}, ${tenantId}, ${profileId}, ${v.position}, ${v.serviceStartDate}, ${actorId}, ${now})
    `);
    await tx.execute(sql`
      INSERT INTO staff_audit (id, tenant_id, person_id, staff_id, actor_user_id, operation, from_person_version, to_person_version, from_staff_version, to_staff_version, lifecycle_after, occurred_at)
      VALUES (${randomUUID()}, ${tenantId}, ${personId}, ${profileId}, ${actorId}, 'created-staff', 0, 1, 0, 1, ${JSON.stringify({ status: "active", startedAt: v.serviceStartDate })}, ${now})
    `);
  }
}

async function insertExecutionOutbox(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], x: Record<string, unknown>, outcome: string) {
  await tx.execute(sql`
    INSERT INTO transactional_outbox (id, event_type, aggregate_type, aggregate_id, event_identity, payload, occurred_at)
    VALUES (${randomUUID()}, 'people-import.row.completed', 'people-import-execution', ${x.execution_id}, ${`row:${x.row_id}`}, ${JSON.stringify({ tenantId: x.tenant_id, executionId: x.execution_id, rowId: x.row_id, outcome })}, now())
    ON CONFLICT (event_type, aggregate_type, aggregate_id, event_identity) DO NOTHING
  `);
}

export const peopleImportExecutionStore: PeopleImportExecutionStore = {
  async checkEmergencyStop() {
    return false;
  },
  async claimNext(workerId: string) {
    return await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        SELECT er.execution_id, er.tenant_id, t.domain, er.revision_id, er.row_id, e.actor_user_id, rollout.epoch AS rollout_epoch
        FROM people_import_execution_row er
        JOIN people_import_execution e ON e.tenant_id = er.tenant_id AND e.id = er.execution_id
        JOIN tenant t ON t.id = er.tenant_id
        LEFT JOIN people_import_control ctl ON ctl.tenant_id = er.tenant_id
        LEFT JOIN tenant_rbac_rollout rollout ON rollout.tenant_id = er.tenant_id
        WHERE er.outcome IS NULL
          AND (er.claimed_at IS NULL OR er.claimed_at < now() - interval '5 minutes')
          AND COALESCE(ctl.emergency_stop, false) = false
        ORDER BY e.created_at, er.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);
      const row = result.rows[0] as { execution_id: string; tenant_id: string; domain: string; revision_id: string; row_id: string; actor_user_id: string; rollout_epoch: number | null } | undefined;
      if (!row) return null;

      const claimToken = randomUUID();
      await tx.execute(sql`
        UPDATE people_import_execution_row
        SET claimed_by = ${workerId}, claim_token = ${claimToken}, claimed_at = now()
        WHERE tenant_id = ${row.tenant_id} AND execution_id = ${row.execution_id} AND row_id = ${row.row_id}
          AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes')
      `);
      await tx.execute(sql`
        UPDATE people_import_execution
        SET status = 'processing'
        WHERE tenant_id = ${row.tenant_id} AND id = ${row.execution_id} AND status = 'queued'
      `);
      return {
        executionId: row.execution_id,
        tenantId: row.tenant_id,
        domain: row.domain,
        revisionId: row.revision_id,
        rowId: row.row_id,
        actorId: row.actor_user_id,
        claimedBy: workerId,
        claimToken,
        rolloutEpoch: row.rollout_epoch === null ? null : String(row.rollout_epoch),
      } as ClaimedExecutionRow;
    });
  },
  async executeRow(claim: ClaimedExecutionRow) {
    return await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        SELECT er.*, e.batch_id, e.actor_user_id, pr.entity_kind, t.domain,
               source_row.values_json, source_row.state,
               t.operational_status, t.trial_ends_at, t.settings,
               u.tenant_role, u.tenant_id AS user_tenant,
               (SELECT COUNT(*) FROM school_admin_authority saa WHERE saa.user_id = u.id AND saa.tenant_id = er.tenant_id) AS authority_count,
               (SELECT COUNT(*) FROM school_admin_authority saa WHERE saa.user_id = u.id AND saa.tenant_id = er.tenant_id AND saa.authority_state = 'active') AS active_authority_count
        FROM people_import_execution_row er
        JOIN people_import_execution e ON e.tenant_id = er.tenant_id AND e.id = er.execution_id
        JOIN people_import_revision pr ON pr.tenant_id = er.tenant_id AND pr.id = er.revision_id
        JOIN people_import_row source_row ON source_row.tenant_id = er.tenant_id AND source_row.id = er.row_id
        JOIN tenant t ON t.id = er.tenant_id
        JOIN "user" u ON u.id = e.actor_user_id
        WHERE er.tenant_id = ${claim.tenantId} AND er.execution_id = ${claim.executionId} AND er.row_id = ${claim.rowId}
          AND (er.claimed_by = ${claim.claimedBy ?? null} OR ${claim.claimedBy ?? null} IS NULL)
          AND (er.claim_token = ${claim.claimToken ?? null} OR ${claim.claimToken ?? null} IS NULL)
        FOR UPDATE
      `);
      const x = result.rows[0] as {
        id: string;
        tenant_id: string;
        execution_id: string;
        revision_id: string;
        row_id: string;
        entity_kind: string;
        planned_action: string | null;
        target_person_id: string | null;
        outcome: string | null;
        error_code: string | null;
        claimed_by: string | null;
        claim_token: string | null;
        batch_id: string;
        actor_user_id: string;
        values_json: unknown;
        state: string;
        domain: string;
        operational_status: string | null;
        trial_ends_at: Date | null;
        settings: unknown;
        tenant_role: string;
        user_tenant: string;
      } | undefined;
      if (!x || x.outcome) return;

      const profileModule = x.entity_kind === "student" ? "students" : x.entity_kind === "teacher" ? "teachers" : "staff";
      const requiredPermissions = [
        "people-imports.revisions.execute",
        ...(x.planned_action === "create"
          ? ["people.people.create", `${profileModule}.${profileModule}.create`]
          : x.planned_action === "link"
            ? ["people.people.update", `${profileModule}.${profileModule}.update`]
            : []),
      ];
      const authorization = await createWorkerTenantAuthorizationEvaluator(String(x.actor_user_id)).evaluate({
        domain: String(x.domain),
        operationId: "people-imports.execute",
        surface: "worker",
        requestedPermissions: requiredPermissions,
        expectedRolloutEpoch: claim.rolloutEpoch === null || claim.rolloutEpoch === undefined ? undefined : BigInt(claim.rolloutEpoch),
      });
      if (authorization.kind !== "authorized") throw new Error("authority-revoked");

      if (x.planned_action === "skip" || x.planned_action === "reject") {
        const terminalOutcome = x.planned_action === "skip" ? "skipped" : "rejected";
        await insertExecutionOutbox(tx, x, terminalOutcome);
        await tx.execute(sql`
          UPDATE people_import_execution_row SET outcome = ${terminalOutcome}, completed_at = now()
          WHERE id = ${x.id}
        `);
        await finish(tx, x);
        return;
      }

      const successResult = await tx.execute(sql`
        SELECT id FROM people_import_success WHERE tenant_id = ${x.tenant_id} AND batch_id = ${x.batch_id} AND revision_id = ${x.revision_id} AND row_id = ${x.row_id}
      `);
      if (successResult.rows[0]) {
        await insertExecutionOutbox(tx, x, "already-committed");
        await tx.execute(sql`
          UPDATE people_import_execution_row SET outcome = 'already-committed', completed_at = now()
          WHERE id = ${x.id}
        `);
        await finish(tx, x);
        return;
      }

      const validated = validatePeopleImportValues(x.entity_kind as PeopleImportKind, json<Record<string, string>>(x.values_json));
      if (validated.findings.length) throw new Error("row-invalid");
      const v = validated.values;
      const kind = x.entity_kind as PeopleImportKind;
      const profileTable = kind === "student" ? "student_profile" : kind === "teacher" ? "teacher_profile" : "staff_profile";
      const numberColumn = kind === "student" ? "normalized_nis" : kind === "teacher" ? "normalized_teacher_number" : "normalized_staff_number";
      const numberValue = (kind === "student" ? v.nis : kind === "teacher" ? v.teacherNumber : v.staffNumber).toLocaleLowerCase("id-ID");
      const secondaryColumn = kind === "student" ? "nisn" : kind === "teacher" ? "nuptk" : null;
      const secondaryValue = kind === "student" ? v.nisn : kind === "teacher" ? v.nuptk : null;

      const duplicateMatch = secondaryColumn && secondaryValue
        ? sql`${sql.raw(numberColumn)} = ${numberValue} OR ${sql.raw(secondaryColumn)} = ${secondaryValue}`
        : sql`${sql.raw(numberColumn)} = ${numberValue}`;
      const duplicateResult = await tx.execute(sql`
        SELECT id FROM ${sql.raw(profileTable)}
        WHERE tenant_id = ${x.tenant_id} AND (${duplicateMatch})
        FOR UPDATE
      `);
      if ((duplicateResult.rows as Array<{ id: string }>).length) throw new Error("profile-identifier-conflict");

      // The OR chain must stay parenthesized and scoped inside tenant_id —
      // otherwise identity matches cross the tenant boundary.
      const identityMatch = sql.join(
        [
          sql`profile.${sql.raw(numberColumn)} = ${numberValue}`,
          ...(v.nik ? [sql`p.nik = ${v.nik}`] : []),
          ...(v.nip ? [sql`p.nip = ${v.nip}`] : []),
          ...(secondaryColumn && secondaryValue ? [sql`profile.${sql.raw(secondaryColumn)} = ${secondaryValue}`] : []),
        ],
        sql` OR `,
      );
      const exactPeopleResult = await tx.execute(sql`
        SELECT DISTINCT p.id
        FROM school_person p
        LEFT JOIN ${sql.raw(profileTable)} profile ON profile.tenant_id = p.tenant_id AND profile.person_id = p.id
        WHERE p.tenant_id = ${x.tenant_id} AND (${identityMatch})
        FOR UPDATE
      `);
      const exactPeople = exactPeopleResult.rows as Array<{ id: string }>;

      const similarResult = await tx.execute(sql`
        SELECT id FROM school_person WHERE tenant_id = ${x.tenant_id} AND archived = false AND normalized_name = ${v.fullName.toLocaleLowerCase("id-ID")} AND normalized_birth_place = ${v.birthPlace.toLocaleLowerCase("id-ID")} AND birth_date = ${v.birthDate} AND gender = ${v.gender}
        FOR UPDATE
      `);
      const similar = similarResult.rows as Array<{ id: string }>;

      const personId = x.planned_action === "link" ? String(x.target_person_id ?? "") : randomUUID();
      if (x.planned_action === "link") {
        const personResult = await tx.execute(sql`
          SELECT p.id, p.archived, profile.id AS profile_id
          FROM school_person p
          LEFT JOIN ${sql.raw(profileTable)} profile ON profile.tenant_id = p.tenant_id AND profile.person_id = p.id
          WHERE p.tenant_id = ${x.tenant_id} AND p.id = ${personId}
          FOR UPDATE
        `);
        const target = personResult.rows[0] as { id: string; archived: boolean; profile_id: string | null } | undefined;
        if (
          !target || target.archived || target.profile_id ||
          exactPeople.length > 1 || (exactPeople.length === 1 && exactPeople[0].id !== personId) ||
          !similar.some((row) => row.id === personId)
        ) {
          throw new Error("match-ineligible");
        }
      } else {
        if (exactPeople.length) throw new Error("match-decision-required");
        if (x.state !== "warning" && similar.length) throw new Error("match-decision-required");
        await tx.execute(sql`
          INSERT INTO school_person (id, tenant_id, full_name, normalized_name, birth_place, normalized_birth_place, birth_date, gender, nik, nip, street, archived, version, created_at, updated_at)
          VALUES (${personId}, ${x.tenant_id}, ${v.fullName}, ${v.fullName.toLocaleLowerCase("id-ID")}, ${v.birthPlace}, ${v.birthPlace.toLocaleLowerCase("id-ID")}, ${v.birthDate}, ${v.gender}, ${v.nik || null}, ${v.nip || null}, ${v.street}, false, 1, now(), now())
        `);
      }

      const profileId = randomUUID();
      await insertProfile(tx, kind, x.tenant_id, personId, profileId, v, x.actor_user_id);
      const outcome: ExecutionOutcome = x.planned_action === "link" ? "linked" : "created";
      await tx.execute(sql`
        INSERT INTO people_import_success (id, tenant_id, batch_id, revision_id, row_id, execution_id, outcome, person_id, profile_id)
        VALUES (${randomUUID()}, ${x.tenant_id}, ${x.batch_id}, ${x.revision_id}, ${x.row_id}, ${x.execution_id}, ${outcome}, ${personId}, ${profileId})
      `);
      await tx.execute(sql`
        INSERT INTO people_import_audit (id, tenant_id, execution_id, row_id, actor_user_id, outcome, person_id, profile_id, occurred_at)
        VALUES (${randomUUID()}, ${x.tenant_id}, ${x.execution_id}, ${x.row_id}, ${x.actor_user_id}, ${outcome}, ${personId}, ${profileId}, now())
      `);
      await insertExecutionOutbox(tx, x, outcome);
      await tx.execute(sql`
        UPDATE people_import_execution_row SET outcome = ${outcome}, record_id = ${profileId}, completed_at = now()
        WHERE id = ${x.id}
      `);
      await finish(tx, x);
    });
  },
  async recordFailure(claim: ClaimedExecutionRow, error: unknown) {
    const internalCode = error instanceof Error ? error.message : "execution-failed";
    const code = SAFE_ERROR_CODES.has(internalCode) ? internalCode : "execution-failed";
    await db.execute(sql`
      UPDATE people_import_execution_row
      SET outcome = 'failed', error_code = ${code}, completed_at = now()
      WHERE tenant_id = ${claim.tenantId} AND execution_id = ${claim.executionId} AND row_id = ${claim.rowId}
        AND outcome IS NULL AND claimed_by = ${claim.claimedBy ?? null} AND claim_token = ${claim.claimToken ?? null}
    `);
    await updateExecutionStatus(claim.tenantId, claim.executionId);
  },
};

async function finish(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], x: Record<string, unknown>) {
  const pendingResult = await tx.execute(sql`
    SELECT COUNT(*) AS pending FROM people_import_execution_row WHERE tenant_id = ${x.tenant_id} AND execution_id = ${x.execution_id} AND outcome IS NULL
  `);
  const pending = (pendingResult.rows[0] as { pending: string | number }).pending;
  if (Number(pending) === 0) {
    const failedResult = await tx.execute(sql`
      SELECT COUNT(*) AS failed FROM people_import_execution_row WHERE tenant_id = ${x.tenant_id} AND execution_id = ${x.execution_id} AND outcome = 'failed'
    `);
    const failed = (failedResult.rows[0] as { failed: string | number }).failed;
    const status = Number(failed) ? "partially_completed" : "completed";
    await tx.execute(sql`
      UPDATE people_import_execution SET status = ${status}, completed_at = now()
      WHERE tenant_id = ${x.tenant_id} AND id = ${x.execution_id}
    `);
  }
}

async function updateExecutionStatus(tenantId: string, executionId: string) {
  await db.transaction(async (tx) => {
    await finish(tx, { tenant_id: tenantId, execution_id: executionId });
  });
}

export async function setPeopleImportEmergencyStop(tenantId: string, stopped: boolean) {
  await db.execute(sql`
    INSERT INTO people_import_control (tenant_id, emergency_stop)
    VALUES (${tenantId}, ${stopped})
    ON CONFLICT (tenant_id) DO UPDATE SET emergency_stop = EXCLUDED.emergency_stop, updated_at = now()
  `);
}

export async function getPeopleImportExecution(tenantId: string, executionId: string, revisionId?: string) {
  const revisionClause = revisionId ? sql` AND revision_id = ${revisionId}` : sql``;
  const eResult = await db.execute(sql`
    SELECT * FROM people_import_execution WHERE tenant_id = ${tenantId} AND id = ${executionId}${revisionClause}
  `);
  const e = eResult.rows[0] as { status: string } | undefined;
  if (!e) return null;

  const rowsResult = await db.execute(sql`
    SELECT er.outcome, er.error_code, r.row_number
    FROM people_import_execution_row er
    JOIN people_import_row r ON r.tenant_id = er.tenant_id AND r.id = er.row_id
    WHERE er.tenant_id = ${tenantId} AND er.execution_id = ${executionId}${revisionClause}
    ORDER BY r.row_number
  `);
  const rows = rowsResult.rows as Array<{ outcome: string; error_code: string | null; row_number: number }>;
  const counts: Record<string, number> = { created: 0, linked: 0, skipped: 0, rejected: 0, failed: 0, "already-committed": 0 };
  for (const row of rows) {
    if (row.outcome) counts[row.outcome as keyof typeof counts]++;
  }
  return {
    status: e.status,
    counts,
    rows: rows.map((r) => ({ rowNumber: r.row_number, outcome: r.outcome, errorCode: r.error_code })),
  };
}

export async function buildPeopleImportResultWorkbook(tenantId: string, executionId: string, revisionId?: string) {
  const result = await getPeopleImportExecution(tenantId, executionId, revisionId);
  if (!result) return null;
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("Ringkasan");
  const details = wb.addWorksheet("Hasil");
  summary.addRows([["Outcome", "Jumlah"], ...Object.entries(result.counts)]);
  details.addRows([["Row", "Outcome", "Kode error"], ...result.rows.map((r) => [r.rowNumber, r.outcome, r.errorCode ?? ""])]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export async function closePeopleImportExecutionPool() {
  await closeWorkerTenantAuthorizationPool();
}
