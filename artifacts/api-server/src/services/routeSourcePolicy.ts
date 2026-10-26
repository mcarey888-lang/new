/** Published source tracks and generated itineraries are not interchangeable. */
const withdrawnMethods = new Set([
  "osm-network-proposed-itinerary-v1", "ors-proposed-itinerary-v1",
]);
export const constructedSourceMessage =
  "Withdrawn: this itinerary was constructed from approximate waypoints, not acquired as a published route track. Obtain a matching reusable source track instead.";
const legacyPilot = "Snowdon via Watkin Path — pilot";
const legacyAssemblies = new Set(["13-profile-1", "13-profile-2-linked-draft"]);
export function isConstructedRoute(manifest: unknown, version?: unknown, candidateKey?: unknown): boolean {
  return typeof version === "string" && /^(osm-network-|ors-draft-)/.test(version) ||
    candidateKey === legacyPilot && (legacyAssemblies.has(String(version)) ||
      Array.isArray(manifest) && manifest.some(s => legacyAssemblies.has(s?.parentRevisionVersion))) ||
    Array.isArray(manifest) && manifest.some(s => s && typeof s === "object" &&
      withdrawnMethods.has(s.draftMethod));
}
// Also inspect inherited manifest entries: editing must not launder a generated
// parent's geometry into an apparently published source.
export const constructedRouteSql = `(r.revision_version LIKE 'osm-network-%'
  OR r.revision_version LIKE 'ors-draft-%'
  OR (r.candidate_key='Snowdon via Watkin Path — pilot' AND (
    r.revision_version IN ('13-profile-1','13-profile-2-linked-draft')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.source_manifest) s
      WHERE s->>'parentRevisionVersion' IN ('13-profile-1','13-profile-2-linked-draft'))))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.source_manifest) s
    WHERE s->>'draftMethod' IN ('osm-network-proposed-itinerary-v1','ors-proposed-itinerary-v1')))`;
