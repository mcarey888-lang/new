import type { NearbyHill } from "../context/AppContext";

export function isMappedTrainingHill(hill: NearbyHill): boolean {
  return hill.dataSource === "canonical_verified" ||
    !!hill.routeIdentityKey?.startsWith("route:v1:osm_overpass:") ||
    !!hill.routeIdentityKey?.startsWith("route:v1:seeded_osm:");
}

export function sessionHillTitle(type: string, label: string, hillName?: string) {
  if (!hillName || (type !== "hill" && type !== "bigDay")) return label;
  return `${hillName} ${type === "bigDay" ? "Big Day" : "Reps"}`;
}

/** Use the same identity and route facts as Explore, including on older plans. */
export function hillDetailNavigation(hill: NearbyHill, location: string) {
  return {
    pathname: "/hill-detail" as const,
    params: {
      name: hill.name,
      routeIdentityKey: hill.routeIdentityKey ?? "",
      summitIdentityKey: hill.summitIdentityKey ?? "",
      location,
      lat: hill.lat?.toString() ?? "",
      lng: hill.lng?.toString() ?? "",
      elevation: hill.elevation.toString(),
      elevationEstimated: hill.routeDataStatus === "terrain_calculated" ? "true" : "false",
      distance: hill.distance.toString(),
      routeDistance: hill.routeDistance?.toString() ?? "",
      estimatedTime: hill.estimatedTime ?? "",
      routeType: hill.routeType ?? "",
      grade: hill.grade,
      surface: hill.surface,
      emoji: hill.emoji,
    },
  };
}
