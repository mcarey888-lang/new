import { db, pool } from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { deleteCommunityPhoto, listOwnedCommunityMedia } from "../routes/community";
import { advanceAccountDeletion, type DeletionState } from "./accountDeletionFlow";
import { deleteRevenueCatCustomer } from "./membershipAccess";

/** Known owner columns only. Child ledgers must precede RESTRICT parents.
 * Do not match globally reused legacy source IDs or mountain catalogue rows. */
export const OWNER_DELETIONS: Array<[string, string[]]> = [
  ["community_reports", ["reporter_user_id", "target_owner_user_id"]],
  ["community_comments", ["owner_user_id"]], ["community_likes", ["user_id"]],
  ["community_post_likes", ["user_id"]], ["community_posts", ["owner_user_id"]],
  ["activity_route_reports", ["reporter", "owner"]],
  ["activity_bookmarks", ["viewer", "owner"]],
  ["activity_trail_suggestions", ["owner"]],
  ["activity_follows", ["follower", "followed"]],
  ["activity_preferences", ["owner"]], ["planned_routes", ["user_id"]],
  ["recorded_hike_backups", ["owner_user_id"]],
  ["expedition_contribution_corrections", ["owner_user_id"]],
  ["expedition_stage_contributions", ["owner_user_id"]],
  ["expedition_runs", ["owner_user_id"]],
  ["personal_elevation_credit_corrections", ["owner_user_id"]],
  ["personal_elevation_credit_events", ["owner_user_id"]],
  ["route_contributions", ["owner_user_id"]],
  ["tracked_routes", ["created_by"]],
  ["canonical_activities", ["owner_user_id"]],
  ["user_demo_profiles", ["clerk_user_id"]], ["users", ["clerk_user_id"]],
];
export async function eraseOwnedRecords(owner: string) {
  await db.transaction(async tx => {
    const inventory = await tx.execute(sql`SELECT table_name,column_name
      FROM information_schema.columns WHERE table_schema='public'`);
    const columns = new Set(inventory.rows.map((row: any) => `${row.table_name}.${row.column_name}`));
    // Erase legacy GPS/training payloads BEFORE canonical FK SET NULL would
    // destroy the ownership link. Direct owner IDs cover older unlinked rows.
    if (columns.has("tracked_hill_sessions.canonical_activity_id")) {
      await tx.execute(sql`DELETE FROM tracked_hill_sessions
        WHERE user_id=${owner} OR canonical_activity_id IN
        (SELECT id FROM canonical_activities WHERE owner_user_id=${owner})`);
    }
    for (const [table, candidates] of OWNER_DELETIONS) {
      const available = candidates.filter(column => columns.has(`${table}.${column}`));
      if (!available.length) continue; // Versioned optional tables, not query errors.
      const predicates = available.map(column => sql`${sql.identifier(column)}=${owner}`);
      await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.join(predicates, sql` OR `)}`);
    }
  });
}

export async function runAccountDeletion(owner: string, erasureIdentifiers?: Record<string, string>) {
  // A session advisory lock serialises retries; the job itself is committed
  // independently so a crash cannot discard the media/provider retry ledger.
  const lock = await pool.connect();
  let requestId: string | undefined;
  try {
    await lock.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [`erasure:${owner}`]);
    let result = await db.execute(sql`SELECT id,state FROM privacy_deletion_jobs WHERE owner_user_id=${owner}`);
    if (!result.rows.length) {
      const state: DeletionState = {
        media: [],
        completed: [],
        erasureIdentifiers,
        providers: {
          revenuecat: "pending_review", firebase: "pending_review", reddit: "pending_review",
          ai_support_logs_backups: "pending_review", legacy_unattributed_records: "pending_review",
        },
      };
      result = await db.execute(sql`INSERT INTO privacy_deletion_jobs (owner_user_id,state)
        VALUES (${owner},${JSON.stringify(state)}::jsonb) RETURNING id,state`);
    }
    const job = result.rows[0] as { id: string; state: DeletionState };
    requestId = job.id;
    const save = async (state: DeletionState) => {
      await db.execute(sql`UPDATE privacy_deletion_jobs SET state=${JSON.stringify(state)}::jsonb,updated_at=now() WHERE id=${job.id}`);
    };
    // The request already exists durably if listing storage now fails.
    if (!job.state.completed.includes("media_inventory") && !job.state.completed.includes("records")) {
      const photos = await db.execute(sql`SELECT photo_path AS path FROM community_posts WHERE owner_user_id=${owner}
        UNION SELECT cover_path AS path FROM activity_preferences WHERE owner=${owner}`);
      job.state.media = [...new Set([
        ...photos.rows.map((row: any) => row.path).filter((path: unknown): path is string => typeof path === "string" && !!path),
        ...await listOwnedCommunityMedia(owner),
      ])];
      job.state.completed.push("media_inventory");
      await save(job.state);
    }
    const outcome = await advanceAccountDeletion(job.state, {
      save,
      removeMedia: deleteCommunityPhoto,
      removeRecords: () => eraseOwnedRecords(owner),
      removeIdentity: async () => {
        try { await clerkClient.users.deleteUser(owner); }
        catch (error: any) { if (error?.status !== 404) throw error; }
      },
      removeRevenueCat: () => deleteRevenueCatCustomer(owner),
    });
    return { ...outcome, requestId: job.id };
  } catch (cause) {
    throw Object.assign(new Error("Account erasure incomplete", { cause }), { requestId });
  } finally {
    try { await lock.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`erasure:${owner}`]); }
    finally { lock.release(); }
  }
}
export async function deleteAccountHandler(req: Request, res: Response) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const identifiers: Record<string, string> = {};
    for (const key of ["redditInstallationId", "firebaseAppInstanceId"]) {
      const value = req.body?.erasureIdentifiers?.[key];
      if (typeof value === "string" && /^[a-zA-Z0-9:_-]{1,160}$/.test(value)) identifiers[key] = value;
    }
    const outcome = await runAccountDeletion(userId, identifiers);
    res.status(outcome.deleted ? 200 : 202).json({
      ...outcome,
      message: "Your account and associated live app records/media have been removed. Provider erasure and retained-record review may remain pending. Account deletion does not cancel a store subscription.",
    });
  } catch (error) {
    req.log.error({ err: error }, "Account deletion incomplete; durable request retained for retry");
    const requestId = (error as { requestId?: string })?.requestId;
    res.status(503).json({
      deleted: false, requestId, requestRecorded: Boolean(requestId),
      error: `Deletion is incomplete and may have removed some data. ${requestId ? `Your request is retained for retry; reference ${requestId}.` : "We could not confirm that your request was saved."} Please retry Delete account or contact support; we have not marked erasure complete.`,
    });
  }
}
