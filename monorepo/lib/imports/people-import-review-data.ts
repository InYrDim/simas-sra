import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";
import { classifyImportRowIdentity, isImportReviewDecisionAllowed, type IdentityCandidate, type ReviewDecision, type ReviewRow } from "@/lib/imports/people-import-review";
import type { ImportFinding, ImportRow, PeopleImportKind } from "@/lib/imports/people-import";
import { importIdentityFingerprint } from "@/lib/imports/people-import-review";
import { db } from "@/db";
import { peopleImportRevision, peopleImportRow, peopleImportDecision, schoolPerson, studentProfile, teacherProfile, staffProfile } from "@/db/schema";

export type ImportRevisionSummary = { id: string; batchId: string; kind: PeopleImportKind; createdAt: Date; rowCount: number; parentRevisionId: string | null };

const json = <T>(value: unknown): T => typeof value === "string" ? JSON.parse(value) as T : value as T;

interface RevisionRow {
  id: string;
  batch_id: string;
  entity_kind: string;
  created_at: string;
  row_count: number;
  parent_revision_id: string | null;
}

interface ImportReviewRow {
  id: string;
  row_number: number;
  values_json: unknown;
  findings_json: unknown;
  identity_fingerprint: string;
  action: string | null;
  target_person_id: string | null;
  actor_user_id: string | null;
}

interface PersonRow {
  [key: string]: unknown;
  id: string;
  full_name: string;
  birth_place: string;
  birth_date: string;
  gender: string;
  nik: string | null;
  nip: string | null;
  student_id: string | null;
  nis: string | null;
  nisn: string | null;
  teacher_id: string | null;
  teacher_number: string | null;
  nuptk: string | null;
  staff_id: string | null;
  staff_number: string | null;
}

interface ParentRevisionRow {
  batch_id: string;
  entity_kind: string;
}

interface OldDecisionRow {
  action: string;
  target_person_id: string | null;
  actor_user_id: string;
}

export async function listImportRevisions(principal: MasterDataPrincipal) {
  const result = await db.execute(sql`
    SELECT id, batch_id, entity_kind, created_at, row_count, parent_revision_id
    FROM people_import_revision
    WHERE tenant_id = ${principal.tenantId}
    ORDER BY created_at DESC
  `);
  const rows = result.rows as unknown as RevisionRow[];
  return rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    kind: row.entity_kind as PeopleImportKind,
    createdAt: new Date(row.created_at),
    rowCount: Number(row.row_count),
    parentRevisionId: row.parent_revision_id,
  })) as ImportRevisionSummary[];
}

