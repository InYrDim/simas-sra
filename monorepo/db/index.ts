import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";

import mysql from "mysql2/promise";

const connectionString = process.env.DATABASE_URL || "mysql://dummy:dummy@localhost:3306/dummy";
const globalDatabase = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
};
const poolConnection = globalDatabase.mysqlPool ?? mysql.createPool({
  uri: connectionString,
  connectionLimit: 5,
  maxIdle: 5,
  idleTimeout: 60_000,
  enableKeepAlive: true,
});
globalDatabase.mysqlPool = poolConnection;

type PoolWithConfig = mysql.Pool & { config?: Record<string, unknown> };
if (!(poolConnection as PoolWithConfig).config) {
  (poolConnection as PoolWithConfig).config = {};
}

export const db = drizzle({ client: poolConnection });

export async function closeDatabasePool() {
  await poolConnection.end();
  if (globalDatabase.mysqlPool === poolConnection) {
    delete globalDatabase.mysqlPool;
  }
}
