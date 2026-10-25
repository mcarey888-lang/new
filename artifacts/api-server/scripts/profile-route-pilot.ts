/**
 * Offline review pipeline only. No DB imports, app changes, or route approval.
 * Run: pnpm --filter @workspace/api-server exec tsx scripts/profile-route-pilot.ts <candidate-dir>
 * Replay: add --replay <earlier-profile-output-dir> to forbid all network access.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { routeProfile, SAMPLE_INTERVAL_M, ASCENT_THRESHOLD_M, resample } from "../src/services/routing/profile";
import { TERRAIN_ZOOM } from "../src/services/routing/terrain";
import { sha256, validatePilotEvidence, type PilotCandidate } from "./routePilotEvidence";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const input = process.argv[2];
if (!input) throw new Error("Provide the review candidate directory");
const replayFlag = process.argv.indexOf("--replay");
const replay = replayFlag >= 0 ? resolve(process.argv[replayFlag + 1] ?? "") : null;
if (replayFlag >= 0 && !process.argv[replayFlag + 1]) throw new Error("Provide a replay source directory");
const directory = resolve(input);
const candidate = JSON.parse(await readFile(join(directory, "candidate.json"), "utf8")) as PilotCandidate;
const geometryBytes = await readFile(join(directory, "proposed-route.geojson"));
const snapshotBytes = await readFile(join(directory, "source-snapshot.json"));
const sourceChecks = validatePilotEvidence(candidate, geometryBytes, snapshotBytes);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(root, "generated-artifacts/route-profile", `watkin-${candidate.geometrySha256.slice(0,12)}-${stamp}`);
await mkdir(join(output, "terrain-tiles"), { recursive: true });

interface TerrainTile {
  url: string; key: string; sha256: string | null; bytes: number; retrievedAt: string;
  etag?: string | null; lastModified?: string | null; outcome: "retrieved" | "unavailable";
}
const savedManifest: TerrainTile[] = replay
  ? JSON.parse(await readFile(join(replay, "terrain-manifest.json"), "utf8")) : [];
const terrainManifest: TerrainTile[] = [];
const requests = new Map<string, Promise<Buffer | null>>();
const evidenceErrors: Error[] = [];

async function obtainTile(url: string): Promise<Buffer | null> {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/elevation-tiles-prod\/terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (parsed.origin !== "https://s3.amazonaws.com" || parsed.search || !match) {
    throw new Error("Only the explicitly documented public terrain tile source is allowed");
  }
  const key = `${match[1]}-${match[2]}-${match[3]}`;
  if (requests.size >= 48) throw new Error("Pilot tile limit exceeded");
  const previous = savedManifest.find(entry => entry.key === key);
  if (replay) {
    if (!previous || previous.outcome !== "retrieved" || previous.url !== url) throw new Error("Replay terrain tile evidence missing");
    const bytes = await readFile(join(replay, "terrain-tiles", `${key}.png`));
    if (sha256(bytes) !== previous.sha256) throw new Error("Replay tile checksum mismatch");
    await writeFile(join(output, "terrain-tiles", `${key}.png`), bytes, { flag: "wx" });
    terrainManifest.push(previous);
    return bytes;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 2_000_000) throw new Error("Unavailable or oversized terrain tile");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2_000_000) throw new Error("Oversized terrain tile");
    await writeFile(join(output, "terrain-tiles", `${key}.png`), bytes, { flag: "wx" });
    terrainManifest.push({ url, key, sha256: sha256(bytes), bytes: bytes.length, retrievedAt: new Date().toISOString(),
      etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), outcome: "retrieved" });
    return bytes;
  } catch {
    terrainManifest.push({ url, key, sha256: null, bytes: 0, retrievedAt: new Date().toISOString(), outcome: "unavailable" });
    return null;
  }
}

// Memoise failures too: one missing tile must not cause hundreds of retries.
const fetcher = async (url: string): Promise<Response> => {
  let pending = requests.get(url);
  if (!pending) {
    pending = obtainTile(url);
    requests.set(url, pending);
  }
  try {
    const bytes = await pending;
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response(null, { status: 503 });
  } catch (error) {
    // The reusable terrain reader deliberately turns ordinary fetch failures
    // into missing elevations. Corrupt review evidence must instead fail this
    // offline evaluator explicitly, not masquerade as an ordinary missing tile.
    if (!evidenceErrors.length) evidenceErrors.push(error instanceof Error ? error : new Error("Invalid terrain evidence"));
    return new Response(null, { status: 503 });
  }
};
const line = sourceChecks.coordinates.map(([longitude, latitude]) => ({ longitude: longitude!, latitude: latitude! }));
const result = await routeProfile(line, { fetcher });
if (evidenceErrors.length) throw new Error(`Terrain evidence validation failed: ${evidenceErrors[0]!.message}`);
const sampled = resample(line, SAMPLE_INTERVAL_M);
const codeInputs = ["../src/services/routing/profile.ts", "../src/services/routing/terrain.ts",
  "../src/services/routing/pathSnapping.ts", "routePilotEvidence.ts", "profile-route-pilot.ts"];
const codeHashes = Object.fromEntries(await Promise.all(codeInputs.map(async name =>
  [name, sha256(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), name)))])));
const profile = {
  format: "summitready-terrain-profile-review-v1",
  candidateId: candidate.candidateId, geometrySha256: candidate.geometrySha256,
  sourceSnapshotSha256: candidate.sourceSnapshotSha256, createdAt: new Date().toISOString(),
  storage: "review_files_only", navigationReady: false, canonicalVerified: false,
  provider: {
    name: "Mapzen / Tilezen composite terrain on AWS", zoom: TERRAIN_ZOOM,
    attributionUrl: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
    dataSourcesUrl: "https://github.com/tilezen/joerd/blob/master/docs/data-sources.md",
    specificContributingDatasetIdentified: false, rightsReviewComplete: false,
    resolutionNote: "Composite-source resolution varies. Zoom-14 pixels do not establish survey-level accuracy.",
  },
  method: { sampleIntervalM: SAMPLE_INTERVAL_M, ascentThresholdM: ASCENT_THRESHOLD_M, codeHashes,
    runtime: { node: process.versions.node, platform: process.platform, arch: process.arch },
    classification: "DEM-derived planning estimate, not GPS-recorded ascent or surveyed route facts",
    endpointHeightsAdjustedToCatalogue: false, replayed: !!replay },
  result,
  sampledPositions: sampled.map((point, i) => ({ ...point,
    // Existing result distanceM follows chords between samples. Preserve it,
    // and separately record true nominal chainage along the source geometry.
    distanceAlongGeometryM: result.outcome === "profiled"
      ? Math.min(i * SAMPLE_INTERVAL_M, result.lengthM) : i * SAMPLE_INTERVAL_M })),
};
const json = (value: unknown) => JSON.stringify(value, null, 2);
const profileBytes = Buffer.from(json(profile));
const manifestBytes = Buffer.from(json(terrainManifest));
const reasons = ["human_route_and_access_review_required", "terrain_dataset_rights_review_required",
  "exact_version_canonical_publication_relationship_not_implemented"];
if (result.outcome !== "profiled") reasons.push("incomplete_or_unusable_elevation_profile");
if (sourceChecks.accessReviewFlags.length) reasons.push("mapped_access_tags_require_review");
const validation = {
  format: "summitready-route-review-validation-v1", evaluatedAt: new Date().toISOString(),
  candidateId: candidate.candidateId, geometrySha256: candidate.geometrySha256,
  sourceSnapshotSha256: candidate.sourceSnapshotSha256,
  profileSha256: sha256(profileBytes), terrainManifestSha256: sha256(manifestBytes),
  evaluatorCodeHashes: codeHashes, outcome: "needs_human_review", storage: "review_files_only",
  databaseValidationPersisted: false, canonicalPublicationEligible: false,
  structuralSourceConsistencyPassed: sourceChecks.structuralSourceConsistencyPassed,
  sourceEdgesChecked: sourceChecks.sourceEdgesChecked, sourceWayCount: sourceChecks.usedSourceWays,
  accessReviewFlags: sourceChecks.accessReviewFlags,
  elevationCoverageComplete: result.outcome === "profiled", publicationBlockers: reasons,
};
await writeFile(join(output, "profile.json"), profileBytes, { flag: "wx" });
await writeFile(join(output, "terrain-manifest.json"), manifestBytes, { flag: "wx" });
await writeFile(join(output, "validation.json"), json(validation), { flag: "wx" });
if (result.outcome === "profiled" || result.outcome === "incomplete") {
  const rows = result.points.map((p, i) => [i, profile.sampledPositions[i]!.distanceAlongGeometryM,
    p.distanceM, p.elevationM ?? "", p.cumulativeAscentM ?? ""].join(","));
  await writeFile(join(output, "profile.csv"),
    "sample,distance_along_geometry_m,distance_between_sample_chords_m,elevation_m,cumulative_estimated_ascent_m\n"+rows.join("\n")+"\n");
}
const escape = (text: unknown) => String(text).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]!);
const downloadNames = ["profile.json", "terrain-manifest.json", "validation.json",
  ...(result.outcome === "profiled" || result.outcome === "incomplete" ? ["profile.csv"] : [])];
const downloads = await Promise.all(downloadNames.map(async name =>
  `<a download="${name}" href="data:application/octet-stream;base64,${(await readFile(join(output,name))).toString("base64")}">${name}</a>`));
const points = result.outcome === "profiled" || result.outcome === "incomplete" ? result.points : [];
const displayRows = points.flatMap((point, i) =>
  i === 0 || i === points.length - 1 || i % 40 === 0
    ? [`<tr><td>${(profile.sampledPositions[i]!.distanceAlongGeometryM/1000).toFixed(2)}</td><td>${point.elevationM ?? "Unavailable"}</td></tr>`] : []);
const summary = result.outcome === "profiled"
  ? `<dl><dt>Estimated ascent / descent</dt><dd>${result.ascentM} m / ${result.descentM} m</dd>
    <dt>Mapped route length</dt><dd>${(result.lengthM/1000).toFixed(2)} km</dd><dt>Terrain elevation range</dt>
    <dd>${result.minElevationM}–${result.maxElevationM} m</dd><dt>Profile coverage</dt><dd>${result.points.length} samples, no missing elevations</dd>
    <dt>Existing expedition figures — unchanged</dt><dd>${candidate.distance.existingExpeditionDistanceKm} km / ${candidate.distance.existingExpeditionAscentM} m ascent</dd>
    <dt>Catalogue summit elevation</dt><dd>${candidate.catalogueMountain.elevationM} m.
    The DEM was not shifted to force a match.</dd></dl>`
  : `<p>Profile outcome: ${escape(result.outcome)}. No whole-route ascent estimate is available.</p>`;
const report = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>Watkin Path — terrain profile review</title><style>
  body{font:16px/1.6 system-ui,sans-serif;background:#091611;color:#e5f1ea;max-width:1000px;margin:auto;padding:28px}
  a{color:#76e8b5}.warning{border-left:4px solid #ffcc56;background:#302919;padding:18px}
  dt{color:#a9beb1}dd{font-size:20px;margin:0 0 16px}table{border-collapse:collapse;width:100%;max-width:600px}
  td,th{padding:10px;border-bottom:1px solid #294137;text-align:left}code{overflow-wrap:anywhere}
  </style><h1>Watkin Path: elevation review</h1><p>Planning estimate only · Not approved · No database imports</p>
  <p class="warning">Terrain heights are modelled ground elevations, not a survey, actual GPS activity or proof that a path is safe.
  An all-present profile means data coverage, not verified accuracy. No existing expedition, artwork or user activity was changed.</p>
  <h2>Result</h2>${summary}<p>Reuses the existing app calculator: ${SAMPLE_INTERVAL_M} m sample interval,
  ${ASCENT_THRESHOLD_M} m ascent/descent reversal threshold. Small terrain features and sharp summits can be missed.</p>
  <h2>What the validation establishes</h2><p>${sourceChecks.sourceEdgesChecked} geometry edges match adjacent,
  versioned OSM source nodes. Terrain tile bytes, profile, geometry and source snapshot are bound by SHA-256 hashes.
  ${replay ? "This run replayed saved terrain tiles without network requests." : "Terrain tile bytes and retrieval metadata were saved for offline replay."}</p>
  <h2>Still blocked from publication</h2><ul>${reasons.map(x=>`<li>${escape(x.replace(/_/g," "))}</li>`).join("")}</ul>
  <p>This validation is a local review file, <strong>not a persisted canonical database approval</strong>.
  The existing API geometry gate is unchanged.</p>
  <h2>Selected elevation samples</h2><p>A selection only; download the CSV for the full profile.
  Distances use source-geometry chainage, not straight chords between displayed sample points.</p>
  <table><thead><tr><th>Distance along route (km)</th><th>Terrain elevation (m)</th></tr></thead>
  <tbody>${displayRows.join("")}</tbody></table>
  <h2>Sources and rights</h2><p>Route geometry: © OpenStreetMap contributors,
  <a href="https://www.openstreetmap.org/copyright">ODbL and applicable share-alike obligations</a>.
  Terrain: Mapzen / Tilezen composite tiles on AWS.
  <a href="${profile.provider.attributionUrl}">Provider attribution requirements</a>;
  <a href="${profile.provider.dataSourcesUrl}">underlying source datasets and licences</a>.
  The exact contributing dataset for these tiles has not yet been established; this is not a claim of cleared redistribution rights.</p>
  <h2>Review downloads</h2><p>${downloads.join(" · ")}</p>
  <p>Review files only—not expedition bulk-import JSON and not navigation-ready.</p>
  <p>Exact geometry checksum: <code>${candidate.geometrySha256}</code></p></html>`;
await writeFile(join(output, "review.html"), report, { flag: "wx" });
console.log(json({ output, outcome: result.outcome,
  ...(result.outcome === "profiled" ? { ascentM: result.ascentM, descentM: result.descentM, samples: result.points.length } : {}),
  tileRequests: terrainManifest.length, replayed: !!replay, navigationReady: false, databaseWrites: 0 }));
