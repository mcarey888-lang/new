/**
 * POST /api/virtual-expedition
 *
 * Mountain Guide Edition — replaced the elevation-calculator Step 3 with an
 * AI expedition builder that selects routes by Route DNA character match.
 *
 * Input:  { targetMountain, userLocation, radius? }
 * Output: { targetProfile, expedition, recommendedHills, adventureScore,
 *            dnaMatchScore, simulationScore, scoreBreakdown }
 *
 * Step 1 — Mountain profile + Route DNA (GPT-4o, DB-cached 7-day TTL).
 * Step 2 — Local hill discovery (Overpass + terrain pipeline, AI fallback).
 * Step 3 — Expedition builder: GPT designs a mini adventure by DNA match.
 * Step 4 — Scores: Adventure + DNA Match + Physical Simulation (compat).
 *
 * Training Mode is NOT affected by any of these changes.
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

// ── Route DNA schema ───────────────────────────────────────────────────────────
//
//  Each dimension 0–10 where 0 = none / very easy and 10 = extreme.
//  Altitude, glaciers and snow are deliberately EXCLUDED — they are noted as
//  "informational gaps" in the profile and must not penalise UK route scores.

const RouteDnaSchema = z.object({
  scrambling:         z.number().min(0).max(10),
  exposure:           z.number().min(0).max(10),
  ridgeTravel:        z.number().min(0).max(10),
  endurance:          z.number().min(0).max(10),
  technicalMovement:  z.number().min(0).max(10),
  navigationRequired: z.number().min(0).max(10),
  steepness:          z.number().min(0).max(10),
  scenicQuality:      z.number().min(0).max(10),
  descentDifficulty:  z.number().min(0).max(10),
  sustainedClimbing:  z.number().min(0).max(10),
});

export type RouteDna = z.infer<typeof RouteDnaSchema>;

// ── Target mountain profile schema ────────────────────────────────────────────

const TargetMountainProfileSchema = z.object({
  name:               z.string(),
  country:            z.string(),
  summitElevation:    z.number().positive(),
  totalElevationGain: z.number().positive(),
  totalDistance:      z.number().positive(),
  estimatedDays:      z.number().int().positive().transform(d => (d >= 2 ? 2 : 1) as 1 | 2),
  day1ElevationGain:  z.number().positive().optional().nullable(),
  day2ElevationGain:  z.number().positive().optional().nullable(),
  maxDailyElevation:  z.number().positive(),
  difficulty:         z.enum(["Easy", "Moderate", "Hard", "Alpine"]),
  technicalGrade:     z.string().optional().nullable(),
  altitudeExposure:   z.enum(["None", "Moderate", "High", "Extreme"]),
  notes:              z.string(),
  routeDna:           RouteDnaSchema,
});

type TargetMountainProfile = z.infer<typeof TargetMountainProfileSchema>;

// ── DB cache helpers ──────────────────────────────────────────────────────────

const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_SLUG_PREFIX  = "virt-mt-v2-"; // new prefix — v1 profiles lack routeDna

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
  } catch { return null; }
}

async function saveProfileToCache(slug: string, profile: TargetMountainProfile): Promise<void> {
  try {
    const data = JSON.stringify(profile);
    await db
      .insert(cachedMountains)
      .values({ slug, data })
      .onConflictDoUpdate({ target: cachedMountains.slug, set: { data, cachedAt: new Date() } });
  } catch { /* non-fatal */ }
}

// ── In-memory area cache ──────────────────────────────────────────────────────

const areaCache = new Map<string, { hills: Hill[]; userLat: number; userLng: number; ts: number }>();
const AREA_CACHE_TTL_MS = 30 * 60 * 1000;

// ── Step 1 prompt — mountain profile + Route DNA ──────────────────────────────

