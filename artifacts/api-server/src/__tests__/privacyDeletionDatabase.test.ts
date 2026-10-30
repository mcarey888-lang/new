import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { db, pool, privacyLockPool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eraseOwnedRecords } from "../services/accountDeletion";

const enabled = process.env.PRIVACY_SYNTHETIC_DB_TEST === "1";
describe("development-only synthetic erasure rows", () => {
  it.skipIf(!enabled)("erases owned GPS, plans and backups without touching a different synthetic owner", async () => {
    if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Refusing to seed or erase fixtures in a deployment");
    const migration = await db.execute(sql`SELECT to_regclass('public.privacy_deletion_jobs') AS table_name`);
    if (!migration.rows[0]?.table_name) throw new Error("Development privacy migration must be applied first");
    const owner = `privacy_synthetic_${randomUUID()}`;
    const other = `privacy_synthetic_${randomUUID()}`;
    const ids = new Map([[owner, randomUUID()], [other, randomUUID()]]);
    try {
      for (const id of [owner, other]) {
        const activity = ids.get(id)!;
        await db.execute(sql`INSERT INTO canonical_activities
          (id,owner_user_id,source_type,source_id,source_payload_hash,primary_context,activity_kind,occurred_at)
          VALUES (${activity},${id},'recorded_hike',${id},'synthetic','free_hike','hike',now())`);
        await db.execute(sql`INSERT INTO tracked_hill_sessions
          (user_id,completion_type,canonical_activity_id,raw_gps_track)
          VALUES (${id},'tracked_gps',${activity},'[]'::jsonb)`);
        await db.execute(sql`INSERT INTO recorded_hike_backups (owner_user_id,hike_id,snapshot,revision)
          VALUES (${id},'synthetic-hike','{\"synthetic\":true}'::jsonb,'1')`);
        await db.execute(sql`INSERT INTO planned_routes (id,user_id,name,anchors,geometry,length_m)
          VALUES (${id},${id},'Synthetic only','[]'::jsonb,'[]'::jsonb,0)`);
      }
      await eraseOwnedRecords(owner);
      for (const [table, column] of [["canonical_activities", "owner_user_id"], ["tracked_hill_sessions", "user_id"], ["recorded_hike_backups", "owner_user_id"], ["planned_routes", "user_id"]]) {
        const removed = await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)}=${owner}`);
        const retained = await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)}=${other}`);
        expect(removed.rows[0].n).toBe(0);
        expect(retained.rows[0].n).toBe(1);
      }
      // Repeating the same erasure is safe and does not select another owner.
      await eraseOwnedRecords(owner);
    } finally {
      await eraseOwnedRecords(owner);
      await eraseOwnedRecords(other);
    }
  });
});
afterAll(async () => { await pool.end(); await privacyLockPool.end(); });
