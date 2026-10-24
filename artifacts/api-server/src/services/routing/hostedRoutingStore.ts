import { pool } from "@workspace/db";
import type { HostedRoutingStore } from "./openRouteService";

/** Small persistent cache plus atomic, shared quotas across API replicas.
 * Quotas fail closed when storage is unavailable; we never silently burn the
 * free account's allowance without accounting for it. No DDL runs on requests. */
export const hostedRoutingStore: HostedRoutingStore = {
  async get(key) {
    const result = await pool.query(
      "SELECT result FROM path_routing_cache WHERE key = $1 AND expires_at > now()",
      [key],
    );
    return result.rows[0]?.result ?? null;
  },
  async put(key, result) {
    await pool.query(
      `INSERT INTO path_routing_cache (key, result, expires_at)
       VALUES ($1, $2::jsonb, now() + interval '7 days')
       ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result,
         expires_at = EXCLUDED.expires_at, created_at = now()`,
      [key, JSON.stringify(result)],
    );
    // Bounded storage. This cache is disposable; it never deletes user routes.
    await pool.query(`DELETE FROM path_routing_cache WHERE key IN (
      SELECT key FROM path_routing_cache ORDER BY expires_at DESC OFFSET 10000
    ) OR expires_at <= now()`);
    await pool.query("DELETE FROM path_routing_usage WHERE expires_at <= now()");
  },
  async reserve() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Fixed order avoids deadlocks. Database clock, not replica clocks.
      for (const [period, limit] of [["day", 1900], ["minute", 35]] as const) {
        const result = await client.query(
          `INSERT INTO path_routing_usage (bucket, requests, expires_at)
           VALUES ('ors-' || $1 || '-' || date_trunc($1, now())::text, 1,
             date_trunc($1, now()) + CASE WHEN $1 = 'day' THEN interval '1 day' ELSE interval '1 minute' END)
           ON CONFLICT (bucket) DO UPDATE SET requests = path_routing_usage.requests + 1
             WHERE path_routing_usage.requests < $2
           RETURNING requests`,
          [period, limit],
        );
        if (!result.rowCount) {
          await client.query("ROLLBACK");
          return false;
        }
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