const MOUNTAIN_SYSTEM_PROMPT = `You are an expert mountaineering guide with encyclopaedic knowledge of summits worldwide. Given a mountain name, return accurate data about climbing it via the standard route. Return ONLY valid JSON with no markdown or explanation.

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
  "notes": string,
  "routeDna": {
    "scrambling": 0-10,
    "exposure": 0-10,
    "ridgeTravel": 0-10,
    "endurance": 0-10,
    "technicalMovement": 0-10,
    "navigationRequired": 0-10,
    "steepness": 0-10,
    "scenicQuality": 0-10,
    "descentDifficulty": 0-10,
    "sustainedClimbing": 0-10
  }
}

Route DNA dimension definitions:
- scrambling: 0=walk on trail, 10=near-technical rock climbing using hands
- exposure: 0=sheltered valley walk, 10=serious airy ridge with long drops either side
- ridgeTravel: 0=no ridge at all, 10=sustained knife-edge ridge traverse
- endurance: 0=short outing under 4h, 10=multi-day slog demanding exceptional fitness
- technicalMovement: 0=walking only, 10=technical climbing requiring specific skills
- navigationRequired: 0=clear marked path, 10=complex route-finding in featureless terrain
- steepness: 0=gentle gradients, 10=near-vertical sections requiring hands
- scenicQuality: 0=mundane, 10=world-class panoramic or iconic views
- descentDifficulty: 0=easy path descent, 10=technically demanding descent requiring care
- sustainedClimbing: 0=undulating / lots of flat, 10=relentless upward grind with no respite

Note: altitude, glaciers and snow are informational context only — do NOT let them inflate routeDna scores. A high-altitude walk with no scrambling should score 0 on scrambling.

Field definitions:
- summitElevation: metres ASL at summit
- totalElevationGain: total vertical metres gained (entire round trip)
- totalDistance: km for the full round trip or traverse
- estimatedDays: 1 for peaks done in a single day; 2 for multi-day or hut-based ascents
- maxDailyElevation: highest gain on any single day
- difficulty: Easy <600m; Moderate 600–1000m rough; Hard 1000–1500m or sustained; Alpine >1500m / glaciated / high altitude
- notes: 1–2 sentences on what distinguishes this mountain's character

Use real, researched figures for all well-known mountains.`;

// ── Step 3 prompt — expedition builder ────────────────────────────────────────

const EXPEDITION_BUILDER_PROMPT = `You are an elite mountain guide with 20 years of experience designing unforgettable UK mountain adventures.

A hiker wants to experience the CHARACTER of a target mountain using local hills near where they live.

Your goal is NOT to prescribe a workout that totals the right elevation.
Your goal IS to design a genuine adventure — a mini expedition — that captures the FEEL and CHARACTER of the target.

You always think: "If I wanted this person to genuinely experience what this mountain feels like, which hills would I take them to?"

Core rules:
1. Select routes ONLY from the provided available hills list (match names exactly)
2. NEVER recommend the same route twice — variety is essential
3. Strongly prefer circular routes, ridgelines, and iconic local routes over repeated out-and-backs
4. Choose by character match — if the target demands scrambling, pick scrambling routes; if it demands endurance, pick long sustained routes
5. Maximum 3 routes per day, minimum 1
6. For 2-day trips: Saturday = the main character-defining day, Sunday = complementary day with different focus
7. Each day should feel like a COMPLETE ADVENTURE, not a training exercise
8. Suggest 2-3 alternatives for each selected primary route (must be from the available hills list, with similar DNA)
9. Adventures score higher with: variety, ridge walking, scrambling, iconic status, scenery, and interesting terrain combinations

Altitude, glaciers, and snow are NOT expected in UK hills — do not reduce scores for their absence.

The user should read the plan and think: "That actually looks like an amazing weekend" — not "that's a lot of repetitions."

Return ONLY valid JSON with no markdown:
{
  "title": "short evocative expedition title",
  "concept": "1-2 sentences describing the adventure character",
  "days": [
    {
      "label": "Saturday" | "Sunday" | "Day 1" | "Day 2" | "Single Day",
      "title": "day title",
      "focus": "e.g. 'ridge scrambling + exposure' or 'long sustained endurance'",
      "routes": [
        { "name": "exact hill name from available list", "why": "1 sentence — why this route captures the target's character" }
      ]
    }
  ],
  "alternatives": {
    "exact primary hill name": ["alt1 name from available hills", "alt2 name from available hills"]
  },
  "adventureScore": 0-100,
  "dnaMatchScore": 0-100,
  "dnaMatchNotes": "1-2 sentences explaining how this expedition resembles the target mountain"
}`;

