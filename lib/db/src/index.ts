import { drizzle } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

let engineReadOnlyPool: pg.Pool | null | undefined;

/** Lazily creates the bounded, read-only pool for the SDE authoring database. */
export function getEngineReadOnlyPool(): pg.Pool | null {
  if (engineReadOnlyPool !== undefined) return engineReadOnlyPool;
  const connectionString = process.env.ENGINE_DATABASE_URL;
  if (!connectionString) {
    engineReadOnlyPool = null;
    return null;
  }
  const readPool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    options: "-c default_transaction_read_only=on",
  });
  engineReadOnlyPool = readPool;
  return readPool;
}

export async function executeEngineReadOnly<T extends Record<string, unknown>>(
  query: SQL,
): Promise<T[]> {
  const readPool = getEngineReadOnlyPool();
  if (!readPool) throw new Error("ENGINE_DATABASE_URL is not configured");
  const compiled = new PgDialect().sqlToQuery(query);
  const result = await readPool.query(compiled.sql, compiled.params);
  return result.rows as T[];
}

export * from "./schema";
