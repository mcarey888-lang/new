import {
  lookupVerifiedCanonicalSummitsInArea,
  type VerifiedCanonicalMountain,
} from "./canonicalMountainLookup";
import type { Hill, OSMPeak, osmPeaksToHills } from "../../routes/hills-unified";

/** Catalogue identity establishes a summit, never a verified walking route. */
export async function canonicalTrainingHills(
  lat: number,
  lng: number,
  radiusKm: number,
  minAscent: number,
  estimate: typeof osmPeaksToHills,
  lookup = lookupVerifiedCanonicalSummitsInArea,
): Promise<Hill[] | null> {
  const summits = (await lookup({
    centerLat: lat, centerLng: lng, radiusKm, limit: 50,
  })).filter(s => Number.isFinite(s.elevationM) && s.elevationM! > 0);
  if (!summits.length) return null;

  // These temporary numeric IDs only correlate estimator results within this
  // request. They are replaced with the genuine catalogue identities below.
  const byId = new Map<string, VerifiedCanonicalMountain>();
  const peaks: OSMPeak[] = summits.map((s, index) => {
    byId.set(`osm:node:${index + 1}`, s);
    return { id: index + 1, lat: s.latitude, lng: s.longitude, name: s.name, ele: s.elevationM! };
  });
  const estimated = await estimate(peaks, lat, lng, radiusKm, minAscent, true, true);
  return estimated.map(hill => {
    const summit = byId.get(hill.summitIdentityKey!);
    if (!summit) throw new Error("Training hill lost its catalogue identity");
    const routeId = `route:terrain:${summit.canonicalSourceKey}`;
    return {
      ...hill,
      summitId: summit.canonicalSourceKey,
      summitIdentityKey: `canonical:${summit.id}`,
      summitName: summit.name,
      summitElevationASL: summit.elevationM,
      summitProminenceM: summit.prominenceM,
      routeIdentityKey: routeId,
      routeId,
      dataSource: "canonical_verified" as const,
      routeDataStatus: "terrain_calculated" as const,
    };
  });
}