// ── Mini expedition schema ────────────────────────────────────────────────────

const ExpeditionDayRouteSchema = z.object({
  name: z.string(),
  why:  z.string(),
});

const ExpeditionDaySchema = z.object({
  label:  z.string(),
  title:  z.string(),
  focus:  z.string(),
  routes: z.array(ExpeditionDayRouteSchema).min(1).max(3),
});

const MiniExpeditionSchema = z.object({
  title:         z.string(),
  concept:       z.string(),
  days:          z.array(ExpeditionDaySchema).min(1).max(3),
  alternatives:  z.record(z.array(z.string())),
  adventureScore: z.number().min(0).max(100),
  dnaMatchScore:  z.number().min(0).max(100),
  dnaMatchNotes:  z.string(),
});

type MiniExpedition = z.infer<typeof MiniExpeditionSchema>;

// ── Duration helpers ──────────────────────────────────────────────────────────

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

function targetMinutes(profile: TargetMountainProfile): number {
  if (profile.estimatedDays === 2) return 2 * 7 * 60;
  return Math.max(90, Math.round(profile.totalElevationGain / 300 * 60));
}

// ── Physical Simulation Score (kept for backward compatibility) ────────────────

interface ScoreBreakdown {
  overall:        number;
  elevation:      number;
  duration:       number;
  altitude:       number;
  consecutiveDays: number;
  adventureScore?: number;
  dnaMatchScore?:  number;
}

function computePhysicalScore(
  recommendedHills: Hill[],
  summitElevsASL:   Array<number | null>,
  profile:          TargetMountainProfile,
  hasWeekendPairing: boolean,
): ScoreBreakdown {
  const combinedGain = recommendedHills.reduce((sum, h) => sum + h.elevation * h.repeats, 0);
  const elevation    = Math.min(100, Math.round((combinedGain / profile.totalElevationGain) * 100));

  const localMins = recommendedHills.reduce((sum, h) => {
    const fromTag = parseEstimatedMinutes(h.estimatedTime ?? null);
    const perRep  = fromTag ?? (h.elevation / 300 * 60);
    return sum + perRep * h.repeats;
  }, 0);
  const tgtMins  = targetMinutes(profile);
  const duration = Math.min(100, Math.round((localMins / tgtMins) * 100));

  const bestASL = summitElevsASL.reduce<number>((best, e) => (e !== null && e > best ? e : best), 0);
  const altitude = profile.summitElevation > 0
    ? Math.min(100, Math.round((bestASL / profile.summitElevation) * 100))
    : 0;

  const consecutiveDays = (profile.estimatedDays === 1 || hasWeekendPairing) ? 100 : 0;

  const overall = Math.round(
    elevation       * (0.35 / 0.80) +
    duration        * (0.20 / 0.80) +
    altitude        * (0.15 / 0.80) +
    consecutiveDays * (0.10 / 0.80),
  );

  return { overall, elevation, duration, altitude, consecutiveDays };
}

// ── Expedition builder helpers ────────────────────────────────────────────────

/**
 * Fuzzy-match a name returned by GPT against the available hills list.
 * Returns the best matching Hill, or null if nothing is close enough.
 */
function fuzzyMatchHill(name: string, hills: Hill[]): Hill | null {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const target    = normalise(name);

  // Exact match first
  const exact = hills.find(h => normalise(h.name) === target);
  if (exact) return exact;

  // Starts-with or contains
  const partial = hills.find(h => {
    const hn = normalise(h.name);
    return hn.startsWith(target) || target.startsWith(hn) || hn.includes(target) || target.includes(hn);
  });
  return partial ?? null;
}

