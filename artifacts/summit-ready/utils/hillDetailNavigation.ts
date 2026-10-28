import type { NearbyHill, PlanSession, TrainingWeek } from "../context/AppContext";

/** Resolve the hill named by this session, never the first hill in the week. */
export function resolveSessionHill(
  session: PlanSession | undefined,
  week: TrainingWeek | undefined,
  assigned: NearbyHill | undefined,
  available: readonly NearbyHill[] = [],
): NearbyHill | null {
  if (!session || session.type === "cardio") return null;
  if (assigned) return assigned;
  const normalise = (name: string) => name.toLowerCase().replace(/['’]/g, "").trim();
  const candidates = week?.hills ?? [];
  const name = session.hillName ??
    candidates.find(h =>
      session.label.endsWith(`— ${h.name}`) ||
      session.label === `${h.name} Reps` ||
      session.label === `${h.name} Big Day` ||
      session.description.startsWith(`${h.name} (`) ||
      session.description.includes(`Target: ${h.name}:`)
    )?.name;
  if (!name) return null;
  const full = available.filter(h => normalise(h.name) === normalise(name));
  const planned = candidates.filter(h => normalise(h.name) === normalise(name));
  // Ambiguous duplicate names require an explicit assignment, not a guess.
  if (full.length === 1) return full[0];
  if (full.length > 1 || planned.length !== 1) return null;
  return { ...planned[0], emoji: "⛰️", surface: "Mixed", grade: "Moderate" };
}

export function isMappedTrainingHill(hill: NearbyHill): boolean {
  return hill.dataSource === "canonical_verified" ||
    !!hill.routeIdentityKey?.startsWith("route:v1:osm_extract:") ||
    !!hill.routeIdentityKey?.startsWith("route:v1:osm_overpass:") ||
    !!hill.routeIdentityKey?.startsWith("route:v1:osm_nominatim:") ||
    !!hill.routeIdentityKey?.startsWith("route:v1:seeded_osm:");
}

/** Common local names must not select or remove a different nearby hill. */
export function trainingHillIdentity(hill: NearbyHill): string {
  return hill.summitIdentityKey ?? hill.routeIdentityKey ??
    `${hill.name}:${hill.lat ?? ""},${hill.lng ?? ""}`;
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
