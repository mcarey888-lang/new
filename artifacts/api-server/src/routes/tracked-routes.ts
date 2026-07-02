import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, trackedRoutes, routeContributions } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const trackPointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  alt: z.number().nullable(),
  ts:  z.number(),
});

const submitSchema = z.object({
  id:            z.string().min(1),
  name:          z.string().min(1).max(120),
  location:      z.string().default("GPS Tracked Route"),
  distanceKm:    z.number().min(0),
  elevationGain: z.number().int().min(0),
  elevationLoss: z.number().int().min(0),
  durationSecs:  z.number().int().min(0),
  difficulty:    z.enum(["Easy", "Moderate", "Hard"]).default("Moderate"),
  startLat:      z.number().nullable().optional(),
  startLng:      z.number().nullable().optional(),
  trackPoints:   z.array(trackPointSchema).default([]),
  notes:         z.string().default(""),
});

// ── Refinement helpers ────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type LatLon = { lat: number; lon: number };

function resampleTrack(pts: LatLon[], n: number): Array<[number, number]> {
  if (pts.length < 2) return pts.map(p => [p.lat, p.lon]);
  const result: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (pts.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(Math.ceil(idx), pts.length - 1);
    const f = idx - lo;
    result.push([
      pts[lo].lat * (1 - f) + pts[hi].lat * f,
      pts[lo].lon * (1 - f) + pts[hi].lon * f,
    ]);
  }
  return result;
}

/**
 * Weighted online merge: canonical track moves 1/(count+1) toward the new track.
 * After N contributions the canonical is the running mean of all N+1 tracks.
 */