/** Format the Route DNA for the prompt. */
function formatDna(dna: RouteDna): string {
  return [
    `  scrambling:          ${dna.scrambling}/10`,
    `  exposure:            ${dna.exposure}/10`,
    `  ridge travel:        ${dna.ridgeTravel}/10`,
    `  endurance:           ${dna.endurance}/10`,
    `  technical movement:  ${dna.technicalMovement}/10`,
    `  navigation required: ${dna.navigationRequired}/10`,
    `  steepness:           ${dna.steepness}/10`,
    `  scenic quality:      ${dna.scenicQuality}/10`,
    `  descent difficulty:  ${dna.descentDifficulty}/10`,
    `  sustained climbing:  ${dna.sustainedClimbing}/10`,
  ].join("\n");
}

/** Build a compact hill list for the prompt (cap at 25 to avoid token overflow). */
function formatHillsForPrompt(hills: Hill[]): string {
  return hills
    .slice(0, 25)
    .map(h => [
      h.name,
      `${h.elevation}m gain`,
      h.grade,
      h.surface,
      h.routeType ?? "hill",
      h.routeDistance ? `${h.routeDistance}km` : `${h.distance}km`,
    ].join(" | "))
    .join("\n");
}

/**
 * Call GPT to design a mini expedition based on DNA character match.
 * Returns null on failure — caller falls back to the legacy calculator.
 */
