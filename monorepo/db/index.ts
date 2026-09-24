import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const globalDatabase = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

const poolConnection = globalDatabase.pgPool ?? new Pool({
  connectionString,
  max: 50,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
});

globalDatabase.pgPool = poolConnection;

export const db = drizzle({ client: poolConnection });

export async function closeDatabasePool() {
  await poolConnection.end();
  if (globalDatabase.pgPool === poolConnection) {
    delete globalDatabase.pgPool;
  }
}
