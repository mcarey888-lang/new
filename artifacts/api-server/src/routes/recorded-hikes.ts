import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db,activityPublications } from "@workspace/db";
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
  audience: z.enum(["public", "followers", "private"]).optional(),
  sharingRevision: z.string().datetime().optional(),
  sharingIntentConfirmed: z.boolean().optional(),
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
    const saved = await db.transaction(async tx => {
    const intentRevision=data.snapshot.sharingRevision??data.revision;
    if(data.snapshot.sharingIntentConfirmed && data.snapshot.audience){
      const [current]=await tx.select().from(activityPublications)
        .where(and(eq(activityPublications.owner,userId),eq(activityPublications.hikeId,data.hikeId))).limit(1);
      if(current && current.audience!==data.snapshot.audience && current.audienceRevision>=intentRevision)
        throw new Error("SHARING_INTENT_CONFLICT");
    }
    const accepted = await tx.insert(recordedHikeBackups).values({
      ownerUserId: userId, hikeId: data.hikeId, snapshot: data.snapshot, revision: data.revision,
    }).onConflictDoUpdate({
      target: [recordedHikeBackups.ownerUserId, recordedHikeBackups.hikeId],
      set: { snapshot: data.snapshot, revision: data.revision, updatedAt: new Date() },
      setWhere: lte(recordedHikeBackups.revision, data.revision),
    }).returning({ revision: recordedHikeBackups.revision });
    if (accepted.length && data.snapshot.sharingIntentConfirmed === true && data.snapshot.audience) {
      await tx.execute(sql`INSERT INTO activity_publications(owner,hike_id,audience,audience_revision)
        VALUES(${userId},${data.hikeId},${data.snapshot.audience},${data.snapshot.sharingRevision??data.revision})
        ON CONFLICT(owner,hike_id) DO UPDATE SET audience=EXCLUDED.audience,audience_revision=EXCLUDED.audience_revision,updated_at=now()
        WHERE EXCLUDED.audience_revision >= activity_publications.audience_revision`);
    }
    return accepted;
    });
    if (!saved.length) return res.status(409).json({ error: "A newer backup exists. Your local recording is unchanged." });
    return res.json({ ok: true, hikeId: data.hikeId, revision: data.revision });
  } catch (error) {
    if(error instanceof Error && error.message==="SHARING_INTENT_CONFLICT")
      return res.status(409).json({error:"A newer audience selection exists. Refresh this activity and explicitly choose its audience again."});
    req.log.error({ error }, "Private recorded hike backup failed");
    return res.status(503).json({ error: "Private backup is unavailable. Your phone copy is unchanged." });
  }
});

router.get("/recorded-hikes", requireAuth({ json: true }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    const backups = await db.select({
      hikeId: recordedHikeBackups.hikeId, revision: recordedHikeBackups.revision,
      snapshot: recordedHikeBackups.snapshot, updatedAt: recordedHikeBackups.updatedAt,
    }).from(recordedHikeBackups).where(and(eq(recordedHikeBackups.ownerUserId, userId),
      cursor ? sql`${recordedHikeBackups.hikeId} > ${cursor}` : undefined))
      .orderBy(recordedHikeBackups.hikeId).limit(101);
    const publications=await db.select().from(activityPublications).where(eq(activityPublications.owner,userId));
    const policies=new Map(publications.map(p=>[p.hikeId,p]));
    return res.json({ backups: backups.slice(0,100).map(b=>{
      const policy=policies.get(b.hikeId);
      return policy?{...b,snapshot:{...b.snapshot,audience:policy.audience,sharingRevision:policy.audienceRevision,sharingIntentConfirmed:true}}:b;
    }), nextCursor: backups.length > 100 ? backups[99].hikeId : null });
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
