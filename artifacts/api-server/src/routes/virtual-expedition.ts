/**
 * POST /api/virtual-expedition
 *
 * Phase 1 Stage 2 — Virtual Expeditions backend endpoint.
 *
 * Input:  { targetMountain: string, userLocation: string, radius?: number }
 * Output: { targetProfile, recommendedHills, weekendPairing?, simulationScore, scoreBreakdown }
 *
 * Step 1 — GPT-4o lookup of target mountain profile (DB-cached, 7-day TTL).
 * Step 2 — Local hill discovery via Overpass + osmPeaksToHills (AI fallback if sparse).
 * Step 3 — Greedy nearest-match hill selection (1-day: single hill + reps; 2-day: weekend pairing).
 * Step 4 — Physical Simulation Score: elevation / duration / altitude / consecutiveDays (4 of 6 dimensions).
 */

import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, cachedMountains } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  type Hill,
  HillSchema,
  LOOKUP_SYSTEM_PROMPT,
  geocodeLocation,
  fetchOSMPeaks,
  osmPeaksToHills,
  fetchTopoElevations,
  validateAndCorrectHills,
  applyTerrainElevationBatch,
  parseAIJson,
  normalizeLocation,
} from "./hills-unified";

const router: IRouter = Router();

// ── Target mountain profile schema ────────────────────────────────────────────

const TargetMountainProfileSchema = z.object({
  name: z.string(),
  country: z.string(),
  summitElevation: z.number().positive(),
  totalElevationGain: z.number().positive(),
  totalDistance: z.number().positive(),
  // AI may return realistic trek lengths (e.g. 7 for EBC). Clamp to 1 or 2
  // for our weekend-pairing logic: 1 = single-day summit, 2 = two-day outing.
  estimatedDays: z
    .number()
    .int()
    .positive()
    .transform(d => (d >= 2 ? 2 : 1) as 1 | 2),
  day1ElevationGain: z.number().positive().optional().nullable(),
  day2ElevationGain: z.number().positive().optional().nullable(),
  maxDailyElevation: z.number().positive(),
  difficulty: z.enum(["Easy", "Moderate", "Hard", "Alpine"]),
  technicalGrade: z.string().optional().nullable(),
  altitudeExposure: z.enum(["None", "Moderate", "High", "Extreme"]),
  notes: z.string(),
});

type TargetMountainProfile = z.infer<typeof TargetMountainProfileSchema>;

// ── DB cache helpers (7-day TTL, reuses cachedMountains table) ────────────────

const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_SLUG_PREFIX = "virt-mt-";

