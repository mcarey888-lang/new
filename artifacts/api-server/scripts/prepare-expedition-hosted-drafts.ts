/**
 * Development-only fallback using the app's existing free hiking provider.
 * Bounded by the existing atomic quota reservation, one request per missing
 * itinerary, no paid plan, no raw secrets/logged provider bodies.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { assertReviewDatabase } from "../src/services/routeReviewAdmin.js";
import { hostedRoutingStore } from "../src/services/routing/hostedRoutingStore.js";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
async function main() {
  const c = await pool.connect();
  try { await assertReviewDatabase(c); } finally { c.release(); }
  if (!process.env.OPENROUTESERVICE_API_KEY) throw Error("Existing hiking provider key is unavailable.");
  const root = resolve("../..");
  const directory = resolve(root, "generated-artifacts/expedition-network/prepared");
  const config = JSON.parse(await readFile(resolve(root, "scripts/expedition-network-itineraries.json"), "utf8"));
  const audit = JSON.parse(await readFile(resolve(root, "generated-artifacts/route-coverage/2026-10-26/audit.json"), "utf8"));
  const existing = new Set((await readdir(directory)).filter(f => f.endsWith(".input.json")).map(f => f.replace(".input.json", "")));
  const results: unknown[] = [];
  const selected = process.argv.find(v => v.startsWith("--keys="))?.slice(7).split(",");
  let requests = 0;
  for (const [key, anchors] of Object.entries(config) as [string, [number,number,string][]][]) {
    if (key.startsWith("_") || existing.has(key) || (selected && !selected.includes(key))) continue;
    if (++requests > 30) throw Error("Development fallback request budget exhausted.");
    if (!await hostedRoutingStore.reserve()) throw Error("Existing free routing quota has no capacity; stopped without bypassing it.");
    const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-hiking/geojson", {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { Authorization: process.env.OPENROUTESERVICE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: anchors.map(([lat,lon]) => [lon,lat]),
        radiuses: anchors.map(() => 850), elevation: false, instructions: false }),
    });
    if (response.status === 429 || response.status === 403) throw Error(`Existing hiking provider rejected the batch (${response.status}); stopped.`);
    const raw = await response.text();
    const data = JSON.parse(raw);
    const geom = data.features?.[0]?.geometry;
    if (!response.ok || geom?.type !== "LineString" || !Array.isArray(geom.coordinates)) {
      results.push({ routeKey: key, status: "blocked", httpStatus: response.status, providerCode: data.error?.code ?? null });
    } else {
      const coords = geom.coordinates;
      const lengthM = data.features[0].properties?.summary?.distance;
      if (coords.length < 2 || coords.length > 20000 || !Number.isFinite(lengthM) || lengthM > 60000 ||
        coords.some((p: any) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
        results.push({ routeKey: key, status: "blocked", reason: "Provider geometry exceeds private review contract." });
      } else {
        const row = audit.priorities.find((r: any) => r.routeKeys[0] === key);
        const captured = new Date().toISOString();
        const source = JSON.stringify({
          format: "summitready-hosted-hiking-draft-v1", provider: "openrouteservice by HeiGIT",
          profile: "foot-hiking", geometry: geom, engine: data.metadata?.engine ?? null,
          originalResponseSha256: digest(raw), capturedAt: captured,
          attribution: "© openrouteservice by HeiGIT | Data from OpenStreetMap · CC BY-SA 4.0",
          licence: "CC-BY-SA-4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
          termsUrl: "https://account.heigit.org/info/tos",
          proposedAnchors: anchors.map(([lat,lon,label]) => ({ lat,lon,label })),
          scope: "Hiking engine output through proposed anchors; not proof of the named ridge/scramble itinerary, safe access or a confirmed parking start.",
        });
        const input = {
          candidateKey: row.routeName + " — route draft",
          revisionVersion: "ors-draft-" + digest(source).slice(0,16),
          geometryFile: JSON.stringify(geom),
          sourceManifest: [{
            name: row.routeName + " — proposed hiking-engine itinerary",
            provider: "openrouteservice by HeiGIT", licence: "CC-BY-SA-4.0",
            licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
            attribution: "© openrouteservice by HeiGIT | Data from OpenStreetMap · CC BY-SA 4.0",
            url: "https://account.heigit.org/info/tos", sha256: digest(source), sourceCapturedAt: captured,
            expeditionRouteKey: key, fullExpeditionVariantConfirmed: false, rightsReviewComplete: false,
            routeAccessReviewed: false, draftMethod: "ors-proposed-itinerary-v1",
            scope: "Proposed walking-engine draft, not a verified named route. Owner must check start, ridge/scramble variant and return. Rights/share-alike obligations and access remain unreviewed. No elevation profile supplied.",
            proposedAnchors: anchors.map(([lat,lon,label]) => ({ lat,lon,label })),
            planningEstimates: { existingExpeditionDistanceKm: row.currentDistancesKm[0], existingExpeditionAscentM: row.currentAscentsM[0] },
            expeditionIds: row.expeditionIds,
          }],
        };
        await writeFile(resolve(directory, `${key}.source.json`), source);
        await writeFile(resolve(directory, `${key}.input.json`), JSON.stringify(input));
        results.push({ routeKey: key, status: "prepared", points: coords.length, lengthKm: Math.round(lengthM/10)/100 });
      }
    }
    console.log(JSON.stringify(results.at(-1)));
    await writeFile(resolve(directory, "hosted-preparation.json"), JSON.stringify(results, null,2));
    await new Promise(r => setTimeout(r, 2200));
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Fallback preparation failed"); process.exitCode=1; })
  .finally(() => pool.end());
