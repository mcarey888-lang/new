import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, privacyLockPool } from "@workspace/db";
import { sql } from "drizzle-orm";
/** Stop new owned writes while an erasure is in progress. Reads and the
 * authenticated retry remain available. No consent requirement for core use. */
export const privacyDeletionFence: RequestHandler = async (req, res, next) => {
  const owner = getAuth(req).userId;
  if (!owner || ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      (req.method === "DELETE" && req.path === "/user/me")) { next(); return; }
  try {
    const client = await privacyLockPool.connect();
    const key = `erasure:${owner}`;
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      try {
        await client.query("SELECT pg_advisory_unlock_shared(hashtextextended($1, 0))", [key]);
        client.release();
      } catch { client.release(true); }
    };
    try {
      const result = await client.query("SELECT pg_try_advisory_lock_shared(hashtextextended($1, 0)) AS acquired", [key]);
      if (!result.rows[0]?.acquired) {
        released = true; client.release();
        res.status(409).json({ error: "Account deletion is in progress. New records cannot be saved." });
        return;
      }
    } catch (error) { client.release(true); throw error; }
    // Existing writes finish before the erasure's exclusive lock can collect
    // media/rows. New writes are rejected without tying up other users' slots.
    res.once("finish", () => { void release(); });
    res.once("close", () => { void release(); });
    if (res.destroyed) { await release(); return; }
    const jobs = await db.execute(sql`SELECT id FROM privacy_deletion_jobs WHERE owner_user_id=${owner} LIMIT 1`);
    if (jobs.rows.length) {
      res.status(409).json({ error: "Account deletion is in progress. New records cannot be saved. Retry deletion or contact support." });
      return;
    }
    next();
  } catch (error) { next(error); }
};
