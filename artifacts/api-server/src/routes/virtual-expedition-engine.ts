/**
 * Virtual Expedition Engine — API routes
 *
 * Public endpoints (no auth): read-only expedition/route/match data
 * Admin endpoints: recalculate DNA and matches (protected by requireAdminAuth middleware)
 */

import { Router, type IRouter } from "express";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  virtualExpeditions,
  expeditionRoutes,
  trainingRoutes,
  routeDna,
  routeMatches,
  importReviewItems,
} from "@workspace/db/schema";
import type { InsertRouteDna } from "@workspace/db/schema";
import { eq, and, desc, isNotNull, count } from "drizzle-orm";
import { calculateDna, upsertExpeditionDna, upsertTrainingDna } from "../services/routeDna.js";
import {
  matchExpeditionRouteAgainstTraining,
  recalculateAllMatches,
  loadActiveWeights,
} from "../services/routeMatching.js";

const router: IRouter = Router();

// Admin routes are protected by requireAdminAuth() — the unified admin middleware.
// VIRTUAL_ENGINE_ADMIN_KEY is no longer used; ADMIN_API_KEY (session tokens) covers all admin.

// ── GET /api/vx/expeditions ───────────────────────────────────────────────────

router.get("/vx/expeditions", async (req, res) => {
  const featuredOnly = req.query.featured === "true";

  try {
    // Get expeditions with route counts
    const rows = await db
      .select({
        id:                    virtualExpeditions.id,
        mountainSlug:          virtualExpeditions.mountainSlug,
        spreadsheetMountainId: virtualExpeditions.spreadsheetMountainId,
        name:                  virtualExpeditions.name,
        countryRegion:         virtualExpeditions.countryRegion,
        continent:             virtualExpeditions.continent,
        summitAltitudeM:       virtualExpeditions.summitAltitudeM,
        category:              virtualExpeditions.category,
        primaryGoal:           virtualExpeditions.primaryGoal,
        altitudeRisk:          virtualExpeditions.altitudeRisk,
        maxTechnicality:       virtualExpeditions.maxTechnicality,
        heroImageUrl:          virtualExpeditions.heroImageUrl,
        shortDescription:      virtualExpeditions.shortDescription,
        status:                virtualExpeditions.status,
        featured:              virtualExpeditions.featured,
        estimatedTrainingWeeks: virtualExpeditions.estimatedTrainingWeeks,
      })
      .from(virtualExpeditions)
      .where(
        featuredOnly
          ? and(eq(virtualExpeditions.status, "active"), eq(virtualExpeditions.featured, true))
          : eq(virtualExpeditions.status, "active")
      )
      .orderBy(desc(virtualExpeditions.featured), virtualExpeditions.name);

    // Attach route counts
    const routeCounts = await db
      .select({
        virtualExpeditionId: expeditionRoutes.virtualExpeditionId,
        routeCount: count(expeditionRoutes.id),
      })
      .from(expeditionRoutes)
      .where(eq(expeditionRoutes.active, true))
      .groupBy(expeditionRoutes.virtualExpeditionId);

    const countMap = new Map(routeCounts.map((r) => [r.virtualExpeditionId, r.routeCount]));

    const result = rows.map((exp) => ({
      ...exp,
      routeCount: countMap.get(exp.id) ?? 0,
    }));

    return res.json({ expeditions: result, total: result.length });
  } catch (err) {
    req.log.error({ err }, "GET /vx/expeditions failed");
    return res.status(500).json({ error: "Failed to fetch expeditions" });
  }
});

// ── GET /api/vx/expeditions/:mountainSlug ─────────────────────────────────────

router.get("/vx/expeditions/:mountainSlug", async (req, res) => {
  const { mountainSlug } = req.params;

  try {
    const [expedition] = await db
      .select()
      .from(virtualExpeditions)
      .where(eq(virtualExpeditions.mountainSlug, mountainSlug))
      .limit(1);

    if (!expedition) {
      return res.status(404).json({ error: `No expedition found for slug: ${mountainSlug}` });
    }

    const routes = await db
      .select()
      .from(expeditionRoutes)
      .where(
        and(
          eq(expeditionRoutes.virtualExpeditionId, expedition.id),
          eq(expeditionRoutes.active, true),
        )
      )
      .orderBy(expeditionRoutes.routeName);

    return res.json({ expedition, routes });
  } catch (err) {
    req.log.error({ err }, "GET /vx/expeditions/:mountainSlug failed");
    return res.status(500).json({ error: "Failed to fetch expedition" });
  }
});

