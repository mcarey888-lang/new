/**
 * Capture exact terrain contributor headers without approving/importing routes.
 * Writes only a small JSON evidence report to the ignored generated-artifacts tree.
 * No database, secrets, paid API calls, tile replacements or profile recalculation.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const root = resolve(import.meta.dirname, "../../..");
const input = process.argv[2];
if (!input) throw new Error("Pass the saved terrain-manifest.json path relative to workspace root.");
const path = resolve(root, input);
if (!path.startsWith(`${root}/generated-artifacts/route-profile/`)) throw new Error("Use a saved pilot manifest, not an arbitrary path.");
const saved = JSON.parse(await readFile(path, "utf8")) as { key: string; url: string; sha256: string; bytes: number }[];
if (!saved.length || saved.length > 48) throw new Error("Unexpected tile count");
const tiles = [];
for (const tile of saved) {
  const url = new URL(tile.url);
  if (url.protocol !== "https:" || !["s3.amazonaws.com", "elevation-tiles-prod.s3.amazonaws.com"].includes(url.hostname)
    || !/^\/(?:elevation-tiles-prod\/)?terrarium\/14\/\d+\/\d+\.png$/.test(url.pathname)) throw new Error("Unexpected terrain URL");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Terrain evidence unavailable: ${tile.key}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sameBytes = bytes.length === tile.bytes && hash(bytes) === tile.sha256;
  if (!sameBytes) throw new Error("Current tile differs from saved pilot; do not attribute old bytes using new headers");
  const contributors = response.headers.get("x-amz-meta-x-imagery-sources") ?? response.headers.get("x-imagery-sources");
  if (!contributors) throw new Error("No provider contributor evidence");
  tiles.push({ key: tile.key, url: tile.url, sha256: tile.sha256, bytes: tile.bytes, sameBytes,
    contributors: contributors.split(",").map(s => s.trim()), etag: response.headers.get("etag") });
}
const report = {
  format: "summitready-terrain-rights-evidence-v1", inspectedAt: new Date().toISOString(),
  originalManifest: input, originalManifestSha256: hash(await readFile(path)),
  tiles, contributorFamily: "EU-DEM (only if all contributor paths have eudem/ prefix)",
  contributorFamilyConfirmed: tiles.every(t => t.contributors.every(c => c.startsWith("eudem/"))),
  datasetEditionProvenByHeaders: false, automatedRightsApproval: false,
  licenceSources: [
    "https://github.com/tilezen/joerd/blob/master/docs/data-sources.md",
    "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
    "https://sdi.eea.europa.eu/catalogue/srv/api/records/19cff95e-61ac-45ed-8ee3-c43220d709cf",
  ],
  obligations: ["Inform the public of the data source", "Clearly state adaptations/modifications",
    "Do not imply EU endorsement", "Retain required EU-DEM/Tilezen credit in any future public profile"],
  proposedCredit: "Produced using Copernicus data and information funded by the European Union – EU-DEM layers. Terrain tiles: Mapzen/Tilezen. Profile resampled and ascent estimated by SummitReady; not EU-endorsed or surveyed.",
  outcome: "source-family-identified-reuse-conditions-documented-human-review-still-required",
};
const directory = resolve(root, "generated-artifacts/terrain-rights");
await mkdir(directory, { recursive: true });
const output = resolve(directory, `watkin-${report.originalManifestSha256.slice(0,12)}.json`);
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output: output.slice(root.length+1), tileCount: tiles.length,
  allOriginalBytesMatched: true, contributorFamilyConfirmed: report.contributorFamilyConfirmed, automatedRightsApproval: false }));
