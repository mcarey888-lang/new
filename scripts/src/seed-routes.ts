const API_BASE = process.env.API_URL ?? "http://localhost:80/api";

interface TrackPoint { lat: number; lon: number; alt: number; ts: number }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function noise(scale = 0.0001) { return (Math.random() - 0.5) * 2 * scale; }

/**
 * Generate a GPS breadcrumb trail for an out-and-back route.
 * Produces `steps` points going up then the same number back down.
 */
function generateTrack(
  startLat: number, startLon: number, startAlt: number,
  summitLat: number, summitLon: number, summitAlt: number,
  steps = 80,
  startTs = Date.now() - 4 * 3600_000,
  secsBetween = 90,
): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Slight parabolic deviation off the straight line (ridge wander)
    const arc = Math.sin(t * Math.PI) * 0.001;
    pts.push({
      lat: lerp(startLat, summitLat, t) + noise(0.00008) + arc * 0.3,
      lon: lerp(startLon, summitLon, t) + noise(0.00008) + arc,
      alt: Math.round(lerp(startAlt, summitAlt, t) + noise(5) * 100),
      ts: startTs + i * secsBetween * 1000,
    });
  }
  // Back down
  for (let i = 1; i <= steps; i++) {
    const t = 1 - i / steps;
    const arc = Math.sin(t * Math.PI) * 0.001;
    pts.push({
      lat: lerp(startLat, summitLat, t) + noise(0.00008) + arc * 0.3,
      lon: lerp(startLon, summitLon, t) + noise(0.00008) + arc,
      alt: Math.round(lerp(startAlt, summitAlt, t) + noise(5) * 100),
      ts: startTs + (steps + i) * secsBetween * 1000,
    });
  }
  return pts;
}

const SAMPLE_ROUTES = [
  {
    id: "seed-pen-y-fan-001",
    name: "Pen y Fan — South Ridge",
    location: "Brecon Beacons, Wales",
    distanceKm: 7.8,
    elevationGain: 446,
    elevationLoss: 446,
    durationSecs: 2 * 3600 + 30 * 60,
    difficulty: "Moderate" as const,
    notes: "The classic Pen y Fan route from Pont ar Daf. Clear path, excellent views from the summit plateau.",
    startLat: 51.8664,
    startLng: -3.4420,
    start: { lat: 51.8664, lon: -3.4420, alt: 440 },
    summit: { lat: 51.8843, lon: -3.4371, alt: 886 },
  },
  {
    id: "seed-kinder-scout-001",
    name: "Kinder Scout — Edale Circular",
    location: "Peak District, Derbyshire",
    distanceKm: 12.4,
    elevationGain: 490,
    elevationLoss: 490,
    durationSecs: 4 * 3600 + 15 * 60,
    difficulty: "Moderate" as const,
    notes: "Classic Peak District circuit via Jacob's Ladder and the southern edge. Boggy in winter.",
    startLat: 53.3617,
    startLng: -1.8162,
    start: { lat: 53.3617, lon: -1.8162, alt: 170 },
    summit: { lat: 53.3855, lon: -1.8717, alt: 636 },
  },
  {
    id: "seed-helvellyn-001",
    name: "Helvellyn via Striding Edge",
    location: "Lake District, Cumbria",
    distanceKm: 11.2,
    elevationGain: 760,
    elevationLoss: 760,
    durationSecs: 5 * 3600,
    difficulty: "Hard" as const,
    notes: "The finest ridge walk in England. Hands-on scramble on Striding Edge. Return via Swirral Edge.",
    startLat: 54.5440,
    startLng: -2.9523,
    start: { lat: 54.5440, lon: -2.9523, alt: 155 },
    summit: { lat: 54.5270, lon: -3.0160, alt: 950 },
  },
  {
    id: "seed-ben-lomond-001",
    name: "Ben Lomond — Tourist Path",
    location: "Loch Lomondside, Scotland",
    distanceKm: 9.6,
    elevationGain: 1010,
    elevationLoss: 1010,
    durationSecs: 4 * 3600 + 45 * 60,
    difficulty: "Hard" as const,
    notes: "Scotland's most southerly Munro and one of the most climbed. Well-maintained path from Rowardennan.",
    startLat: 56.1272,
    startLng: -4.6316,
    start: { lat: 56.1272, lon: -4.6316, alt: 30 },
    summit: { lat: 56.1903, lon: -4.6342, alt: 974 },
  },
  {
    id: "seed-mam-tor-001",
    name: "Mam Tor & Great Ridge",
    location: "Peak District, Derbyshire",
    distanceKm: 5.6,
    elevationGain: 260,
    elevationLoss: 260,
    durationSecs: 1 * 3600 + 50 * 60,
    difficulty: "Easy" as const,
    notes: "Fantastic ridge walk above the Hope Valley. Family-friendly once you're on the ridge. Short sharp climb from the car park.",
    startLat: 53.3520,
    startLng: -1.8068,
    start: { lat: 53.3520, lon: -1.8068, alt: 305 },
    summit: { lat: 53.3479, lon: -1.8136, alt: 517 },
  },
];

async function seedRoutes() {
  console.log(`Seeding ${SAMPLE_ROUTES.length} sample routes to ${API_BASE} …\n`);
  const baseTs = Date.now() - 7 * 24 * 3600_000;

  for (const r of SAMPLE_ROUTES) {
    const trackPoints = generateTrack(
      r.start.lat, r.start.lon, r.start.alt,
      r.summit.lat, r.summit.lon, r.summit.alt,
      80,
      baseTs + Math.random() * 5 * 24 * 3600_000,
      Math.round(r.durationSecs / 160),
    );

    const body = {
      id: r.id,
      name: r.name,
      location: r.location,
      distanceKm: r.distanceKm,
      elevationGain: r.elevationGain,
      elevationLoss: r.elevationLoss,
      durationSecs: r.durationSecs,
      difficulty: r.difficulty,
      startLat: r.startLat,
      startLng: r.startLng,
      trackPoints,
      notes: r.notes,
    };

    try {
      const res = await fetch(`${API_BASE}/tracked-routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        console.log(`  ✓ ${r.name} (${trackPoints.length} pts)`);
      } else {
        console.log(`  ✗ ${r.name} — ${res.status} ${json.error ?? ""}`);
      }
    } catch (err) {
      console.error(`  ✗ ${r.name} — network error:`, err);
    }
  }

  console.log("\nDone. Check the community routes screen in the app.");
}

seedRoutes().catch(console.error);
