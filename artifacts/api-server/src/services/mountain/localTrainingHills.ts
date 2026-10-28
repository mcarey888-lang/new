import { findLocalHillPeaks, loadLocalHillIndex, normalizeLocalHillName } from "./localHillIndex";
import { lookupVerifiedCanonicalSummitsInArea, type VerifiedCanonicalMountain } from "./canonicalMountainLookup";
import type { Hill, OSMPeak, osmPeaksToHills } from "../../routes/hills-unified";
import { logger } from "../../lib/logger";

/** Merge the stored OSM layer with the existing catalogue, then select by
 * actual proximity, not summit height. All ascents remain terrain estimates. */
export async function localTrainingHills(
  lat: number, lng: number, radiusKm: number, minAscent: number,
  estimate: typeof osmPeaksToHills, name?: string,
  load = loadLocalHillIndex, lookup = lookupVerifiedCanonicalSummitsInArea,
) {
  const { snapshot } = await load();
  const peaks = findLocalHillPeaks(snapshot, lat, lng, radiusKm, name);
  const canonicalById = new Map<number, VerifiedCanonicalMountain>();
  // Stored OSM remains independently useful if the canonical reader is down.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const canonical = await Promise.race([
      lookup({ centerLat: lat, centerLng: lng, radiusKm, limit: 50, order: "nearest" }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Canonical supplement timed out")), 2_000);
      }),
    ]);
    for (const [index, summit] of canonical.entries()) {
      if (name && normalizeLocalHillName(summit.name) !== normalizeLocalHillName(name)) continue;
      const same = peaks.find(p => normalizeLocalHillName(p.name) === normalizeLocalHillName(summit.name) &&
        Math.hypot((p.lat - summit.latitude) * 111, (p.lng - summit.longitude) * 70) < 0.1);
      if (same) {
        canonicalById.set(same.id, summit);
      } else {
        const id = -(index + 1);
        canonicalById.set(id, summit);
        peaks.push({
          id, name: summit.name, lat: summit.latitude, lng: summit.longitude,
          ele: summit.elevationM ?? null,
        } as OSMPeak);
      }
    }
  } catch {
    logger.warn("Canonical supplement unavailable; searching the stored OSM hill layer");
  } finally {
    if (timer) clearTimeout(timer);
  }
  const hills: Hill[] = (await estimate(peaks, lat, lng, radiusKm, minAscent, true, true)).map((hill): Hill => {
    const id = Number(hill.summitIdentityKey?.replace(/^osm:node:/, ""));
    const summit = canonicalById.get(id);
    if (!summit) return hill;
    return {
      ...hill, summitId: summit.canonicalSourceKey, summitIdentityKey: `canonical:${summit.id}`,
      routeId: `route:terrain:${summit.canonicalSourceKey}`,
      routeIdentityKey: `route:terrain:${summit.canonicalSourceKey}`,
      dataSource: "canonical_verified", routeDataStatus: "terrain_calculated",
    };
  }).filter(h => h.distance <= radiusKm).sort((a, b) => a.distance - b.distance);
  return {
    hills, source: "osm_extract",
    snapshotDate: snapshot.builtAt,
    attribution: { text: snapshot.attribution, url: "https://www.openstreetmap.org/copyright",
      licence: snapshot.licence, sourceDownload: "/api/local-hills/source" },
  };
}
