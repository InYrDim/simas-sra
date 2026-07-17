import 'dotenv/config';
import { drizzle } from "drizzle-orm/mysql2";

import mysql from "mysql2/promise";

const poolConnection = mysql.createPool(process.env.DATABASE_URL as string);
type PoolWithConfig = mysql.Pool & { config?: Record<string, unknown> };

if (!(poolConnection as PoolWithConfig).config) {
    (poolConnection as PoolWithConfig).config = {};
}

export const db = drizzle({ client: poolConnection });

