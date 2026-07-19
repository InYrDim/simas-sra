import 'dotenv/config';
import { drizzle } from "drizzle-orm/mysql2";

import mysql from "mysql2/promise";

const connectionString = process.env.DATABASE_URL || "mysql://dummy:dummy@localhost:3306/dummy";
const poolConnection = mysql.createPool(connectionString);
type PoolWithConfig = mysql.Pool & { config?: Record<string, unknown> };

if (!(poolConnection as PoolWithConfig).config) {
    (poolConnection as PoolWithConfig).config = {};
}

export const db = drizzle({ client: poolConnection });

export async function closeDatabasePool() {
    await poolConnection.end();
}
