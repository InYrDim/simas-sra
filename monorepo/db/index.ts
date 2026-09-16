import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const globalDatabase = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

const poolConnection = globalDatabase.pgPool ?? new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

globalDatabase.pgPool = poolConnection;

export const db = drizzle({ client: poolConnection });

export async function closeDatabasePool() {
  await poolConnection.end();
  if (globalDatabase.pgPool === poolConnection) {
    delete globalDatabase.pgPool;
  }
}
