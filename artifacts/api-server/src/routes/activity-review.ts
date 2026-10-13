import { Router, type IRouter } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminKey } from "../middlewares/requireAdminKey";

const router: IRouter = Router();
router.use("/activity-review", requireAdminKey);
router.get("/activity-review", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const input = z.object({
      status: z.enum(["pending", "in_review", "approved", "rejected"]).default("pending"),
      page: z.coerce.number().int().min(0).max(50).default(0),
    }).parse(req.query);
    const result = await db.execute(sql`
      SELECT s.owner, s.hike_id AS "hikeId", s.evidence_revision AS "evidenceRevision",
        s.status, s.review_notes AS "reviewNotes", s.reviewed_at AS "reviewedAt",
        b.revision AS "currentRevision", b.snapshot->>'name' AS name,
        b.snapshot->>'date' AS date, b.snapshot->'distance' AS distance,
        b.snapshot->'elevationGain' AS "elevationGain"
      FROM activity_trail_suggestions s
      JOIN recorded_hike_backups b ON b.owner_user_id=s.owner AND b.hike_id=s.hike_id
      WHERE s.status=${input.status} AND b.deleted_at IS NULL
      ORDER BY s.owner,s.hike_id LIMIT 21 OFFSET ${input.page * 20}`);
    res.json({ suggestions: result.rows.slice(0, 20), hasMore: result.rows.length > 20 });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Invalid review filter" }); return; }
    req.log.error({ error }, "Activity review list failed");
    res.status(503).json({ error: "Trail review storage is unavailable" });
  }
});
router.patch("/activity-review/:owner/:hikeId", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const owner = z.string().min(1).max(256).parse(req.params.owner);
    const hikeId = z.string().min(1).max(256).parse(req.params.hikeId);
    const input = z.object({
      status: z.enum(["in_review", "approved", "rejected"]),
      evidenceRevision: z.string().datetime(),
      reviewNotes: z.string().trim().min(1).max(2000),
    }).parse(req.body);
    const result = await db.execute(sql`
      UPDATE activity_trail_suggestions s SET status=${input.status},
        review_notes=${input.reviewNotes}, reviewed_at=now()
      FROM recorded_hike_backups b
      WHERE s.owner=${owner} AND s.hike_id=${hikeId}
        AND b.owner_user_id=s.owner AND b.hike_id=s.hike_id AND b.deleted_at IS NULL
        AND s.evidence_revision=${input.evidenceRevision} AND b.revision=s.evidence_revision
        AND ((${input.status}='in_review' AND s.status='pending')
          OR (${input.status} IN ('approved','rejected') AND s.status='in_review'))
      RETURNING s.owner`);
    if (!result.rows.length) {
      res.status(409).json({ error: "Evidence changed, was deleted, or the review transition is invalid. Refresh; the owner must re-suggest changed evidence." });
      return;
    }
    // Approval is deliberately an app-owned reviewed candidate, never SDE
    // verification, publication consent, or an elevation/completion award.
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Choose a valid review status, revision and notes" }); return; }
    req.log.error({ error }, "Activity review decision failed");
    res.status(503).json({ error: "Trail review could not be saved" });
  }
});
export default router;