async function buildMiniExpedition(
  hills:                Hill[],
  profile:              TargetMountainProfile,
  difficultyPreference: string | null = null,
): Promise<MiniExpedition | null> {
  const userMsg = [
    `Target mountain: ${profile.name} (${profile.country})`,
    `Difficulty: ${profile.difficulty} | Altitude exposure: ${profile.altitudeExposure}`,
    `Estimated days on mountain: ${profile.estimatedDays}`,
    `Character notes: ${profile.notes}`,
    difficultyPreference ? `User's preferred difficulty: ${difficultyPreference} — weight route selection toward this level.` : "",
    ``,
    `Route DNA — what makes this mountain special:`,
    formatDna(profile.routeDna),
    ``,
    `Available local hills (choose from these only, match names exactly):`,
    formatHillsForPrompt(hills),
    ``,
    `Design a ${profile.estimatedDays === 1 ? "single-day" : "1–2 day"} mini expedition.`,
    `Remember: variety over repetition. The user should want to do this adventure, not just complete the elevation.`,
  ].filter(Boolean).join("\n");

  const completion = await openai.chat.completions.create({
    model:                 "gpt-4o",
    max_completion_tokens: 1400,
    messages: [
      { role: "system", content: EXPEDITION_BUILDER_PROMPT },
      { role: "user",   content: userMsg },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const raw      = parseAIJson(content);
    const validated = MiniExpeditionSchema.parse(raw);
    return validated;
  } catch {
    return null;
  }
}

/**
 * Resolve the expedition plan into a flat list of Hills for backward compat.
 * Each selected hill appears once (repeats=1). Hills that GPT named but
 * can't be fuzzy-matched are silently dropped; remaining hills are appended
 * to fill out the list if the expedition selected fewer than 2.
 */
function resolveExpeditionHills(
  expedition: MiniExpedition,
  allHills:   Hill[],
): Hill[] {
  const selected: Hill[] = [];
  const usedNames = new Set<string>();

  for (const day of expedition.days) {
    for (const route of day.routes) {
      const hill = fuzzyMatchHill(route.name, allHills);
      if (hill && !usedNames.has(hill.name)) {
        selected.push({ ...hill, repeats: 1, totalElevation: hill.elevation });
        usedNames.add(hill.name);
      }
    }
  }

  // Pad to at least 2 hills using unused local hills (by elevation desc)
  if (selected.length < 2) {
    const remaining = allHills
      .filter(h => !usedNames.has(h.name))
      .sort((a, b) => b.elevation - a.elevation);
    for (const h of remaining) {
      if (selected.length >= 4) break;
      selected.push({ ...h, repeats: 1, totalElevation: h.elevation });
      usedNames.add(h.name);
    }
  }

  return selected;
}

/**
 * Post-selection elevation bridge.
 *
 * The AI picks routes by character (feel) not arithmetic. The combined
 * elevation of 3–5 routes at ×1 is often well below the mountain's total
 * gain requirement — e.g. Lake District hills (~2,300m) vs Everest (3,640m)
 * — leaving users with a misleading local match score.
 *
 * This step closes the gap by assigning reps proportionally:
 *  - If total gain ≥ 90 % of target: leave as-is — already close enough.
 *  - Otherwise: assign reps so the combined total reaches ~100 % of the
 *    mountain's elevation gain, capped at 6 reps per hill.  Bigger hills
 *    earn proportionally more reps (higher gain per round).
 */
function distributeRepsForElevation(hills: Hill[], targetGain: number): Hill[] {
  if (!hills.length || targetGain <= 0) return hills;

  const totalAtOne = hills.reduce((s, h) => s + h.elevation, 0);

  // Already ≥ 90 % of target — close enough, leave reps as-is.
  if (totalAtOne >= targetGain * 0.90) return hills;

  // Aim for 100 % of target (capped so we never exceed 6× the ×1 total).
  const aimGain = Math.min(targetGain, totalAtOne * 6);
  const avgElev = totalAtOne / hills.length;

  return hills.map(h => {
    // Proportional allocation: hills with higher gain shoulder more reps.
    const share  = avgElev > 0 ? h.elevation / avgElev : 1;
    const rawRep = (aimGain / totalAtOne) * share;
    const reps   = Math.min(6, Math.max(1, Math.round(rawRep)));
    return { ...h, repeats: reps, totalElevation: Math.round(h.elevation * reps) };
  });
}

/**
 * Resolve alternative hill names to actual Hill objects.
 * Keeps only alternatives that fuzzy-match an available hill and
 * aren't already selected as primary routes.
 */
function resolveAlternatives(
  rawAlternatives: Record<string, string[]>,
  primaryNames:    Set<string>,
  allHills:        Hill[],
): Record<string, string[]> {
  const resolved: Record<string, string[]> = {};
  for (const [primaryName, altNames] of Object.entries(rawAlternatives)) {
    const alts = altNames
      .map(n => fuzzyMatchHill(n, allHills))
      .filter((h): h is Hill => h !== null && !primaryNames.has(h.name))
      .map(h => h.name)
      .slice(0, 3);
    if (alts.length > 0) resolved[primaryName] = alts;
  }
  return resolved;
}

// ── Legacy calculator fallback ────────────────────────────────────────────────
//  Used only when the AI expedition builder fails. Kept for reliability.

function hillWithReps(hill: Hill, targetGain: number): Hill {
  const reps = Math.max(1, Math.ceil(targetGain / Math.max(1, hill.elevation)));
  return { ...hill, repeats: reps, totalElevation: Math.round(hill.elevation * reps) };
}

function nearestMatch(hills: Hill[], targetGain: number, exclude?: string): Hill {
  return [...hills]
    .filter(h => !exclude || h.name !== exclude)
    .sort((a, b) => {
      const repsA = Math.ceil(targetGain / Math.max(1, a.elevation));
      const repsB = Math.ceil(targetGain / Math.max(1, b.elevation));
      if (repsA !== repsB) return repsA - repsB;
      return b.elevation - a.elevation;
    })[0];
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/virtual-expedition", async (req, res) => {
  const body = req.body as {
    targetMountain?: string;
    userLocation?:   string;
    radius?:         number;
    /** Override the mountain's natural day count (1 = single day, 2 = weekend). */
    daysOverride?:   1 | 2;
    /** Preferred difficulty filter hint passed to the expedition builder ("Easy"|"Moderate"|"Hard"). */
    difficultyPreference?: string;
  };

  const targetMountain     = body.targetMountain?.trim() ?? "";
  const userLocation       = normalizeLocation((body.userLocation ?? "").trim());
  const radiusKm           = Math.min(100, Math.max(5, Number(body.radius) || 30));
  const daysOverride       = body.daysOverride === 1 || body.daysOverride === 2 ? body.daysOverride : null;
  const difficultyPreference = typeof body.difficultyPreference === "string" ? body.difficultyPreference : null;

  if (targetMountain.length < 2) {
    res.status(400).json({ error: "targetMountain is required (min 2 characters)" });
    return;
  }
  if (userLocation.length < 2) {
    res.status(400).json({ error: "userLocation is required (min 2 characters)" });
    return;
  }

  try {
    // ── Step 1: Mountain profile + Route DNA ──────────────────────────────────
    const slug = mountainSlug(targetMountain);
    let targetProfile = await getProfileFromCache(slug);

    if (!targetProfile) {
      const completion = await openai.chat.completions.create({
        model:                 "gpt-4o",
        max_completion_tokens: 900,
        messages: [
          { role: "system", content: MOUNTAIN_SYSTEM_PROMPT },
          { role: "user",   content: `Return the full climbing profile including Route DNA for: "${targetMountain}"` },
        ],
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        res.status(500).json({ error: "No response from AI for mountain profile" });
        return;
      }

      const raw       = parseAIJson(content);
      const validated = TargetMountainProfileSchema.parse(raw);
      targetProfile   = validated;
      void saveProfileToCache(slug, targetProfile);
    }

    // ── Step 2: Local hill discovery (Overpass or AI fallback) ────────────────
    const areaCacheKey = `${userLocation.toLowerCase()}|${radiusKm}`;
    const cachedEntry  = areaCache.get(areaCacheKey);
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
        localHills = await osmPeaksToHills(osmPeaks, userLat, userLng, radiusKm, 0);
      } else {
        const aiResp = await openai.chat.completions.create({
          model:                 "gpt-4o",
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
        const raw           = parseAIJson(aiContent) as { hills?: unknown[] };
        const LookupSchema  = z.object({ hills: z.array(HillSchema) });
        const { hills: aiHills } = LookupSchema.parse(raw);
        const corrected     = validateAndCorrectHills(aiHills, userLat, userLng, radiusKm);
        localHills          = await applyTerrainElevationBatch(corrected);
      }

      areaCache.set(areaCacheKey, { hills: localHills, userLat, userLng, ts: Date.now() });
    }

    if (!localHills.length) {
      res.status(404).json({
        error: `No training hills found near "${userLocation}" within ${radiusKm}km. Try increasing the radius.`,
      });
      return;
    }

    // ── Step 3: Expedition builder (AI mountain guide) ────────────────────────
    //
    //  Apply any user overrides to the profile before building.
    //  daysOverride lets users force 1-day or 2-day structure regardless of
    //  the mountain's natural schedule.

    const effectiveProfile: TargetMountainProfile = daysOverride
      ? { ...targetProfile, estimatedDays: daysOverride }
      : targetProfile;

    let recommendedHills: Hill[];
    let expedition: MiniExpedition | null = null;
    let weekendPairing: { saturday: Hill; sunday: Hill } | undefined;
    let usingAiExpedition = false;

    try {
      expedition = await buildMiniExpedition(localHills, effectiveProfile, difficultyPreference);
    } catch { /* fall through to calculator */ }

    if (expedition) {
      const rawHills   = resolveExpeditionHills(expedition, localHills);
      recommendedHills = distributeRepsForElevation(rawHills, effectiveProfile.totalElevationGain);
      usingAiExpedition = true;

      // Synthesise weekendPairing for score compat (2+ hills → treat as weekend pairing)
      if (recommendedHills.length >= 2 && effectiveProfile.estimatedDays === 2) {
        weekendPairing = {
          saturday: recommendedHills[0],
          sunday:   recommendedHills[1],
        };
      }
    } else {
      // Legacy fallback — uses effectiveProfile so daysOverride is respected
      if (effectiveProfile.estimatedDays === 1) {
        const best = nearestMatch(localHills, effectiveProfile.totalElevationGain);
        recommendedHills = [hillWithReps(best, effectiveProfile.totalElevationGain)];
      } else {
        const day1Target = effectiveProfile.day1ElevationGain ?? Math.round(effectiveProfile.totalElevationGain * 0.55);
        const day2Target = effectiveProfile.day2ElevationGain ?? (effectiveProfile.totalElevationGain - day1Target);
        const hillA      = nearestMatch(localHills, day1Target);
        const hillB      = nearestMatch(localHills, day2Target, hillA?.name);
        if (hillA && hillB) {
          const saturday = hillWithReps(hillA, day1Target);
          const sunday   = hillWithReps(hillB, day2Target);
          weekendPairing   = { saturday, sunday };
          recommendedHills = [saturday, sunday];
        } else {
          const best = nearestMatch(localHills, effectiveProfile.totalElevationGain);
          recommendedHills = [hillWithReps(best, effectiveProfile.totalElevationGain)];
        }
      }
    }

    // ── Summit elevations ASL for altitude dimension ──────────────────────────
    const missingASL   = recommendedHills.filter(h => !h.summitElevationASL && h.lat && h.lng);
    const topoPoints   = missingASL.map(h => ({ lat: h.lat!, lng: h.lng! }));
    const topoResults  = topoPoints.length > 0 ? await fetchTopoElevations(topoPoints) : [];

    const summitElevsASL: Array<number | null> = recommendedHills.map(h => {
      if (h.summitElevationASL) return h.summitElevationASL;
      if (!h.lat || !h.lng) return null;
      const idx = missingASL.findIndex(m => m.name === h.name);
      return idx >= 0 ? (topoResults[idx] ?? null) : null;
    });

    // ── Step 4: Scores ────────────────────────────────────────────────────────
    const physicalScore = computePhysicalScore(
      recommendedHills,
      summitElevsASL,
      effectiveProfile,
      !!weekendPairing || effectiveProfile.estimatedDays === 1,
    );

    const adventureScore = expedition?.adventureScore ?? 0;
    const dnaMatchScore  = expedition?.dnaMatchScore  ?? physicalScore.overall;
    const simulationScore = dnaMatchScore;

    // Resolve alternatives (only if AI expedition succeeded)
    const primaryNames  = new Set(recommendedHills.map(h => h.name));
    const alternatives  = expedition
      ? resolveAlternatives(expedition.alternatives, primaryNames, localHills)
      : {};

    // Build a clean expedition object for the response
    const expeditionPlan = expedition
      ? {
          title:         expedition.title,
          concept:       expedition.concept,
          days:          expedition.days,
          alternatives,
          adventureScore,
          dnaMatchScore,
          dnaMatchNotes: expedition.dnaMatchNotes,
        }
      : null;

    res.json({
      // Return effectiveProfile so the UI reflects any daysOverride applied
      targetProfile:   effectiveProfile,
      expedition:      expeditionPlan,
      recommendedHills,
      ...(weekendPairing ? { weekendPairing } : {}),
      alternatives,
      adventureScore,
      dnaMatchScore,
      simulationScore,
      scoreBreakdown: {
        ...physicalScore,
        adventureScore,
        dnaMatchScore,
      },
      _meta: { usingAiExpedition, daysOverrideApplied: !!daysOverride },
    });

  } catch (err) {
    const log = (req as { log?: { error: (obj: object, msg: string) => void } }).log;
    log?.error?.({ err }, "virtual-expedition failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Virtual expedition failed: ${msg}` });
  }
});

export default router;
