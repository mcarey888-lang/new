export type HillMapTarget = { lat: number; lng: number; verified: boolean };

function coordinates(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Browsing a selected route's location is not proof of a summit or trailhead. */
export function hillMapTarget(input: {
  lat: number | null;
  lng: number | null;
  routeIdentityKey?: string;
  detail?: {
    summitLat: number | null;
    summitLng: number | null;
    provenance?: { mapCoordinates?: string };
  } | null;
}): HillMapTarget | null {
  const detail = coordinates(input.detail?.summitLat, input.detail?.summitLng);
  if (detail && input.detail?.provenance?.mapCoordinates === "verified") {
    return { ...detail, verified: true };
  }
  const selected = coordinates(input.lat, input.lng);
  if (!selected) return null;
  const mapped = ["route:v1:osm_overpass:", "route:v1:osm_nominatim:", "route:v1:seeded_osm:"]
    .some(prefix => input.routeIdentityKey?.startsWith(prefix));
  return { ...selected, verified: mapped };
}

export function hillMapNavigation(target: HillMapTarget) {
  return {
    pathname: "/route-planner" as const,
    // No startLabel: viewing a location must never seed a route or start recording.
    params: { focusLat: String(target.lat), focusLng: String(target.lng) },
  };
}
