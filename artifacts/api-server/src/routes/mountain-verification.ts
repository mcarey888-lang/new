import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { mountainVerificationTests } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router: IRouter = Router();

// ── Geo helpers ────────────────────────────────────────────────────────────

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcTotalDistanceM(coords: [number, number][]): number {
  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    dist += haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return dist;
}

function interpolatePoints(coords: [number, number][], stepM: number): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lat1, lon1] = coords[i];
    const [lat2, lon2] = coords[i + 1];
    const dist = haversineM(lat1, lon1, lat2, lon2);
    const steps = Math.max(1, Math.round(dist / stepM));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      result.push([lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]);
    }
  }
  if (coords.length > 0) result.push(coords[coords.length - 1]);
  return result;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Phase 5: Elevation via OpenTopoData ────────────────────────────────────

async function getElevations(points: [number, number][]): Promise<number[]> {
  const elevations: number[] = new Array(points.length).fill(0);
  const BATCH = 100;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const locations = batch.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
    try {
      const res = await fetch(
        `https://api.opentopodata.org/v1/srtm90m?locations=${locations}`,
        { headers: { "User-Agent": "SummitReady/1.0 (+mountain-verification)" } },
      );
      if (res.ok) {
        const data = (await res.json()) as { results: { elevation: number | null }[] };
        data.results.forEach((r, j) => { elevations[i + j] = r.elevation ?? 0; });
      }
    } catch { /* elevation stays 0 */ }
    if (i + BATCH < points.length) await sleep(1150);
  }
  return elevations;
}

// ── Phase 6: True elevation gain (Garmin/Strava style) ─────────────────────

function calcTrueElevationGain(elevations: number[], minStep = 3): number {
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > minStep) gain += diff;
  }
  return Math.round(gain);
}

function calcMaxGradientPct(elevations: number[], stepM: number): number {
  let maxG = 0;
  for (let i = 1; i < elevations.length; i++) {
    const rise = Math.abs(elevations[i] - elevations[i - 1]);
    const g = (rise / stepM) * 100;
    if (g > maxG) maxG = g;
  }
  return Math.round(maxG * 10) / 10;
}

// ── Phase 8: Confidence score ──────────────────────────────────────────────

function confidenceScore(coordCount: number, validElevations: number, totalPoints: number): string {
  if (coordCount > 10 && totalPoints > 0 && validElevations / totalPoints > 0.8) return "HIGH";
  if (coordCount > 5 && validElevations > 5) return "MEDIUM";
  return "LOW";
}

// ── Phase 2: Nominatim geocoding ───────────────────────────────────────────

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  extratags?: { ele?: string };
}

async function geocodeMountain(name: string): Promise<{ name: string; lat: number; lon: number; elevation: number | null } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=10&addressdetails=0&extratags=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SummitReady/1.0 (+mountain-verification)" },
  });
  if (!res.ok) return null;
  const results = (await res.json()) as NominatimResult[];
  if (!results.length) return null;
  const peak = results.find((r) => r.class === "natural" && r.type === "peak") ?? results[0];
  return {
    name: peak.display_name.split(",")[0].trim(),
    lat: parseFloat(peak.lat),
    lon: parseFloat(peak.lon),
    elevation: peak.extratags?.ele ? parseFloat(peak.extratags.ele) : null,
  };
}

// ── Phase 3+4: Overpass API route search ──────────────────────────────────

interface OverpassWayMember {
  type: "way";
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassElement {
  type: "relation" | "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: OverpassWayMember[];
}

interface OverpassResult {
  elements: OverpassElement[];
}

async function overpassQuery(query: string): Promise<OverpassElement[]> {
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OverpassResult;
    return data.elements ?? [];
  } catch { return []; }
}

async function findHikingRoutes(lat: number, lon: number): Promise<OverpassElement[]> {
  const query = `
[out:json][timeout:45];
(
  relation["route"="hiking"](around:12000,${lat},${lon});
  relation["route"="foot"](around:12000,${lat},${lon});
);
out geom qt 15;`.trim();
  return overpassQuery(query);
}

