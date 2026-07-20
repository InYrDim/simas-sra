import "server-only";
import mysql from "mysql2/promise";
import { buildMasterDataOverview, type OverviewState, type UnsafeOverviewActivity } from "@/lib/master-data-overview";

const connectionString = process.env.DATABASE_URL;
let pool: mysql.Pool | undefined;
const database = () => pool ??= mysql.createPool({ uri: connectionString!, connectionLimit: 5 });
const rows = async (query: string, values: unknown[]) => (await database().query<mysql.RowDataPacket[]>(query, values))[0];

export async function getMasterDataOverview(tenantId: string, domain: string) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const [students, teachers, staff, subjects, classGroups, assets, organizations, extracurriculars, academicYears, activity] = await Promise.all([
    rows("SELECT s.id,s.status='active' active,s.archived,m.class_group_id currentClassGroupId FROM student_profile s LEFT JOIN class_membership m ON m.tenant_id=s.tenant_id AND m.student_id=s.id AND m.ended_at IS NULL AND m.planned=false WHERE s.tenant_id=?", [tenantId]),
    rows("SELECT id,status='active' active,archived FROM teacher_profile WHERE tenant_id=?", [tenantId]),
    rows("SELECT id,status='active' active,archived FROM staff_profile WHERE tenant_id=?", [tenantId]),
    rows("SELECT id,archived FROM subject WHERE tenant_id=?", [tenantId]),
    rows("SELECT g.id,g.lifecycle='active' active,g.archived,h.teacher_id homeroomTeacherId FROM class_group g LEFT JOIN homeroom_assignment h ON h.tenant_id=g.tenant_id AND h.class_group_id=g.id AND h.ended_at IS NULL WHERE g.tenant_id=?", [tenantId]),
    rows("SELECT id,archived,`condition` FROM inventory_asset WHERE tenant_id=?", [tenantId]),
    rows("SELECT id,archived FROM student_organization WHERE tenant_id=?", [tenantId]),
    rows("SELECT id,archived FROM extracurricular WHERE tenant_id=?", [tenantId]),
    rows("SELECT id,lifecycle='active' active,archived FROM academic_year WHERE tenant_id=?", [tenantId]),
    rows(`SELECT id,entity,operation,actorLabel,occurredAt FROM (
      SELECT a.id,'Siswa' entity,a.operation,u.name actorLabel,a.occurred_at occurredAt FROM student_audit a JOIN user u ON u.id=a.actor_user_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=?
      UNION ALL SELECT a.id,'Guru',a.operation,u.name,a.occurred_at FROM teacher_audit a JOIN user u ON u.id=a.actor_user_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=?
      UNION ALL SELECT a.id,'Staf',a.operation,u.name,a.occurred_at FROM staff_audit a JOIN user u ON u.id=a.actor_user_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=?
      UNION ALL SELECT h.id,'Mata Pelajaran',h.operation,u.name,h.occurred_at FROM subject_history h JOIN user u ON u.id=h.actor_user_id AND u.tenant_id=h.tenant_id WHERE h.tenant_id=?
      UNION ALL SELECT h.id,'Rombongan Belajar',h.operation,u.name,h.occurred_at FROM class_group_history h JOIN user u ON u.id=h.actor_user_id AND u.tenant_id=h.tenant_id WHERE h.tenant_id=?
      UNION ALL SELECT h.id,'Sarana & Prasarana',h.operation,u.name,h.occurred_at FROM inventory_asset_history h JOIN user u ON u.id=h.actor_user_id AND u.tenant_id=h.tenant_id WHERE h.tenant_id=?
    ) recent ORDER BY occurredAt DESC LIMIT 10`, Array(6).fill(tenantId)),
  ]);
  const normalize = <T>(value: mysql.RowDataPacket[]) => value.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active) })) as T;
  const state: OverviewState = { students: normalize(students), teachers: normalize(teachers), staff: normalize(staff), subjects: normalize(subjects), classGroups: normalize(classGroups), assets: normalize(assets), organizations: normalize(organizations), extracurriculars: normalize(extracurriculars), academicYears: normalize(academicYears), activities: [] };
  return buildMasterDataOverview(domain, state, activity.map((x) => ({ id: String(x.id), entity: String(x.entity), operation: String(x.operation), actorLabel: String(x.actorLabel), occurredAt: new Date(x.occurredAt) })) as UnsafeOverviewActivity[]);
}

export async function closeMasterDataOverviewPool() { if (pool) { await pool.end(); pool = undefined; } }