function mountainSlug(name: string): string {
  return PROFILE_SLUG_PREFIX + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function getProfileFromCache(slug: string): Promise<TargetMountainProfile | null> {
  try {
    const rows = await db.select().from(cachedMountains).where(eq(cachedMountains.slug, slug)).limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    if (Date.now() - new Date(row.cachedAt).getTime() > PROFILE_CACHE_TTL_MS) return null;
    const parsed = TargetMountainProfileSchema.safeParse(JSON.parse(row.data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function saveProfileToCache(slug: string, profile: TargetMountainProfile): Promise<void> {
  try {
    const data = JSON.stringify(profile);
    await db
      .insert(cachedMountains)
      .values({ slug, data })
      .onConflictDoUpdate({ target: cachedMountains.slug, set: { data, cachedAt: new Date() } });
  } catch {
    // Non-fatal
  }
}

// ── In-memory area cache (keyed by "location|radius", 30-min TTL) ─────────────

const areaCache = new Map<string, { hills: Hill[]; userLat: number; userLng: number; ts: number }>();
const AREA_CACHE_TTL_MS = 30 * 60 * 1000;

// ── GPT-4o mountain profile prompt ───────────────────────────────────────────

const MOUNTAIN_SYSTEM_PROMPT = `You are an expert mountaineering guide with encyclopaedic knowledge of summits worldwide. Given a mountain name, return accurate data about climbing it using the most commonly used standard route. Return ONLY valid JSON — no markdown, no explanation:

{
  "name": string,
  "country": string,
  "summitElevation": number,
  "totalElevationGain": number,
  "totalDistance": number,
  "estimatedDays": 1 | 2,
  "day1ElevationGain": number | null,
  "day2ElevationGain": number | null,
  "maxDailyElevation": number,
  "difficulty": "Easy" | "Moderate" | "Hard" | "Alpine",
  "technicalGrade": string | null,
  "altitudeExposure": "None" | "Moderate" | "High" | "Extreme",
  "notes": string
}

Field definitions:
- summitElevation: metres above sea level at the summit
- totalElevationGain: total vertical metres gained from the standard trailhead (sum of all ascent on the route)
- totalDistance: km for the full round trip or traverse
- estimatedDays: 1 for peaks typically done in a single day; 2 for hut-to-hut or multi-day ascents
- day1ElevationGain / day2ElevationGain: gain on each day when estimatedDays=2; null when estimatedDays=1
- maxDailyElevation: the highest gain on any single day of the ascent
- difficulty: Easy <600m gain, clear path; Moderate 600–1000m, rough terrain; Hard 1000–1500m or sustained steep; Alpine >1500m or glaciers/high altitude
- technicalGrade: UIAA/PD/AD/D/TD grade if the route requires technical climbing, else null
- altitudeExposure: None <1500m summit; Moderate 1500–2500m; High 2500–4000m; Extreme >4000m
- notes: 1–2 sentences on what distinguishes this mountain as a training simulation target

Use real, researched figures. For well-known mountains (Ben Nevis, Mont Blanc, Kilimanjaro, Snowdon, Helvellyn, etc.) use verified published data.`;

// ── Duration helpers ──────────────────────────────────────────────────────────

/** Parse a human-readable time string (e.g. "2–3 hrs", "1.5 hrs", "45 mins") into minutes. */
function parseEstimatedMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const rangeHours = s.match(/(\d+\.?\d*)\s*[–\-]\s*(\d+\.?\d*)\s*h/i);
  if (rangeHours) return ((parseFloat(rangeHours[1]) + parseFloat(rangeHours[2])) / 2) * 60;
  const singleHours = s.match(/(\d+\.?\d*)\s*h/i);
  if (singleHours) return parseFloat(singleHours[1]) * 60;
  const mins = s.match(/(\d+)\s*min/i);
  if (mins) return parseInt(mins[1], 10);
  return null;
}

/** Estimated minutes for the target mountain. */
function targetMinutes(profile: TargetMountainProfile): number {
  if (profile.estimatedDays === 2) return 2 * 7 * 60; // 2 × 7-hour days
  // Gain-based estimate for single-day (Naismith's rule: 300m gain per hour, plus 5km/hr flat)
  return Math.max(90, Math.round(profile.totalElevationGain / 300 * 60));
}

// ── Score computation ─────────────────────────────────────────────────────────

interface ScoreBreakdown {
  overall: number;
  elevation: number;
  duration: number;
  altitude: number;
  consecutiveDays: number;
}

/**
 * Compute the Physical Simulation Score across 4 of the 6 planned dimensions.
 * gradient and technicalDifficulty are explicitly out of scope for Stage 2.
 *
 * Original weights: elevation 0.35, gradient 0.20, duration 0.20, altitude 0.15, consecutiveDays 0.10
 * Dropped (gradient): sum of remaining = 0.35 + 0.20 + 0.15 + 0.10 = 0.80
 * Renormalised to sum to 1.0:
 *   elevation     = 0.35 / 0.80 = 0.4375
 *   duration      = 0.20 / 0.80 = 0.2500
 *   altitude      = 0.15 / 0.80 = 0.1875
 *   consecutiveDays = 0.10 / 0.80 = 0.1250
 */
function computeScore(
  recommendedHills: Hill[],
  summitElevsASL: Array<number | null>,
  profile: TargetMountainProfile,
  hasWeekendPairing: boolean,
): ScoreBreakdown {
  // Elevation dimension: combined gain from recommended hills (with their training reps)
  const combinedGain = recommendedHills.reduce((sum, h) => sum + h.elevation * h.repeats, 0);
  const elevation = Math.min(100, Math.round((combinedGain / profile.totalElevationGain) * 100));

  // Duration dimension
  const localMins = recommendedHills.reduce((sum, h) => {
    const fromTag = parseEstimatedMinutes(h.estimatedTime ?? null);
    const perRep = fromTag ?? (h.elevation / 300 * 60); // Naismith fallback
    return sum + perRep * h.repeats;
  }, 0);
  const tgtMins = targetMinutes(profile);
  const duration = Math.min(100, Math.round((localMins / tgtMins) * 100));

  // Altitude dimension: uses summit ASL of the highest local hill recommended
  const bestASL = summitElevsASL.reduce<number>((best, e) => (e !== null && e > best ? e : best), 0);
  const altitude = profile.summitElevation > 0
    ? Math.min(100, Math.round((bestASL / profile.summitElevation) * 100))
    : 0;

  // Consecutive days dimension
  const consecutiveDays = (profile.estimatedDays === 1 || hasWeekendPairing) ? 100 : 0;

  // Renormalised weighted overall
  const overall = Math.round(
    elevation      * (0.35 / 0.80) +
    duration       * (0.20 / 0.80) +
    altitude       * (0.15 / 0.80) +
    consecutiveDays * (0.10 / 0.80),
  );

  return { overall, elevation, duration, altitude, consecutiveDays };
}

// ── Hill selection helpers ────────────────────────────────────────────────────

/** Return a copy of the hill with repeats recomputed to match targetGain. */
function hillWithReps(hill: Hill, targetGain: number): Hill {
  const reps = Math.max(1, Math.ceil(targetGain / Math.max(1, hill.elevation)));
  return { ...hill, repeats: reps, totalElevation: Math.round(hill.elevation * reps) };
}

/**
 * Pick the hill that results in the fewest reps to reach targetGain.
 * Tie-break: prefer the hill with higher per-rep gain (overshoots less and
 * gives the most natural single ascent).  This avoids picking a small hill
 * that forces many repetitions when a taller one nearby would need far fewer.
 */
function nearestMatch(hills: Hill[], targetGain: number, exclude?: string): Hill {
  return [...hills]
    .filter(h => !exclude || h.name !== exclude)
    .sort((a, b) => {
      const repsA = Math.ceil(targetGain / Math.max(1, a.elevation));
      const repsB = Math.ceil(targetGain / Math.max(1, b.elevation));
      if (repsA !== repsB) return repsA - repsB;          // fewer reps wins
      return b.elevation - a.elevation;                    // taller hill wins ties
    })[0];
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/virtual-expedition", async (req, res) => {
  const body = req.body as {
    targetMountain?: string;
    userLocation?: string;
    radius?: number;
  };

  const targetMountain = body.targetMountain?.trim() ?? "";
  const userLocation   = normalizeLocation((body.userLocation ?? "").trim());
  const radiusKm       = Math.min(100, Math.max(5, Number(body.radius) || 30));

  if (targetMountain.length < 2) {
    res.status(400).json({ error: "targetMountain is required (min 2 characters)" });
    return;
  }
  if (userLocation.length < 2) {
    res.status(400).json({ error: "userLocation is required (min 2 characters)" });
    return;
  }

  try {
    // ── Step 1: Target mountain profile ──────────────────────────────────────
    const slug = mountainSlug(targetMountain);
    let targetProfile = await getProfileFromCache(slug);

    if (!targetProfile) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 600,
        messages: [
          { role: "system", content: MOUNTAIN_SYSTEM_PROMPT },
          { role: "user",   content: `Return the climbing profile for: "${targetMountain}"` },
        ],
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        res.status(500).json({ error: "No response from AI for mountain profile" });
        return;
      }

      const raw = parseAIJson(content);
      const validated = TargetMountainProfileSchema.parse(raw);
      targetProfile = validated;
      void saveProfileToCache(slug, targetProfile);
    }

    // ── Step 2: Local hill lookup (Overpass pipeline, AI fallback if sparse) ─
    const areaCacheKey = `${userLocation.toLowerCase()}|${radiusKm}`;
    const cachedEntry = areaCache.get(areaCacheKey);
    let localHills: Hill[];
    let userLat: number;
    let userLng: number;

    if (cachedEntry && Date.now() - cachedEntry.ts < AREA_CACHE_TTL_MS) {
      localHills = cachedEntry.hills;
      userLat    = cachedEntry.userLat;
      userLng    = cachedEntry.userLng;
    } else {
      const coords = await geocodeLocation(userLocation);
      if (!coords) {
        res.status(400).json({ error: `Could not geocode location: "${userLocation}"` });
        return;
      }
      userLat = coords.lat;
      userLng = coords.lng;

      const osmPeaks = await fetchOSMPeaks(userLat, userLng, radiusKm);

      if (osmPeaks.length >= 3) {
        // Primary path: Overpass + OpenTopoData elevation pipeline
        localHills = await osmPeaksToHills(osmPeaks, userLat, userLng, radiusKm, 0);
      } else {
        // AI fallback (sparse area — very rural or Overpass timeout)
        const aiResp = await openai.chat.completions.create({
          model: "gpt-4o",
          max_completion_tokens: 1600,
          messages: [
            { role: "system", content: LOOKUP_SYSTEM_PROMPT },
            { role: "user",   content: `Location: ${userLocation}\nRadius: ${radiusKm}km\nReturn 8-10 training hills or fells within this radius.` },
          ],
        });
        const aiContent = aiResp.choices?.[0]?.message?.content;
        if (!aiContent) {
          res.status(500).json({ error: "No hill data returned from AI" });
          return;
        }
        const raw = parseAIJson(aiContent) as { hills?: unknown[] };
        const LookupSchema = z.object({ hills: z.array(HillSchema) });
        const { hills: aiHills } = LookupSchema.parse(raw);
        const corrected = validateAndCorrectHills(aiHills, userLat, userLng, radiusKm);
        localHills = await applyTerrainElevationBatch(corrected);
      }

      areaCache.set(areaCacheKey, { hills: localHills, userLat, userLng, ts: Date.now() });
    }

    if (!localHills.length) {
      res.status(404).json({
        error: `No training hills found near "${userLocation}" within ${radiusKm}km. Try increasing the radius.`,
      });
      return;
    }

    // ── Step 3: Simulation recommendation ────────────────────────────────────
    let recommendedHills: Hill[];
    let weekendPairing: { saturday: Hill; sunday: Hill } | undefined;

    if (targetProfile.estimatedDays === 1) {
      const best = nearestMatch(localHills, targetProfile.totalElevationGain);
      recommendedHills = [hillWithReps(best, targetProfile.totalElevationGain)];
    } else {
      const day1Target = targetProfile.day1ElevationGain ?? Math.round(targetProfile.totalElevationGain * 0.55);
      const day2Target = targetProfile.day2ElevationGain ?? (targetProfile.totalElevationGain - day1Target);

      const hillA = nearestMatch(localHills, day1Target);
      const hillB = nearestMatch(localHills, day2Target, hillA?.name);

      if (hillA && hillB) {
        const saturday = hillWithReps(hillA, day1Target);
        const sunday   = hillWithReps(hillB, day2Target);
        weekendPairing   = { saturday, sunday };
        recommendedHills = [saturday, sunday];
      } else {
        // No viable two-hill combination — fall back to best single hill
        const best = nearestMatch(localHills, targetProfile.totalElevationGain);
        recommendedHills = [hillWithReps(best, targetProfile.totalElevationGain)];
      }
    }

    // ── Summit elevations ASL for altitude dimension ──────────────────────────
    // Prefer summitElevationASL threaded from osmPeaksToHills — it uses the real
    // OSM ele tag (surveyor-tagged) at the correct OSM peak position, so it is
    // immune to AI-hallucinated lat/lng.  Only fall back to a fresh topo query
    // for hills that came via the AI fallback path and have no summitElevationASL.
    const missingASL = recommendedHills.filter(h => !h.summitElevationASL && h.lat && h.lng);
    const topoPoints = missingASL.map(h => ({ lat: h.lat!, lng: h.lng! }));
    const topoResults = topoPoints.length > 0 ? await fetchTopoElevations(topoPoints) : [];

    const summitElevsASL: Array<number | null> = recommendedHills.map(h => {
      if (h.summitElevationASL) return h.summitElevationASL;
      if (!h.lat || !h.lng) return null;
      const idx = missingASL.findIndex(m => m.name === h.name);
      return idx >= 0 ? (topoResults[idx] ?? null) : null;
    });

    // ── Step 4: Physical Simulation Score ─────────────────────────────────────
    const scoreBreakdown = computeScore(
      recommendedHills,
      summitElevsASL,
      targetProfile,
      !!weekendPairing || targetProfile.estimatedDays === 1,
    );

    res.json({
      targetProfile,
      recommendedHills,
      ...(weekendPairing ? { weekendPairing } : {}),
      simulationScore: scoreBreakdown.overall,
      scoreBreakdown,
    });
  } catch (err) {
    const log = (req as { log?: { error: (obj: object, msg: string) => void } }).log;
    log?.error?.({ err }, "virtual-expedition failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Virtual expedition failed: ${msg}` });
  }
});

export default router;