async function findFootpaths(lat: number, lon: number): Promise<OverpassElement[]> {
  const query = `
[out:json][timeout:30];
(
  way["highway"~"path|footway"]["foot"!="no"]["name"](around:5000,${lat},${lon});
  way["highway"="track"]["foot"!="no"]["name"](around:5000,${lat},${lon});
);
out geom qt 10;`.trim();
  return overpassQuery(query);
}

function extractCoords(element: OverpassElement): [number, number][] {
  const coords: [number, number][] = [];
  if (element.type === "relation" && element.members) {
    for (const m of element.members) {
      if (m.type === "way" && m.geometry) {
        for (const pt of m.geometry) coords.push([pt.lat, pt.lon]);
      }
    }
  } else if (element.type === "way" && element.geometry) {
    for (const pt of element.geometry) coords.push([pt.lat, pt.lon]);
  }
  return coords;
}

function elementName(el: OverpassElement): string {
  const t = el.tags ?? {};
  return t.name ?? t.ref ?? t["name:en"] ?? `${el.type[0].toUpperCase()}${el.type.slice(1)} #${el.id}`;
}

// ── Core pipeline ──────────────────────────────────────────────────────────

const SAMPLE_STEP_M = 50;

async function processMountain(mountainName: string, logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void }) {
  // Phase 2
  const geo = await geocodeMountain(mountainName);
  if (!geo) throw new Error(`Could not geocode "${mountainName}"`);
  logger.info({ geo }, "Geocoded");

  // Summit elevation
  let summitElevation = geo.elevation;
  if (!summitElevation) {
    const elevRes = await getElevations([[geo.lat, geo.lon]]);
    summitElevation = elevRes[0] > 0 ? elevRes[0] : null;
    await sleep(1150);
  }

  // Phase 3+4
  logger.info("Querying OSM routes");
  const [relations, paths] = await Promise.all([
    findHikingRoutes(geo.lat, geo.lon),
    findFootpaths(geo.lat, geo.lon),
  ]);

  // Deduplicate by id, prefer named hiking relations
  const seen = new Set<number>();
  const candidates: OverpassElement[] = [];

  for (const el of [...relations, ...paths]) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    const coords = extractCoords(el);
    if (coords.length < 5) continue;
    candidates.push(el);
    if (candidates.length >= 5) break;
  }

  logger.info({ count: candidates.length }, "Candidate routes found");

  const routes = [];

  for (const candidate of candidates) {
    const rawCoords = extractCoords(candidate);
    if (rawCoords.length < 2) continue;

    // Phase 5 — sample elevation profile
    const sampled = interpolatePoints(rawCoords, SAMPLE_STEP_M);
    const elevations = await getElevations(sampled);
    await sleep(200);

    const validCount = elevations.filter((e) => e > 0).length;

    // Phase 6 — true elevation gain
    const totalElevationGain = calcTrueElevationGain(elevations);

    // Phase 7 — route metrics
    const oneWayDistM = calcTotalDistanceM(rawCoords);
    const distanceKm = Math.round((oneWayDistM * 2) / 100) / 10; // round trip
    const trailheadElevation = validCount > 0
      ? Math.round(Math.min(...elevations.slice(0, Math.min(10, elevations.length)).filter((e) => e > 0)))
      : null;
    const highestPoint = validCount > 0
      ? Math.round(Math.max(...elevations.filter((e) => e > 0)))
      : summitElevation;
    const averageGradient = oneWayDistM > 0 && totalElevationGain > 0
      ? Math.round((totalElevationGain / oneWayDistM) * 1000) / 10
      : null;
    const maxGradient = calcMaxGradientPct(elevations, SAMPLE_STEP_M);
    const conf = confidenceScore(rawCoords.length, validCount, sampled.length);
    const name = elementName(candidate);
    const source = candidate.type === "relation" ? "OSM hiking relation" : "OSM named footpath";

    // Phase 9 — store in DB
    try {
      await db.insert(mountainVerificationTests).values({
        mountainName: geo.name,
        routeName: name,
        distanceKm,
        elevationGainM: totalElevationGain,
        summitElevationM: highestPoint ?? summitElevation,
        trailheadElevationM: trailheadElevation,
        averageGradient,
        maxGradient: maxGradient > 0 ? maxGradient : null,
        confidenceScore: conf,
        source,
        rawRouteGeometry: JSON.stringify(rawCoords.slice(0, 300)),
      });
    } catch (err) { logger.warn({ err }, "DB store failed"); }

    routes.push({
      routeName: name,
      distanceKm,
      totalElevationGain,
      summitElevation: highestPoint ?? summitElevation,
      trailheadElevation,
      averageGradient,
      maxGradient: maxGradient > 0 ? maxGradient : null,
      confidenceScore: conf,
      source,
      pointCount: sampled.length,
      elevationProfileSampled: elevations.filter((_, i) => i % 4 === 0),
    });
  }

  return {
    mountainName: geo.name,
    lat: geo.lat,
    lon: geo.lon,
    summitElevation,
    routes,
  };
}