export async function getImportReview(principal: MasterDataPrincipal, revisionId: string) {
  const revisionResult = await db.execute(sql`
    SELECT id, batch_id, entity_kind, created_at, row_count, parent_revision_id
    FROM people_import_revision
    WHERE tenant_id = ${principal.tenantId} AND id = ${revisionId}
  `);
  const revisions = revisionResult.rows as unknown as RevisionRow[];
  const revision = revisions[0];
  if (!revision) return null;

  const rowsResult = await db.execute(sql`
    SELECT r.*, d.action, d.target_person_id, d.actor_user_id
    FROM people_import_row r
    LEFT JOIN people_import_decision d ON d.tenant_id = r.tenant_id AND d.revision_id = r.revision_id AND d.row_id = r.id
    WHERE r.tenant_id = ${principal.tenantId} AND r.revision_id = ${revisionId}
    ORDER BY r.row_number
  `);
  const rows = rowsResult.rows as unknown as ImportReviewRow[];

  const peopleResult = await db.execute(sql`
    SELECT p.id, p.full_name, p.birth_place, p.birth_date, p.gender, p.nik, p.nip,
           sp.id AS student_id, sp.nis, sp.nisn,
           tp.id AS teacher_id, tp.teacher_number, tp.nuptk,
           fp.id AS staff_id, fp.staff_number
    FROM school_person p
    LEFT JOIN student_profile sp ON sp.tenant_id = p.tenant_id AND sp.person_id = p.id
    LEFT JOIN teacher_profile tp ON tp.tenant_id = p.tenant_id AND tp.person_id = p.id
    LEFT JOIN staff_profile fp ON fp.tenant_id = p.tenant_id AND fp.person_id = p.id
    WHERE p.tenant_id = ${principal.tenantId} AND p.archived = false
  `);
  const people = peopleResult.rows as unknown as PersonRow[];

  const kind = revision.entity_kind as PeopleImportKind;

  const reviewed: ReviewRow[] = rows.map((raw) => {
    const values = json<Record<string, string>>(raw.values_json);
    const baseFindings = json<ImportFinding[]>(raw.findings_json);
    const profileKey = kind === "student" ? "student_id" : kind === "teacher" ? "teacher_id" : "staff_id";
    const exact = people
      .filter(
        (person) =>
          (values.nik && person.nik === values.nik) ||
          (values.nip && person.nip === values.nip) ||
          (values.nis && person.nis === values.nis) ||
          (values.nisn && person.nisn === values.nisn) ||
          (values.teacherNumber && person.teacher_number === values.teacherNumber) ||
          (values.nuptk && person.nuptk === values.nuptk) ||
          (values.staffNumber && person.staff_number === values.staffNumber)
      )
      .map((person) => candidate(person, profileKey, values));
    const similar = people
      .filter((person) => !exact.some((x) => x.id === person.id) && String(person.full_name).toLocaleLowerCase("id-ID") === values.fullName?.toLocaleLowerCase("id-ID") && String(person.birth_date) === values.birthDate)
      .map((person) => candidate(person, profileKey, values));
    const classification = classifyImportRowIdentity(kind, values, exact);
    const candidates = classification.candidates.length ? classification.candidates : similar;
    const findings = [
      ...baseFindings,
      ...(classification.finding ? [classification.finding] : similar.length ? [{ field: "fullName", code: "similar-person", severity: "warning" as const }] : []),
    ];
    const state = classification.state === "rejected" || baseFindings.some((x) => x.severity === "rejected") ? "rejected" : findings.length ? "warning" : "ready";
    return {
      id: raw.id,
      rowNumber: Number(raw.row_number),
      state,
      values,
      findings,
      candidates,
      identityFingerprint: raw.identity_fingerprint,
      decision: raw.action ? { action: raw.action as ReviewDecision["action"], targetPersonId: raw.target_person_id ?? undefined, actorId: raw.actor_user_id! } : null,
    };
  });
  return {
    revision: {
      id: revision.id,
      batchId: revision.batch_id,
      kind,
      createdAt: new Date(revision.created_at),
      rowCount: Number(revision.row_count),
      parentRevisionId: revision.parent_revision_id,
    } as ImportRevisionSummary,
    rows: reviewed,
  };
}

function candidate(person: PersonRow, profileKey: string, values: Record<string, string>): IdentityCandidate {
  return {
    id: person.id,
    fullName: person.full_name,
    birthPlace: person.birth_place,
    birthDate: String(person.birth_date),
    identifiers: Object.fromEntries([
      ["nik", person.nik],
      ["nip", person.nip],
      ["nis", person.nis],
      ["nisn", person.nisn],
      ["teacherNumber", person.teacher_number],
      ["nuptk", person.nuptk],
      ["staffNumber", person.staff_number],
    ].filter(([, v]) => v)) as Record<string, string>,
    hasTargetProfile: Boolean(person[profileKey]),
    compatible:
      String(person.birth_date) === values.birthDate &&
      String(person.gender) === values.gender &&
      String(person.full_name).toLocaleLowerCase("id-ID") === values.fullName?.toLocaleLowerCase("id-ID") &&
      String(person.birth_place).toLocaleLowerCase("id-ID") === values.birthPlace?.toLocaleLowerCase("id-ID"),
  };
}

