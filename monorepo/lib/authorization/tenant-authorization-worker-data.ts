import mysql from "mysql2/promise";
import {
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationAccount,
  type TenantAuthorizationAuthority,
  type TenantAuthorizationRollout,
  type TenantAuthorizationStore,
  type TenantAuthorizationTenant,
} from "@/lib/authorization/tenant-authorization";

const url = process.env.DATABASE_URL;
let database: mysql.Pool | undefined;
const db = () => database ??= mysql.createPool({ uri: url!, connectionLimit: 8 });

function date(value: unknown): Date | null {
  return value === null || value === undefined ? null : new Date(value as string | number | Date);
}

const store = (connection?: mysql.PoolConnection): TenantAuthorizationStore => ({
  async loadAccount(userId): Promise<TenantAuthorizationAccount | null> {
    const sql = connection ?? db();
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT u.id user_id,u.tenant_id,sec.lifecycle account_lifecycle,(SELECT COUNT(*) FROM school_person p WHERE p.tenant_id=u.tenant_id AND p.account_user_id=u.id) self_person_count,(SELECT COUNT(*) FROM provider_admin pa WHERE pa.user_id=u.id) provider_admin_count,(SELECT COUNT(*) FROM applicant a WHERE a.user_id=u.id) applicant_count FROM user u LEFT JOIN tenant_account_security sec ON sec.tenant_id=u.tenant_id AND sec.user_id=u.id WHERE u.id=? LIMIT 1",
      [userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: String(row.user_id),
      tenantId: row.tenant_id === null ? null : String(row.tenant_id),
      selfPersonId: Number(row.self_person_count) > 0 ? "linked" : null,
      accountLifecycle: row.account_lifecycle ?? null,
      providerAdmin: Number(row.provider_admin_count) === 1,
      applicant: Number(row.applicant_count) === 1,
      activationComplete: true,
    };
  },

  async loadTenantByDomain(domain): Promise<TenantAuthorizationTenant | null> {
    const sql = connection ?? db();
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT id,domain,operational_status,trial_ends_at,settings FROM tenant WHERE domain=? LIMIT 1",
      [domain],
    );
    const row = rows[0];
    return row ? {
      id: String(row.id),
      domain: String(row.domain),
      operationalStatus: row.operational_status,
      trialEndsAt: date(row.trial_ends_at),
      settings: row.settings,
    } : null;
  },

  async loadAuthority(userId, tenantId): Promise<TenantAuthorizationAuthority> {
    const sql = connection ?? db();
    const [authorityRows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT authority_state FROM school_admin_authority WHERE user_id=? AND tenant_id=?",
      [userId, tenantId],
    );
    const [assignmentRows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT a.id assignment_id,a.state assignment_state,r.id role_id,r.lifecycle role_lifecycle,p.permission_key FROM tenant_role_assignment a JOIN tenant_role r ON r.tenant_id=a.tenant_id AND r.id=a.role_id LEFT JOIN tenant_role_permission p ON p.tenant_id=r.tenant_id AND p.role_id=r.id WHERE a.user_id=? AND a.tenant_id=?",
      [userId, tenantId],
    );
    const assignments = new Map<string, { assignmentId: string; assignmentState: string; roleId: string; roleLifecycle: string; permissionKeys: string[] }>();
    for (const row of assignmentRows) {
      const assignmentId = String(row.assignment_id);
      const assignment = assignments.get(assignmentId) ?? {
        assignmentId,
        assignmentState: String(row.assignment_state),
        roleId: String(row.role_id),
        roleLifecycle: String(row.role_lifecycle),
        permissionKeys: [],
      };
      if (row.permission_key !== null) assignment.permissionKeys.push(String(row.permission_key));
      assignments.set(assignmentId, assignment);
    }
    return {
      schoolAdminAuthorityStates: authorityRows.map((row) => String(row.authority_state)),
      assignments: [...assignments.values()].map((assignment) => ({
        ...assignment,
        permissionKeys: [...new Set(assignment.permissionKeys)].sort(),
      })),
    };
  },

  async loadRollout(tenantId): Promise<TenantAuthorizationRollout | null> {
    const sql = connection ?? db();
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT http_mode,worker_mode,epoch,resolver_version,registry_version,operation_map_version,overlay_hash FROM tenant_rbac_rollout WHERE tenant_id=? LIMIT 1",
      [tenantId],
    );
    const row = rows[0];
    return row ? {
      httpMode: row.http_mode,
      workerMode: row.worker_mode,
      epoch: BigInt(row.epoch),
      resolverVersion: String(row.resolver_version),
      registryVersion: String(row.registry_version),
      operationMapVersion: String(row.operation_map_version),
      overlayHash: row.overlay_hash ?? null,
    } : null;
  },
});

export function createWorkerTenantAuthorizationEvaluator(actorUserId: string, connection?: mysql.PoolConnection) {
  const evaluator = createTenantAuthorizationEvaluator({ store: store(connection) });
  return Object.freeze({
    evaluate(request: Omit<Parameters<typeof evaluator.evaluate>[0], "sessionUserId">) {
      return evaluator.evaluate({ ...request, sessionUserId: actorUserId, surface: "worker" });
    },
  });
}

export async function closeWorkerTenantAuthorizationPool() {
  if (database) {
    await database.end();
    database = undefined;
  }
}
