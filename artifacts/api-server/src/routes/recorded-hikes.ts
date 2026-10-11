import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { recordedHikeBackups } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const snapshotSchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().min(1).max(256),
  date: z.string().datetime().or(z.string().date()),
  distance: z.number().finite().nonnegative(),
  elevationGain: z.number().finite().nonnegative(),
  timeTaken: z.number().finite().nonnegative(),
  notes: z.string().max(20000),
  trackPoints: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt: z.number().finite().nullable().optional(),
    ts: z.number().finite().optional(),
    acc: z.number().finite().nullable().optional(),
    altAcc: z.number().finite().nullable().optional(),
  }).passthrough()).max(100000).optional(),
}).passthrough();
const backupSchema = z.object({
  hikeId: z.string().min(1).max(256),
  revision: z.string().datetime().refine(value => new Date(value).toISOString() === value, "Revision must use canonical ISO milliseconds"),
  snapshot: snapshotSchema,
}).refine(value => value.hikeId === value.snapshot.id, "Hike identity mismatch");

router.put("/recorded-hikes", requireAuth({ json: true }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  const parsed = backupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid recorded hike" });
  try {
    const data = parsed.data;
    // Sequence updates on the same device; repeated revisions are idempotent.
    const saved = await db.insert(recordedHikeBackups).values({
      ownerUserId: userId, hikeId: data.hikeId, snapshot: data.snapshot, revision: data.revision,
    }).onConflictDoUpdate({
      target: [recordedHikeBackups.ownerUserId, recordedHikeBackups.hikeId],
      set: { snapshot: data.snapshot, revision: data.revision, updatedAt: new Date() },
      setWhere: lte(recordedHikeBackups.revision, data.revision),
    }).returning({ revision: recordedHikeBackups.revision });
    if (!saved.length) return res.status(409).json({ error: "A newer backup exists. Your local recording is unchanged." });
    return res.json({ ok: true, hikeId: data.hikeId, revision: data.revision });
  } catch (error) {
    req.log.error({ error }, "Private recorded hike backup failed");
    return res.status(503).json({ error: "Private backup is unavailable. Your phone copy is unchanged." });
  }
});

router.get("/recorded-hikes", requireAuth({ json: true }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const backups = await db.select({
      hikeId: recordedHikeBackups.hikeId, revision: recordedHikeBackups.revision,
      snapshot: recordedHikeBackups.snapshot, updatedAt: recordedHikeBackups.updatedAt,
    }).from(recordedHikeBackups).where(eq(recordedHikeBackups.ownerUserId, userId))
      .orderBy(desc(recordedHikeBackups.updatedAt)).limit(100);
    return res.json({ backups });
  } catch (error) {
    req.log.error({ error }, "Private recorded hike backup read failed");
    return res.status(503).json({ error: "Private backups are unavailable" });
  }
});

router.delete("/recorded-hikes/:id", requireAuth({ json: true }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  try {
    await db.delete(recordedHikeBackups).where(and(
      eq(recordedHikeBackups.ownerUserId, userId),
      eq(recordedHikeBackups.hikeId, String(req.params.id)),
    ));
    return res.status(204).end();
  } catch (error) {
    req.log.error({ error }, "Private recorded hike backup delete failed");
    return res.status(503).json({ error: "Private backup could not be deleted" });
  }
});

export default router;