// ── POST /api/mountain-verification-test ──────────────────────────────────

const RequestSchema = z.object({ mountainName: z.string().min(2).max(200) });

router.post("/mountain-verification-test", requireAdminAuth(), async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "mountainName required (2–200 chars)" });
    return;
  }
  const { mountainName } = parsed.data;
  req.log.info({ mountainName }, "Verification test started");

  try {
    const result = await processMountain(mountainName, req.log);
    writeAuditLog(res.locals.adminIdentity, "mountain-verification-test", mountainName, {
      routeCount: Array.isArray((result as Record<string, unknown>)?.routes)
        ? ((result as Record<string, unknown>).routes as unknown[]).length
        : undefined,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Verification test failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/mountain-verification-results ────────────────────────────────

router.get("/mountain-verification-results", requireAdminAuth(), async (req, res) => {
  try {
    const name = typeof req.query.mountainName === "string" ? req.query.mountainName : undefined;
    const rows = name
      ? await db
          .select()
          .from(mountainVerificationTests)
          .where(eq(mountainVerificationTests.mountainName, name))
          .orderBy(desc(mountainVerificationTests.createdAt))
          .limit(50)
      : await db
          .select()
          .from(mountainVerificationTests)
          .orderBy(desc(mountainVerificationTests.createdAt))
          .limit(100);
    writeAuditLog(res.locals.adminIdentity, "mountain-verification-results-view", name ?? null, { count: rows.length });
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch results");
    res.status(500).json({ error: "DB query failed" });
  }
});

// ── POST /api/mountain-verification-test/batch ────────────────────────────

const BATCH_MOUNTAINS = [
  "Musbury Tor",
  "Peel Tower",
  "Mam Tor",
  "Pen y Ghent",
  "Snowdon",
  "Ben Nevis",
];

router.post("/mountain-verification-test/batch", requireAdminAuth(), async (req, res) => {
  writeAuditLog(res.locals.adminIdentity, "mountain-verification-batch-start", null, { mountains: BATCH_MOUNTAINS });
  res.json({ status: "started", mountains: BATCH_MOUNTAINS });

  setImmediate(async () => {
    for (const name of BATCH_MOUNTAINS) {
      try {
        await processMountain(name, {
          info: (...a) => console.info("[batch]", ...a),
          warn: (...a) => console.warn("[batch]", ...a),
        });
        await sleep(3000); // respect Nominatim 1 req/sec + buffer
      } catch (err) {
        console.error("[batch] Failed for", name, err);
      }
    }
    console.info("[batch] All 6 mountains tested");
  });
});

export default router;
