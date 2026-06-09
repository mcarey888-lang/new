import { Router, type IRouter } from "express";
import { db, trackedRoutes } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

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

router.post("/tracked-routes", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  try {
    await db.insert(trackedRoutes).values({
      id:            d.id,
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
        id:            trackedRoutes.id,
        name:          trackedRoutes.name,
        location:      trackedRoutes.location,
        distanceKm:    trackedRoutes.distanceKm,
        elevationGain: trackedRoutes.elevationGain,
        elevationLoss: trackedRoutes.elevationLoss,
        durationSecs:  trackedRoutes.durationSecs,
        difficulty:    trackedRoutes.difficulty,
        startLat:      trackedRoutes.startLat,
        startLng:      trackedRoutes.startLng,
        notes:         trackedRoutes.notes,
        submittedAt:   trackedRoutes.submittedAt,
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

router.delete("/tracked-routes/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Missing route id" });
    return;
  }
  try {
    await db.delete(trackedRoutes).where(eq(trackedRoutes.id, id));
    req.log.info({ id }, "Tracked route deleted");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete tracked route");
    res.status(500).json({ error: "Failed to delete route" });
  }
});

export default router;
