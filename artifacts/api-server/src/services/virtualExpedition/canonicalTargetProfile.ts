import type {
  TrustedCanonicalRoute,
  VerifiedCanonicalMountain,
} from "../mountain/canonicalMountainLookup.js";
import type {
  RouteDna,
  TargetMountainProfile,
} from "../../routes/virtual-expedition.js";

export interface VerifiedRouteChoice {
  identityKey: string;
  routeName: string;
  startPoint: string | null;
  distanceKm: number | null;
  totalAscentMetres: number | null;
  typicalDurationHours: number | null;
  summitElevationMetres: number | null;
  evidence: TrustedCanonicalRoute["evidence"];
}

export interface CanonicalTargetProfile {
  profile: TargetMountainProfile;
  route: TrustedCanonicalRoute;
  metricSources: Record<string, string>;
}

function clampDna(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function routeText(route: TrustedCanonicalRoute): string {
  return [
    route.name,
    route.startName,
    route.description,
    route.evidence.title,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function deriveRouteDna(route: TrustedCanonicalRoute): RouteDna {
  const text = routeText(route);
  const ascent = route.totalAscentM ?? 0;
  const distanceKm = route.distanceKm ?? 1;
  const durationHours = route.typicalDurationHours ?? Math.max(1, ascent / 300);
  const verticalRatio = ascent / Math.max(1, distanceKm * 1_000);

  const scrambling = /(scrambl|hands on|via ferrata|rock step)/.test(text) ? 7 : 2;
  const exposure = /(expos|knife.edge|consequential|precipitous|narrow ridge)/.test(text) ? 8 : 2;
  const ridgeTravel = /(ridge|ar[eê]te|traverse)/.test(text) ? 7 : 3;
  const technicalMovement = /(technical|scrambl|climb|crampon|ice axe|rope)/.test(text) ? 7 : 2;
  const navigationRequired = /(navigation|unmarked|route.find|whiteout|complex)/.test(text) ? 7 : 4;
  const endurance = clampDna(Math.max(durationHours / 1.5, ascent / 260));
  const steepness = clampDna(verticalRatio * 45);
  const descentDifficulty = clampDna(Math.max(steepness, technicalMovement - 1));
  const sustainedClimbing = clampDna((endurance + steepness) / 2 + 1);

  return {
    scrambling,
    exposure,
    ridgeTravel,
    endurance,
    technicalMovement,
    navigationRequired,
    steepness,
    scenicQuality: 7,
    descentDifficulty,
    sustainedClimbing,
  };
}

function deriveDifficulty(
  route: TrustedCanonicalRoute,
  routeDna: RouteDna,
): TargetMountainProfile["difficulty"] {
  const text = routeText(route);
  if (/(glacier|crampon|ice axe|alpine grade|technical climb)/.test(text)) return "Alpine";
  if (
    Math.max(routeDna.scrambling, routeDna.exposure, routeDna.technicalMovement) >= 7
    || (route.totalAscentM ?? 0) >= 1_500
    || (route.typicalDurationHours ?? 0) >= 10
  ) return "Hard";
  if ((route.totalAscentM ?? 0) >= 700 || (route.typicalDurationHours ?? 0) >= 6) {
    return "Moderate";
  }
  return "Easy";
}

function altitudeExposure(
  summitElevationMetres: number,
): TargetMountainProfile["altitudeExposure"] {
  if (summitElevationMetres >= 5_500) return "Extreme";
  if (summitElevationMetres >= 3_500) return "High";
  if (summitElevationMetres >= 2_500) return "Moderate";
  return "None";
}

export function verifiedRouteChoices(
  mountain: VerifiedCanonicalMountain,
): VerifiedRouteChoice[] {
  return mountain.routes.map(route => ({
    identityKey: route.identityKey,
    routeId: route.routeId ?? null,
    version: route.version ?? null,
    mountainId: route.mountainId ? `sde:mountain:${route.mountainId}` : `sde:mountain:${mountain.id}`,
    routeName: route.name,
    startPoint: route.startName ?? null,
    distanceKm: route.distanceKm ?? null,
    totalAscentMetres: route.totalAscentM ?? null,
    typicalDurationHours: route.typicalDurationHours ?? null,
    summitElevationMetres: route.summitElevationM ?? mountain.elevationM ?? null,
    evidence: route.evidence,
  }));
}

export function selectVerifiedRoute(
  mountain: VerifiedCanonicalMountain,
  requestedIdentityKey?: string | null,
  requestedRouteId?: string | null,
): TrustedCanonicalRoute | null {
  if (requestedRouteId) {
    const route = mountain.routes.find(candidate => candidate.routeId === requestedRouteId);
    if (!route) return null;
    if (requestedIdentityKey && route.identityKey !== requestedIdentityKey) return null;
    return route;
  }
  if (requestedIdentityKey) {
    const matches = mountain.routes.filter(route => route.identityKey === requestedIdentityKey);
    return matches.length === 1 ? matches[0] : null;
  }
  return mountain.routes.length === 1 ? mountain.routes[0] : null;
}

/**
 * Adapt only complete verified route facts into the legacy mobile target shape.
 * No missing distance, ascent, duration, or summit fact is estimated here.
 */
export function canonicalRouteToTargetProfile(
  mountain: VerifiedCanonicalMountain,
  route: TrustedCanonicalRoute,
): CanonicalTargetProfile | null {
  const summitElevation = route.summitElevationM ?? mountain.elevationM;
  const totalElevationGain = route.totalAscentM;
  const totalDistance = route.distanceKm;
  const durationHours = route.typicalDurationHours;
  if (
    summitElevation == null || summitElevation <= 0
    || totalElevationGain == null || totalElevationGain <= 0
    || totalDistance == null || totalDistance <= 0
    || durationHours == null || durationHours <= 0
  ) {
    return null;
  }

  const text = routeText(route);
  const estimatedDays: 1 | 2 =
    durationHours > 14 || /(multi.day|two.day|2.day|overnight|hut stay)/.test(text) ? 2 : 1;
  const day1ElevationGain = estimatedDays === 2
    ? Math.round(totalElevationGain * 0.55)
    : totalElevationGain;
  const day2ElevationGain = estimatedDays === 2
    ? totalElevationGain - day1ElevationGain
    : null;
  const routeDna = deriveRouteDna(route);

  return {
    profile: {
      name: mountain.name,
      country: mountain.country ?? mountain.region ?? "Unknown",
      summitElevation,
      totalElevationGain,
      totalDistance,
      estimatedDays,
      day1ElevationGain,
      day2ElevationGain,
      maxDailyElevation: Math.max(day1ElevationGain, day2ElevationGain ?? 0),
      difficulty: deriveDifficulty(route, routeDna),
      technicalGrade: null,
      altitudeExposure: altitudeExposure(summitElevation),
      notes: route.description
        ?? `Verified route facts for ${route.name}${route.startName ? ` from ${route.startName}` : ""}.`,
      routeDna,
    },
    route,
    metricSources: {
      name: "summit_data_engine.mountains.verified",
      country: mountain.country
        ? "summit_data_engine.mountains.verified"
        : "canonical_region_or_unavailable",
      summitElevation: route.summitElevationM != null
        ? "summit_data_engine.route_facts.verified"
        : "summit_data_engine.mountains.verified",
      totalElevationGain: "summit_data_engine.route_facts.verified",
      totalDistance: "summit_data_engine.route_facts.verified",
      typicalDuration: "summit_data_engine.route_facts.verified",
      estimatedDays: "calculated_from_verified_duration",
      dailyElevationGain: "calculated_from_verified_total_ascent",
      difficulty: "calculated_from_verified_route_facts",
      altitudeExposure: "calculated_from_verified_summit_elevation",
      routeDna: "calculated_from_verified_route_facts",
      notes: route.description
        ? "summit_data_engine.route_definitions.verified"
        : "generated_label_from_verified_route_identity",
    },
  };
}