// ── GET /api/vx/expedition-routes/:routeId ────────────────────────────────────

router.get("/vx/expedition-routes/:routeId", async (req, res) => {
  const routeId = Number(req.params.routeId);
  if (!Number.isFinite(routeId)) {
    return res.status(400).json({ error: "Invalid routeId" });
  }

  try {
    const [route] = await db
      .select()
      .from(expeditionRoutes)
      .where(eq(expeditionRoutes.id, routeId))
      .limit(1);

    if (!route) {
      return res.status(404).json({ error: "Expedition route not found" });
    }

    const [dna] = await db
      .select()
      .from(routeDna)
      .where(
        and(
          eq(routeDna.expeditionRouteId, routeId),
          eq(routeDna.calculationVersion, 1),
        )
      )
      .limit(1);

    return res.json({ route, dna: dna ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /vx/expedition-routes/:routeId failed");
    return res.status(500).json({ error: "Failed to fetch expedition route" });
  }
});

// ── GET /api/vx/expedition-routes/:routeId/matches ────────────────────────────

const MatchesQuerySchema = z.object({
  region: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/vx/expedition-routes/:routeId/matches", async (req, res) => {
  const routeId = Number(req.params.routeId);
  if (!Number.isFinite(routeId)) {
    return res.status(400).json({ error: "Invalid routeId" });
  }

  const parsed = MatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.issues });
  }

  const { region, limit } = parsed.data;

  try {
    const { results, expeditionRoute, warnings } = await matchExpeditionRouteAgainstTraining(
      routeId,
      { regionFilter: region, limit },
    );

    if (!expeditionRoute) {
      return res.status(404).json({ error: "Expedition route not found" });
    }

    return res.json({
      expeditionRoute,
      matches: results,
      globalWarnings: warnings,
      matchCount: results.length,
      regionFilter: region ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /vx/expedition-routes/:routeId/matches failed");
    return res.status(500).json({ error: "Failed to compute matches" });
  }
});

// ── GET /api/vx/training-routes ───────────────────────────────────────────────

router.get("/vx/training-routes", async (req, res) => {
  const region = req.query.region as string | undefined;

  try {
    const conditions = [eq(trainingRoutes.active, true)];
    if (region) conditions.push(eq(trainingRoutes.region, region));

    const rows = await db
      .select()
      .from(trainingRoutes)
      .where(and(...conditions))
      .orderBy(trainingRoutes.region, trainingRoutes.mountainHill, trainingRoutes.routeName);

    return res.json({ trainingRoutes: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /vx/training-routes failed");
    return res.status(500).json({ error: "Failed to fetch training routes" });
  }
});

// ── GET /api/vx/training-routes/:routeId ─────────────────────────────────────

router.get("/vx/training-routes/:routeId", async (req, res) => {
  const routeId = Number(req.params.routeId);
  if (!Number.isFinite(routeId)) {
    return res.status(400).json({ error: "Invalid routeId" });
  }

  try {
    const [route] = await db
      .select()
      .from(trainingRoutes)
      .where(eq(trainingRoutes.id, routeId))
      .limit(1);

    if (!route) {
      return res.status(404).json({ error: "Training route not found" });
    }

    const [dna] = await db
      .select()
      .from(routeDna)
      .where(
        and(
          eq(routeDna.trainingRouteId, routeId),
          eq(routeDna.calculationVersion, 1),
        )
      )
      .limit(1);

    return res.json({ route, dna: dna ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /vx/training-routes/:routeId failed");
    return res.status(500).json({ error: "Failed to fetch training route" });
  }
});

// ── GET /api/vx/admin/review-queue ────────────────────────────────────────────

router.get("/vx/admin/review-queue", requireAdminAuth(), async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(importReviewItems)
      .where(eq(importReviewItems.status, "pending"))
      .orderBy(desc(importReviewItems.createdAt));

    return res.json({ items: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /vx/admin/review-queue failed");
    return res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

// ── POST /api/vx/admin/recalculate-dna ───────────────────────────────────────

const RecalcDnaBodySchema = z.object({
  routeId:   z.number().int().positive().optional(),
  routeType: z.enum(["expedition", "training"]).optional(),
}).optional();

router.post("/vx/admin/recalculate-dna", requireAdminAuth(), async (req, res) => {
  const parsed = RecalcDnaBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  const { routeId, routeType } = parsed.data ?? {};

  try {
    let expUpdated = 0;
    let trainUpdated = 0;

    // Helper: upsert DNA for an expedition route
    async function recalcExpeditionRoute(route: import("@workspace/db/schema").ExpeditionRoute) {
      const scores = calculateDna(
        {
          ascentM:                 route.ascentM,
          descentM:                route.descentM,
          distanceKm:              route.distanceKm,
          typicalDays:             route.typicalDays,
          longestContinuousClimbM: route.longestContinuousClimbM,
          avgGradientPct:          route.avgGradientPct,
          maxGradientPct:          route.maxGradientPct,
          trailPct:                route.trailPct,
          rockPct:                 route.rockPct,
          screePct:                route.screePct,
          snowIcePct:              route.snowIcePct,
          glacierPct:              route.glacierPct,
          scramblingPct:           route.scramblingPct,
          viaFerrataPct:           route.viaFerrataPct,
          exposure15:              route.exposure15,
          navigation15:            route.navigation15,
          endurance15:             route.endurance15,
          loadCarry15:             route.loadCarry15,
          technicality15:          route.technicality15,
          altitude15:              route.altitude15,
        },
        "expedition",
      );
      await upsertExpeditionDna(route.id, scores);
      expUpdated++;
    }

    // Helper: upsert DNA for a training route
    async function recalcTrainingRoute(route: import("@workspace/db/schema").TrainingRoute) {
      const scores = calculateDna(
        {
          ascentM:                 route.ascentM,
          descentM:                route.descentM,
          distanceKm:              route.distanceKm,
          typicalHours:            route.typicalHours,
          longestContinuousClimbM: route.longestContinuousClimbM,
          avgGradientPct:          route.avgGradientPct,
          maxGradientPct:          route.maxGradientPct,
          trailPct:                route.trailPct,
          rockPct:                 route.rockPct,
          screePct:                route.screePct,
          snowIcePct:              route.snowIcePct,
          scramblingPct:           route.scramblingPct,
          viaFerrataPct:           route.viaFerrataPct,
          exposure15:              route.exposure15,
          navigation15:            route.navigation15,
          endurance15:             route.endurance15,
          loadCarry15:             route.loadCarry15,
          technicality15:          route.technicality15,
        },
        "training",
      );
      await upsertTrainingDna(route.id, scores);
      trainUpdated++;
    }

    if (routeId && routeType === "expedition") {
      const [route] = await db.select().from(expeditionRoutes).where(eq(expeditionRoutes.id, routeId)).limit(1);
      if (!route) return res.status(404).json({ error: "Expedition route not found" });
      await recalcExpeditionRoute(route);
    } else if (routeId && routeType === "training") {
      const [route] = await db.select().from(trainingRoutes).where(eq(trainingRoutes.id, routeId)).limit(1);
      if (!route) return res.status(404).json({ error: "Training route not found" });
      await recalcTrainingRoute(route);
    } else {
      // Recalculate all
      const allExpRoutes = await db.select().from(expeditionRoutes).where(eq(expeditionRoutes.active, true));
      for (const route of allExpRoutes) await recalcExpeditionRoute(route);

      const allTrainRoutes = await db.select().from(trainingRoutes).where(eq(trainingRoutes.active, true));
      for (const route of allTrainRoutes) await recalcTrainingRoute(route);
    }

    writeAuditLog(res.locals.adminIdentity, "vx-recalculate-dna", null, {
      expeditionRoutesUpdated: expUpdated,
      trainingRoutesUpdated:   trainUpdated,
    });
    return res.json({
      ok: true,
      expeditionRoutesUpdated: expUpdated,
      trainingRoutesUpdated:   trainUpdated,
      totalUpdated:            expUpdated + trainUpdated,
    });
  } catch (err) {
    req.log.error({ err }, "POST /vx/admin/recalculate-dna failed");
    return res.status(500).json({ error: "DNA recalculation failed" });
  }
});

// ── POST /api/vx/admin/recalculate-matches ────────────────────────────────────

router.post("/vx/admin/recalculate-matches", requireAdminAuth(), async (req, res) => {
  try {
    const { created, updated } = await recalculateAllMatches();

    writeAuditLog(res.locals.adminIdentity, "vx-recalculate-matches", null, { created, updated });
    return res.json({
      ok: true,
      matchesProcessed: created + updated,
      created,
      updated,
    });
  } catch (err) {
    req.log.error({ err }, "POST /vx/admin/recalculate-matches failed");
    return res.status(500).json({ error: "Match recalculation failed" });
  }
});

export default router;
