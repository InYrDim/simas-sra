import "dotenv/config";

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for the lifecycle data audit.");
  process.exit(1);
}

const checks = [
  {
    name: "retained Tenants missing lifecycle source data",
    query: `
      SELECT id, domain
      FROM tenant
      WHERE npsn IS NULL
         OR source_application_id IS NULL
         OR approved_at IS NULL
    `,
  },
  {
    name: "Provider Admin grants linked to Tenant users",
    query: `
      SELECT provider_admin.user_id, user.tenant_id
      FROM provider_admin
      INNER JOIN user ON user.id = provider_admin.user_id
      WHERE user.tenant_id IS NOT NULL
    `,
  },
  {
    name: "Tenant users with roles but no Tenant",
    query: `
      SELECT id, tenant_role
      FROM user
      WHERE tenant_id IS NULL
        AND tenant_role IS NOT NULL
    `,
  },
  {
    name: "inconsistent Tenant onboarding and trial timestamps",
    query: `
      SELECT id, domain
      FROM tenant
      WHERE
        (onboarding_completed_at IS NULL AND
          (trial_started_at IS NOT NULL OR trial_ends_at IS NOT NULL))
        OR
        (onboarding_completed_at IS NOT NULL AND
          (trial_started_at IS NULL
            OR trial_ends_at IS NULL
            OR trial_started_at <> onboarding_completed_at
            OR trial_ends_at <> DATE_ADD(trial_started_at, INTERVAL 1 MONTH)))
    `,
  },
  {
    name: "non-reciprocal approved Pengajuan SIMAS and Tenant links",
    query: `
      SELECT
        simas_application.id AS application_id,
        simas_application.approved_tenant_id,
        tenant.source_application_id
      FROM simas_application
      INNER JOIN tenant ON tenant.id = simas_application.approved_tenant_id
      WHERE simas_application.status = 'approved'
        AND tenant.source_application_id <> simas_application.id
    `,
  },
  {
    name: "non-reciprocal Tenant and source Pengajuan SIMAS links",
    query: `
      SELECT
        tenant.id AS tenant_id,
        tenant.source_application_id,
        simas_application.approved_tenant_id
      FROM tenant
      INNER JOIN simas_application
        ON simas_application.id = tenant.source_application_id
      WHERE simas_application.status <> 'approved'
         OR simas_application.approved_tenant_id <> tenant.id
    `,
  },
  {
    name: "invalid first School Admin activation relationships",
    query: `
      SELECT school_admin_activation.user_id, school_admin_activation.tenant_id
      FROM school_admin_activation
      INNER JOIN user ON user.id = school_admin_activation.user_id
      WHERE user.tenant_id <> school_admin_activation.tenant_id
         OR user.tenant_id IS NULL
         OR user.tenant_role <> 'school-admin'
         OR user.tenant_role IS NULL
    `,
  },
] as const;

async function main() {
  const connection = await mysql.createConnection(databaseUrl!);
  let failed = false;

  try {
    for (const check of checks) {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(check.query);

      if (rows.length === 0) {
        console.log(`PASS: ${check.name}`);
        continue;
      }

      failed = true;
      console.error(`FAIL: ${check.name} (${rows.length} row(s))`);
      console.table(rows.slice(0, 20));
    }
  } finally {
    await connection.end();
  }

  if (failed) {
    console.error(
      "Lifecycle rollout blocked. Reset development data or approve an explicit backfill policy; do not fabricate lifecycle values.",
    );
    process.exit(1);
  }

  console.log("Lifecycle data audit passed.");
}

main().catch((error: unknown) => {
  console.error("Lifecycle data audit could not run:", error);
  process.exit(1);
});
