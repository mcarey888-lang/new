import { Router, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { publicDisplayName } from "../lib/publicDisplayName";
import { activityDiscoveryQuery, communityDiscoveryFilters } from "../services/activityCommunityDiscovery";

const router = Router();
const audience = z.enum(["public", "followers", "private"]);
const publicationKey = z.object({ owner: z.string().min(1).max(256), hikeId: z.string().min(1).max(256) });
const canRead = (viewer: string) => sql`(p.owner=${viewer} OR p.audience='public' OR
 (p.audience='followers' AND EXISTS(SELECT 1 FROM activity_follows f WHERE f.follower=${viewer} AND f.followed=p.owner)))`;
type Row = Record<string, any>;
async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  return (await db.execute(query)).rows as Row[];
}
function safeSnapshot(snapshot: Row) {
  return Object.fromEntries(["id", "name", "date", "distance", "elevationGain", "elevationLoss", "timeTaken",
    "notes", "trackPoints", "elevationQuality", "elevationCorrection"].filter(k => k in snapshot).map(k => [k, snapshot[k]]));
}
async function response(row: Row, geometry: boolean) {
  let author = { name: "SummitReady member", avatarUrl: null as string | null };
  try {
    const user = await clerkClient.users.getUser(row.owner);
    author = { name: publicDisplayName(user), avatarUrl: user.imageUrl };
  } catch { /* Optional enrichment cannot invalidate an acknowledged read. */ }
  const snapshot = safeSnapshot(row.snapshot);
  const trace = snapshot.trackPoints;
  const first = Array.isArray(trace) ? trace.find(point =>
    point && typeof point.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    typeof point.lon === "number" && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180) : undefined;
  if (!geometry) delete snapshot.trackPoints;
  return { owner: row.owner, hikeId: row.hike_id, audience: row.audience,
    author, source: "user_recording", verified: false, snapshot,
    startPoint: first ? { lat: first.lat, lon: first.lon } : null };
}
function handler(fn: (req: Request, res: Response, viewer: string) => Promise<void>) {
  return async (req: Request, res: Response) => {
    const viewer = getAuth(req).userId;
    if (!viewer) { res.status(401).json({ error: "Sign in required" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    try { await fn(req, res, viewer); }
    catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: "Invalid activity request" }); return; }
      req.log.error({ error }, "Activity community request failed");
      res.status(503).json({ error: "Activity sharing is unavailable. Your saved recording is unchanged." });
    }
  };
}
router.use("/activity-community", requireAuth({ json: true }));
router.get("/activity-community/preferences", handler(async (_req, res, viewer) => {
  const data = await rows(sql`SELECT audience FROM activity_preferences WHERE owner=${viewer}`);
  res.json({ audience: data[0]?.audience ?? null, publicAccess: "signed_in_members" });
}));
router.put("/activity-community/preferences", handler(async (req, res, viewer) => {
  const d = z.object({ audience }).parse(req.body);
  await db.execute(sql`INSERT INTO activity_preferences(owner,audience) VALUES(${viewer},${d.audience})
    ON CONFLICT(owner) DO UPDATE SET audience=EXCLUDED.audience`);
  res.json({ ok: true, audience: d.audience });
}));
router.put("/activity-community/follows/:owner", handler(async (req, res, viewer) => {
  const owner = z.string().min(1).max(256).parse(req.params.owner);
  if (owner === viewer) { res.status(400).json({ error: "You cannot follow yourself" }); return; }
  await clerkClient.users.getUser(owner);
  await db.execute(sql`INSERT INTO activity_follows(follower,followed) VALUES(${viewer},${owner}) ON CONFLICT DO NOTHING`);
  res.json({ ok: true });
}));
router.delete("/activity-community/follows/:owner", handler(async (req, res, viewer) => {
  const owner = z.string().parse(req.params.owner);
  await db.execute(sql`DELETE FROM activity_follows WHERE follower=${viewer} AND followed=${owner}`);
  res.status(204).end();
}));
router.get("/activity-community", handler(async (req, res, viewer) => {
  const q = activityDiscoveryQuery.parse(req.query);
  const discovery = communityDiscoveryFilters(q);
  const nearby = q.lat != null && q.lng != null ? sql`AND b.snapshot->'trackPoints'->0 IS NOT NULL
    AND 6371*2*asin(least(1.0,sqrt(
      power(sin(radians((b.snapshot->'trackPoints'->0->>'lat')::float-${q.lat})/2),2) +
      cos(radians(${q.lat}))*cos(radians((b.snapshot->'trackPoints'->0->>'lat')::float)) *
      power(sin(radians((b.snapshot->'trackPoints'->0->>'lon')::float-${q.lng})/2),2)
    ))) <= ${q.radiusKm}` : sql``;
  const saved = q.saved ? sql`AND EXISTS(SELECT 1 FROM activity_bookmarks s WHERE s.viewer=${viewer} AND s.owner=p.owner AND s.hike_id=p.hike_id)` : sql``;
  const data = await rows(sql`SELECT p.owner,p.hike_id,p.audience,b.snapshot FROM activity_publications p
    JOIN recorded_hike_backups b ON b.owner_user_id=p.owner AND b.hike_id=p.hike_id
    WHERE ${canRead(viewer)} ${discovery} ${nearby} ${saved}
    AND NOT EXISTS(SELECT 1 FROM activity_route_reports r WHERE r.reporter=${viewer} AND r.owner=p.owner AND r.hike_id=p.hike_id)
    ORDER BY p.updated_at DESC,p.owner,p.hike_id LIMIT 21 OFFSET ${q.page*20}`);
  res.json({ routes: await Promise.all(data.slice(0,20).map(r => response(r, false))), hasMore: data.length>20 });
}));
router.get("/activity-community/:owner/:hikeId", handler(async (req, res, viewer) => {
  const d = publicationKey.parse(req.params);
  const data = await rows(sql`SELECT p.owner,p.hike_id,p.audience,b.snapshot,
    EXISTS(SELECT 1 FROM activity_follows f WHERE f.follower=${viewer} AND f.followed=p.owner) AS followed
    FROM activity_publications p JOIN recorded_hike_backups b ON b.owner_user_id=p.owner AND b.hike_id=p.hike_id
    WHERE p.owner=${d.owner} AND p.hike_id=${d.hikeId} AND ${canRead(viewer)}`);
  if (!data[0]) { res.status(404).json({ error: "This route is no longer available to you" }); return; }
  res.json({ route: await response(data[0], true), followed: data[0].followed });
}));
router.put("/activity-community/:owner/:hikeId/audience", handler(async (req, res, viewer) => {
  const d = publicationKey.parse(req.params), a = audience.parse(req.body?.audience);
  if (d.owner !== viewer) { res.status(404).json({ error: "Activity not found" }); return; }
  const revision=new Date().toISOString();
  const inserted = await rows(sql`INSERT INTO activity_publications(owner,hike_id,audience,audience_revision)
    SELECT owner_user_id,hike_id,${a},${revision} FROM recorded_hike_backups WHERE owner_user_id=${viewer} AND hike_id=${d.hikeId}
    ON CONFLICT(owner,hike_id) DO UPDATE SET audience=EXCLUDED.audience,audience_revision=EXCLUDED.audience_revision,updated_at=now() RETURNING hike_id`);
  if (!inserted.length) { res.status(409).json({ error: "Sync this recording before changing its shared audience" }); return; }
  res.json({ ok: true, audience: a,sharingRevision:revision });
}));
router.post("/activity-community/:owner/:hikeId/action", handler(async (req, res, viewer) => {
  const d = publicationKey.parse(req.params);
  const action = z.enum(["save", "unsave", "report", "suggest"]).parse(req.body?.action);
  const data = await rows(sql`SELECT p.owner,p.hike_id,p.audience,b.revision FROM activity_publications p
    JOIN recorded_hike_backups b ON b.owner_user_id=p.owner AND b.hike_id=p.hike_id
    WHERE p.owner=${d.owner} AND p.hike_id=${d.hikeId} AND ${canRead(viewer)}`);
  if (!data[0]) { res.status(404).json({ error: "Route not available" }); return; }
  if (action === "save") await db.execute(sql`INSERT INTO activity_bookmarks(viewer,owner,hike_id) VALUES(${viewer},${d.owner},${d.hikeId}) ON CONFLICT DO NOTHING`);
  if (action === "unsave") await db.execute(sql`DELETE FROM activity_bookmarks WHERE viewer=${viewer} AND owner=${d.owner} AND hike_id=${d.hikeId}`);
  if (action === "report") {
    if (viewer === d.owner) { res.status(400).json({ error: "You cannot report your own route" }); return; }
    const reason = z.string().trim().min(1).max(1000).parse(req.body?.reason);
    await db.execute(sql`INSERT INTO activity_route_reports(reporter,owner,hike_id,reason) VALUES(${viewer},${d.owner},${d.hikeId},${reason}) ON CONFLICT DO NOTHING`);
  }
  if (action === "suggest") {
    if (viewer !== d.owner) { res.status(403).json({ error: "Only the author can suggest their original route" }); return; }
    await db.execute(sql`INSERT INTO activity_trail_suggestions(owner,hike_id,evidence_revision)
      VALUES(${viewer},${d.hikeId},${data[0].revision})
      ON CONFLICT(owner,hike_id) DO UPDATE SET evidence_revision=excluded.evidence_revision,
        status='pending',review_notes=NULL,reviewed_at=NULL
      WHERE activity_trail_suggestions.evidence_revision<>excluded.evidence_revision`);
  }
  res.json({ ok: true, ...(action === "suggest" ? { status: "pending", verified: false } : {}) });
}));
export default router;