export async function saveImportDecision(principal: MasterDataPrincipal, revisionId: string, rowId: string, decision: Omit<ReviewDecision, "actorId">) {
  if (!principal.capabilities.write) throw new Error("read-only");
  const review = await getImportReview(principal, revisionId);
  const row = review?.rows.find((x) => x.id === rowId);
  if (!row || !isImportReviewDecisionAllowed(row, decision)) throw new Error("invalid-decision");

  await db.execute(sql`
    INSERT INTO people_import_decision (id, tenant_id, revision_id, row_id, action, target_person_id, actor_user_id, created_at)
    VALUES (${randomUUID()}, ${principal.tenantId}, ${revisionId}, ${rowId}, ${decision.action}, ${decision.targetPersonId ?? null}, ${principal.userId}, CURRENT_TIMESTAMP(3))
    ON CONFLICT (tenant_id, revision_id, row_id) DO UPDATE SET
      action = EXCLUDED.action,
      target_person_id = EXCLUDED.target_person_id,
      actor_user_id = EXCLUDED.actor_user_id,
      created_at = CURRENT_TIMESTAMP(3)
  `);
}

export async function createCorrectionRevision(
  principal: MasterDataPrincipal,
  parentRevisionId: string,
  storageKey: string,
  kind: PeopleImportKind,
  version: string,
  rows: ImportRow[]
) {
  if (!principal.capabilities.write) throw new Error("read-only");
  const revisionId = randomUUID();

  await db.transaction(async (tx) => {
    const parentResult = await tx.execute(sql`
      SELECT batch_id, entity_kind
      FROM people_import_revision
      WHERE tenant_id = ${principal.tenantId} AND id = ${parentRevisionId}
      FOR SHARE
    `);
    const parent = parentResult.rows[0] as unknown as ParentRevisionRow | undefined;
    if (!parent || parent.entity_kind !== kind) throw new Error("revision-not-found");

    await tx.execute(sql`
      INSERT INTO people_import_revision (id, tenant_id, batch_id, entity_kind, template_version, row_count, parent_revision_id, source_storage_key)
      VALUES (${revisionId}, ${principal.tenantId}, ${parent.batch_id}, ${kind}, ${version}, ${rows.length}, ${parentRevisionId}, ${storageKey})
    `);

    for (const row of rows) {
      const rowId = randomUUID();
      const fingerprint = importIdentityFingerprint(kind, row.values);

      await tx.execute(sql`
        INSERT INTO people_import_row (id, tenant_id, revision_id, row_number, state, values_json, findings_json, identity_fingerprint, candidates_json)
        VALUES (${rowId}, ${principal.tenantId}, ${revisionId}, ${row.rowNumber}, ${row.state}, ${JSON.stringify(row.values)}, ${JSON.stringify(row.findings)}, ${fingerprint}, ${JSON.stringify([])})
      `);

      const oldResult = await tx.execute(sql`
        SELECT d.action, d.target_person_id, d.actor_user_id
        FROM people_import_row r
        JOIN people_import_decision d ON d.tenant_id = r.tenant_id AND d.revision_id = r.revision_id AND d.row_id = r.id
        WHERE r.tenant_id = ${principal.tenantId} AND r.revision_id = ${parentRevisionId} AND r.identity_fingerprint = ${fingerprint}
        LIMIT 1
      `);
      const decision = oldResult.rows[0] as unknown as OldDecisionRow | undefined;
      if (decision) {
        let valid = !decision.target_person_id;
        if (decision.target_person_id) {
          const profileTable = sql.raw(
            kind === "student" ? "student_profile" : kind === "teacher" ? "teacher_profile" : "staff_profile"
          );
          const targetResult = await tx.execute(sql`
            SELECT p.id
            FROM school_person p
            LEFT JOIN ${profileTable} x ON x.tenant_id = p.tenant_id AND x.person_id = p.id
            WHERE p.tenant_id = ${principal.tenantId} AND p.id = ${decision.target_person_id} AND x.id IS NULL
          `);
          valid = Boolean(targetResult.rows[0]);
        }
        if (valid) {
          await tx.execute(sql`
            INSERT INTO people_import_decision (id, tenant_id, revision_id, row_id, action, target_person_id, actor_user_id)
            VALUES (${randomUUID()}, ${principal.tenantId}, ${revisionId}, ${rowId}, ${decision.action}, ${decision.target_person_id}, ${decision.actor_user_id})
          `);
        }
      }
    }
  });

  return revisionId;
}

export async function closePeopleImportReviewPool() {
  // Pool managed globally via db/index.ts; no-op to preserve API
}