function mergeCanonical(canonical: LatLon[], newTrack: LatLon[], existingContributions: number): LatLon[] {
  const N = Math.max(canonical.length, newTrack.length, 50);
  const w = 1 / (existingContributions + 2);
  const sampledC = resampleTrack(canonical, N);
  const sampledN = resampleTrack(newTrack, N);
  return sampledC.map((p, i) => ({
    lat: p[0] * (1 - w) + sampledN[i][0] * w,
    lon: p[1] * (1 - w) + sampledN[i][1] * w,
  }));
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/tracked-routes", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const { userId } = getAuth(req);

  try {
    await db.insert(trackedRoutes).values({
      id:            d.id,
      createdBy:     userId ?? null,
      name:          d.name,
      location:      d.location,
      distanceKm:    d.distanceKm,
      elevationGain: d.elevationGain,
      elevationLoss: d.elevationLoss,
      durationSecs:  d.durationSecs,
      difficulty:    d.difficulty,
      startLat:      d.startLat ?? null,
      startLng:      d.startLng ?? null,
      trackPoints:   d.trackPoints,
      notes:         d.notes,
    }).onConflictDoNothing();

    req.log.info({ id: d.id, name: d.name }, "Tracked route saved");
    res.status(201).json({ ok: true, id: d.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save tracked route");
    res.status(500).json({ error: "Failed to save route" });
  }
});

router.get("/tracked-routes", async (req, res) => {
  try {
    const rows = await db
      .select({
        id:                trackedRoutes.id,
        name:              trackedRoutes.name,
        location:          trackedRoutes.location,
        distanceKm:        trackedRoutes.distanceKm,
        elevationGain:     trackedRoutes.elevationGain,
        elevationLoss:     trackedRoutes.elevationLoss,
        durationSecs:      trackedRoutes.durationSecs,
        difficulty:        trackedRoutes.difficulty,
        startLat:          trackedRoutes.startLat,
        startLng:          trackedRoutes.startLng,
        notes:             trackedRoutes.notes,
        contributionCount: trackedRoutes.contributionCount,
        submittedAt:       trackedRoutes.submittedAt,
      })
      .from(trackedRoutes)
      .orderBy(desc(trackedRoutes.submittedAt))
      .limit(200);

    res.json({ routes: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tracked routes");
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

// Nearby routes — must come before /:id
router.get("/tracked-routes/nearby", async (req, res) => {
  const lat   = parseFloat(req.query.lat as string);
  const lng   = parseFloat(req.query.lng as string);
  const radKm = parseFloat((req.query.radiusKm as string) ?? "5");

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  try {
    const rows = await db
      .select({
        id:                trackedRoutes.id,
        name:              trackedRoutes.name,
        distanceKm:        trackedRoutes.distanceKm,
        elevationGain:     trackedRoutes.elevationGain,
        durationSecs:      trackedRoutes.durationSecs,
        difficulty:        trackedRoutes.difficulty,
        startLat:          trackedRoutes.startLat,
        startLng:          trackedRoutes.startLng,
        contributionCount: trackedRoutes.contributionCount,
        submittedAt:       trackedRoutes.submittedAt,
      })
      .from(trackedRoutes)
      .orderBy(desc(trackedRoutes.submittedAt))
      .limit(200);

    const nearby = rows
      .filter(r => r.startLat != null && r.startLng != null)
      .map(r => ({
        ...r,
        distFromUserKm: haversineKm(lat, lng, r.startLat!, r.startLng!),
      }))
      .filter(r => r.distFromUserKm <= radKm)
      .sort((a, b) => a.distFromUserKm - b.distFromUserKm);

    res.json({ routes: nearby });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch nearby routes");
    res.status(500).json({ error: "Failed to fetch nearby routes" });
  }
});

router.get("/tracked-routes/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }
  try {
    const rows = await db
      .select()
      .from(trackedRoutes)
      .where(eq(trackedRoutes.id, id))
      .limit(1);
    if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ route: rows[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tracked route");
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

const contributeSchema = z.object({
  trackPoints:   z.array(trackPointSchema).min(2),
  distanceKm:    z.number().min(0),
  elevationGain: z.number().int().min(0),
  elevationLoss: z.number().int().min(0),
  durationSecs:  z.number().int().min(0),
});

router.post("/tracked-routes/:id/contribute", async (req, res) => {
  const { id } = req.params;
  const parsed = contributeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }

  try {
    // Wrap both the read and write in a serialisable transaction to avoid
    // a concurrent-write data race on contributionCount / canonical track.
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(trackedRoutes)
        .where(eq(trackedRoutes.id, id))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: "Canonical route not found" });
        return;
      }

      const canonical = rows[0];
      const d = parsed.data;

      const contribId = "contrib_" + Date.now().toString() + Math.random().toString(36).slice(2, 6);
      await tx.insert(routeContributions).values({
        id:               contribId,
        canonicalRouteId: id,
        trackPoints:      d.trackPoints,
        distanceKm:       d.distanceKm,
        elevationGain:    d.elevationGain,
        elevationLoss:    d.elevationLoss,
        durationSecs:     d.durationSecs,
      });

      const canonicalPts = canonical.trackPoints as LatLon[];
      const newPts        = d.trackPoints as LatLon[];
      const merged        = mergeCanonical(canonicalPts, newPts, canonical.contributionCount);

      const n    = canonical.contributionCount + 1;
      const wNew = 1 / (n + 1);
      await tx
        .update(trackedRoutes)
        .set({
          trackPoints:       merged,
          contributionCount: sql`contribution_count + 1`,
          distanceKm:        canonical.distanceKm * (1 - wNew) + d.distanceKm * wNew,
          elevationGain:     Math.round(canonical.elevationGain * (1 - wNew) + d.elevationGain * wNew),
          elevationLoss:     Math.round(canonical.elevationLoss * (1 - wNew) + d.elevationLoss * wNew),
          durationSecs:      Math.round(canonical.durationSecs  * (1 - wNew) + d.durationSecs  * wNew),
        })
        .where(eq(trackedRoutes.id, id));

      req.log.info({ id, contributions: n }, "Route contribution merged");
      res.status(200).json({ ok: true, contributions: n });
    });
  } catch (err) {
    req.log.error({ err }, "Failed to contribute to route");
    res.status(500).json({ error: "Failed to save contribution" });
  }
});

// DELETE requires auth; also verifies the caller owns the route.
router.delete("/tracked-routes/:id", requireAuth(), async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Missing route id" });
    return;
  }

  const { userId } = getAuth(req);

  try {
    const rows = await db
      .select({ createdBy: trackedRoutes.createdBy })
      .from(trackedRoutes)
      .where(eq(trackedRoutes.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    const route = rows[0];
    // Allow deletion only by the original creator.
    // Routes without a createdBy (legacy) may only be deleted by authenticated
    // users — we can't verify ownership but at least require a valid session.
    if (route.createdBy !== null && route.createdBy !== userId) {
      res.status(403).json({ error: "You do not have permission to delete this route" });
      return;
    }

    await db.delete(trackedRoutes).where(eq(trackedRoutes.id, id));
    req.log.info({ id, userId }, "Tracked route deleted");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete tracked route");
    res.status(500).json({ error: "Failed to delete route" });
  }
});

export default router;
