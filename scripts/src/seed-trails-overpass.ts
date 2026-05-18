import { db, seededTrails } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// UK hiking areas — bounding boxes [south, west, north, east]
// ─────────────────────────────────────────────────────────────────────────────

const AREAS = [
  {
    name: "Peak District",
    location: "Peak District, Derbyshire",
    terrain: "hill" as const,
    bounds: [53.0, -2.2, 53.6, -1.5] as [number, number, number, number],
  },
  {
    name: "Lake District",
    location: "Lake District, Cumbria",
    terrain: "mountain" as const,
    bounds: [54.2, -3.3, 54.7, -2.8] as [number, number, number, number],
  },
  {
    name: "Yorkshire Dales",
    location: "Yorkshire Dales, North Yorkshire",
    terrain: "hill" as const,
    bounds: [54.0, -2.5, 54.5, -2.0] as [number, number, number, number],
  },
  {
    name: "Snowdonia",
    location: "Snowdonia, Wales",
    terrain: "mountain" as const,
    bounds: [52.8, -4.1, 53.2, -3.6] as [number, number, number, number],
  },
  {
    name: "Brecon Beacons",
    location: "Brecon Beacons, Wales",
    terrain: "mountain" as const,
    bounds: [51.7, -3.7, 52.0, -3.2] as [number, number, number, number],
  },
  {
    name: "Dartmoor",
    location: "Dartmoor, Devon",
    terrain: "hill" as const,
    bounds: [50.4, -4.1, 50.7, -3.7] as [number, number, number, number],
  },
  {
    name: "Cairngorms",
    location: "Cairngorms, Scotland",
    terrain: "mountain" as const,
    bounds: [56.8, -3.8, 57.2, -3.2] as [number, number, number, number],
  },
  {
    name: "Ben Nevis",
    location: "Fort William, Scotland",
    terrain: "mountain" as const,
    bounds: [56.7, -5.2, 57.1, -4.8] as [number, number, number, number],
  },
  {
    name: "Exmoor",
    location: "Exmoor, Somerset",
    terrain: "hill" as const,
    bounds: [51.0, -3.9, 51.3, -3.5] as [number, number, number, number],
  },
  {
    name: "South Downs",
    location: "South Downs, Sussex",
    terrain: "mixed" as const,
    bounds: [50.8, -0.8, 51.0, 0.3] as [number, number, number, number],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Overpass types
// ─────────────────────────────────────────────────────────────────────────────

interface OsmRelation {
  type: "relation";
  id: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
}

interface OverpassResult {
  elements: OsmRelation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDistance(tag: string | undefined): number | null {
  if (!tag) return null;
  const cleaned = tag.replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0) return null;
  // If the value looks like metres (>150 without "km" suffix) convert to km
  if (n > 150 && !tag.toLowerCase().includes("km")) return Math.round((n / 1000) * 10) / 10;
  return Math.round(n * 10) / 10;
}

function parseAscent(tag: string | undefined): number | null {
  if (!tag) return null;
  const n = parseInt(tag.replace(/[^\d]/g, ""), 10);
  if (isNaN(n) || n < 0) return null;
  return n;
}

function parseDifficulty(sacScale: string | undefined, distance: number, ascent: number): string {
  if (sacScale) {
    const s = sacScale.toLowerCase();
    if (s.includes("alpine") || s === "t4" || s === "t5" || s === "t6") return "SKIP";
    if (s.includes("demanding") || s === "t3") return "Hard";
    if (s.includes("mountain_hiking") || s === "t2") return "Moderate";
    if (s.includes("hiking") || s === "t1") return "Easy";
  }
  // Heuristic from distance + ascent
  if (ascent >= 600 || distance >= 20) return "Hard";
  if (ascent >= 250 || distance >= 10) return "Moderate";
  return "Easy";
}

function formatTime(distanceKm: number, ascentM: number): string {
  // Naismith's rule: 4 km/h + 1 hr per 300 m ascent
  const hours = distanceKm / 4 + ascentM / 300;
  const totalMins = Math.round(hours * 60);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function pickEmoji(terrain: string, difficulty: string): string {
  if (terrain === "mountain") {
    if (difficulty === "Hard") return "🏔️";
    if (difficulty === "Moderate") return "⛰️";
    return "🌿";
  }
  if (terrain === "hill") {
    if (difficulty === "Hard") return "⛰️";
    return "🌄";
  }
  if (terrain === "coastal") return "🌊";
  if (terrain === "woodland") return "🌲";
  return "🗺️";
}

function pickBestFor(difficulty: string, terrain: string, distance: number, areaName: string): string[] {
  const bestFor: string[] = [];
  const scenicAreas = ["Lake District", "Snowdonia", "Cairngorms", "Ben Nevis", "Brecon Beacons"];

  if (difficulty === "Easy" && distance < 8) bestFor.push("family walk");
  if (difficulty !== "Easy") bestFor.push("training");
  if (difficulty === "Hard" && terrain === "mountain") bestFor.push("summit prep");
  if (scenicAreas.includes(areaName)) bestFor.push("scenic walk");
  if (bestFor.length === 0) bestFor.push("scenic walk");

  return [...new Set(bestFor)];
}

function pickBenefits(difficulty: string, distance: number, ascent: number): string[] {
  const benefits: string[] = ["cardio"];
  if (ascent >= 150) benefits.push("elevation");
  if (distance >= 10) benefits.push("endurance");
  if (difficulty === "Hard") benefits.push("pack weight");
  return benefits;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Overpass query
// ─────────────────────────────────────────────────────────────────────────────

async function queryOverpass(
  bounds: [number, number, number, number],
  areaName: string,
): Promise<OsmRelation[]> {
  const [south, west, north, east] = bounds;
  const query = `[out:json][timeout:60];
(
  relation["type"="route"]["route"~"hiking|foot|walking"]["name"](${south},${west},${north},${east});
);
out tags center bb;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SummitReady/1.0 (hiking training app; seed script)",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(65000),
  });

  if (!res.ok) {
    throw new Error(`Overpass error for ${areaName}: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OverpassResult;
  return data.elements.filter((el) => el.type === "relation");
}

// ─────────────────────────────────────────────────────────────────────────────
// Map OSM relation → InsertSeededTrail
// ─────────────────────────────────────────────────────────────────────────────

function mapRelation(
  rel: OsmRelation,
  area: (typeof AREAS)[number],
): (typeof seededTrails.$inferInsert) | null {
  const tags = rel.tags ?? {};
  const name = tags["name"]?.trim();
  if (!name || name.length < 3) return null;

  // Lat/lng from center or computed from bounds
  let lat: number | undefined;
  let lng: number | undefined;
  if (rel.center) {
    lat = rel.center.lat;
    lng = rel.center.lon;
  } else if (rel.bounds) {
    lat = (rel.bounds.minlat + rel.bounds.maxlat) / 2;
    lng = (rel.bounds.minlon + rel.bounds.maxlon) / 2;
  }

  // Distance: prefer OSM tag; fall back to bbox diagonal estimate
  let distance = parseDistance(tags["distance"]);
  if (!distance && rel.bounds) {
    const latDiff = rel.bounds.maxlat - rel.bounds.minlat;
    const lngDiff = rel.bounds.maxlon - rel.bounds.minlon;
    const midLat = (rel.bounds.minlat + rel.bounds.maxlat) / 2;
    const diagonal = Math.sqrt(
      (latDiff * 111) ** 2 + (lngDiff * 111 * Math.cos((midLat * Math.PI) / 180)) ** 2,
    );
    // Loop trail ~= 2.5x diagonal; out-and-back ~= 2x diagonal
    distance = Math.round(diagonal * 2.5 * 10) / 10;
  }
  if (!distance || distance < 0.5 || distance > 100) return null;

  const ascent = parseAscent(tags["ascent"] ?? tags["ele:gain"]) ?? Math.round(distance * 30);

  const difficulty = parseDifficulty(tags["sac_scale"], distance, ascent);
  if (difficulty === "SKIP") return null;

  const routeType = tags["roundtrip"] === "yes"
    ? "loop"
    : tags["roundtrip"] === "no"
    ? "out-and-back"
    : "loop";

  const description =
    tags["description"] ??
    tags["note"] ??
    `A ${difficulty.toLowerCase()} ${area.terrain} route in the ${area.name}. ` +
      `${distance} km${ascent > 0 ? ` with ${ascent} m of ascent` : ""}.`;

  const estimatedTime = formatTime(distance, ascent);
  const emoji = pickEmoji(area.terrain, difficulty);
  const bestFor = pickBestFor(difficulty, area.terrain, distance, area.name);
  const trainingBenefits = pickBenefits(difficulty, distance, ascent);

  return {
    id: `osm_${rel.id}`,
    osmId: String(rel.id),
    name,
    location: area.location,
    distance,
    elevationGain: ascent,
    estimatedTime,
    difficulty,
    terrain: area.terrain,
    routeType,
    bestFor,
    description,
    trainingBenefits,
    emoji,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    osmArea: area.name,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌍 Starting Overpass trail seeder…");

  const seenOsmIds = new Set<number>();
  let inserted = 0;
  let skipped = 0;

  for (const area of AREAS) {
    console.log(`\n📍 Querying ${area.name}…`);

    let relations: OsmRelation[];
    try {
      relations = await queryOverpass(area.bounds, area.name);
    } catch (err) {
      console.error(`  ❌ Overpass query failed: ${err}`);
      await sleep(5000);
      continue;
    }

    console.log(`  Found ${relations.length} raw relations`);

    const toInsert: (typeof seededTrails.$inferInsert)[] = [];

    for (const rel of relations) {
      if (seenOsmIds.has(rel.id)) {
        skipped++;
        continue;
      }
      seenOsmIds.add(rel.id);

      const row = mapRelation(rel, area);
      if (!row) {
        skipped++;
        continue;
      }
      toInsert.push(row);
    }

    // Limit per area to keep DB size sensible
    const batch = toInsert.slice(0, 40);

    if (batch.length > 0) {
      await db
        .insert(seededTrails)
        .values(batch)
        .onConflictDoUpdate({
          target: seededTrails.id,
          set: {
            name: sql`excluded.name`,
            distance: sql`excluded.distance`,
            elevationGain: sql`excluded.elevation_gain`,
            estimatedTime: sql`excluded.estimated_time`,
            difficulty: sql`excluded.difficulty`,
            description: sql`excluded.description`,
            bestFor: sql`excluded.best_for`,
            trainingBenefits: sql`excluded.training_benefits`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            seededAt: sql`NOW()`,
          },
        });

      inserted += batch.length;
      console.log(`  ✅ Upserted ${batch.length} trails`);
    } else {
      console.log(`  ⚠️  No usable trails found`);
    }

    // Polite delay between areas to avoid hammering Overpass
    await sleep(3000);
  }

  console.log(`\n🏁 Done. ${inserted} trails upserted, ${skipped} skipped/duplicate.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
