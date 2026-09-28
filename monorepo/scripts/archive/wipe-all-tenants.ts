import "dotenv/config";

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const EXECUTE = process.argv.includes("--execute");

async function main() {
    const connection = await mysql.createConnection({ uri: databaseUrl });
    try {
        const [tenantRows] = await connection.query<mysql.RowDataPacket[]>(
            "SELECT id FROM tenant",
        );
        const tenantIds = tenantRows.map((r) => r.id as string);
        console.info({ mode: EXECUTE ? "EXECUTE" : "DRY-RUN", tenantCount: tenantIds.length });

        // All tables that carry a tenant_id (or approved_tenant_id) column.
        const [cols] = await connection.query<mysql.RowDataPacket[]>(
            `SELECT TABLE_NAME, COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND COLUMN_NAME IN ('tenant_id','approved_tenant_id')`,
        );
        const tables = cols.map((c) => ({ table: c.TABLE_NAME as string, col: c.COLUMN_NAME as string }));

        await connection.query("SET FOREIGN_KEY_CHECKS=0");
        for (const { table, col } of tables) {
            const [res] = await connection.query<any>(
                `SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${col}\` IN (?)`,
                [tenantIds],
            );
            const n = res[0]?.n ?? 0;
            if (n === 0) continue;
            console.info({ table, col, rows: n });
            if (EXECUTE) {
                await connection.query(`DELETE FROM \`${table}\` WHERE \`${col}\` IN (?)`, [tenantIds]);
            }
        }

        // Sessions belong to users, not tenants directly.
        const [sess] = await connection.query<any>(
            `SELECT COUNT(*) AS n FROM session WHERE user_id IN (SELECT id FROM \`user\` WHERE tenant_id IN (?))`,
            [tenantIds],
        );
        console.info({ table: "session", rows: sess[0]?.n ?? 0 });
        if (EXECUTE) {
            await connection.query(
                `DELETE FROM session WHERE user_id IN (SELECT id FROM \`user\` WHERE tenant_id IN (?))`,
                [tenantIds],
            );
        }

        // Users scoped to a tenant.
        const [usr] = await connection.query<any>(
            `SELECT COUNT(*) AS n FROM \`user\` WHERE tenant_id IN (?)`,
            [tenantIds],
        );
        console.info({ table: "user", rows: usr[0]?.n ?? 0 });
        if (EXECUTE) {
            await connection.query(`DELETE FROM \`user\` WHERE tenant_id IN (?)`, [tenantIds]);
        }

        // Finally the tenant rows themselves.
        console.info({ table: "tenant", rows: tenantIds.length });
        if (EXECUTE) {
            await connection.query(`DELETE FROM tenant WHERE id IN (?)`, [tenantIds]);
        }
        await connection.query("SET FOREIGN_KEY_CHECKS=1");

        console.info({ event: EXECUTE ? "all_tenants_wiped" : "dry_run_done" });
    } finally {
        await connection.end();
    }
}

void main();
