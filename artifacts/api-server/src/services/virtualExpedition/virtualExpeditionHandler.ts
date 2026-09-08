import type { Request, Response } from "express";
import { z } from "zod";

import {
  fetchOSMPeaks,
  fetchTopoElevations,
  geocodeLocation,
  normalizeLocation,
  osmPeaksToHills,
  type Hill,
} from "../../routes/hills-unified.js";
import type {
  TargetMountainProfile,
} from "../../routes/virtual-expedition.js";
import {
  lookupVerifiedCanonicalSummitsInArea,
  lookupVerifiedCanonicalMountain,
  type VerifiedCanonicalMountain,
} from "../mountain/canonicalMountainLookup.js";
import {
  canonicalRouteToTargetProfile,
  selectVerifiedRoute,
  verifiedRouteChoices,
} from "./canonicalTargetProfile.js";
import {
  isDeterministicCandidateCompatible,
  isDeterministicTargetFeasible,
  matchDeterministicExpedition,
  matchQuickestHighSummits,
  type DeterministicExpeditionMatch,
} from "./deterministicMatcher.js";
import {
  loadLocalDatabaseCandidates,
} from "./localCandidates.js";

interface ScoreBreakdown {
  overall: number;
  elevation: number;
  duration: number;
  altitude: number;
  consecutiveDays: number;
  adventureScore?: number;
  dnaMatchScore?: number;
}

interface ExpeditionPlan {
  title: string;
  concept: string;
  days: Array<{
    label: string;
    title: string;
    focus: string;
    routes: Array<{ name: string; routeIdentityKey?: string; why: string }>;
  }>;
  alternatives: Record<string, string[]>;
  adventureScore: number;
  dnaMatchScore: number;
  dnaMatchNotes: string;
}

export interface FallbackProfileResult {
  profile: TargetMountainProfile;
  source: string;
  cached: boolean;
  usedAi: boolean;
  metricSources?: Record<string, string>;
}

export interface VirtualExpeditionHandlerDependencies {
  resolveFallbackProfile: (targetMountain: string) => Promise<FallbackProfileResult>;
  prepareCandidateHills: (hills: Hill[], profileDna: TargetMountainProfile["routeDna"]) => Hill[];
  computePhysicalScore: (
    hills: Hill[],
    summitElevations: Array<number | null>,
    profile: TargetMountainProfile,
    hasWeekendPairing: boolean,
  ) => ScoreBreakdown;
  canonicalLookup?: typeof lookupVerifiedCanonicalMountain;
  canonicalAreaLookup?: typeof lookupVerifiedCanonicalSummitsInArea;
  loadLocalCandidates?: typeof loadLocalDatabaseCandidates;
  geocode?: typeof geocodeLocation;
  fetchPeaks?: typeof fetchOSMPeaks;
  peaksToHills?: typeof osmPeaksToHills;
  fetchElevations?: typeof fetchTopoElevations;
  matchCandidates?: typeof matchDeterministicExpedition | typeof matchQuickestHighSummits;
  now?: () => number;
}

type CachedArea = {
  hills: Hill[];
  userLat: number;
  userLng: number;
  cachedAt: number;
  queriedRows: {
    cachedHills: number;
    seededTrails: number;
  };
  discoveryWarnings: string[];
  discoveryDiagnostics: DiscoveryDiagnostics;
  canonicalSummitShortlist: Array<Record<string, unknown>>;
  excludedLocalRoutes: Array<Record<string, unknown>>;
};

type DiscoveryDiagnostics = {
  preparedDatabaseCandidates: number;
  databaseCandidatesFeasible: boolean;
  maxAttainableSafeAscent: number;
  targetAscentThreshold: number;
  externalEnrichmentAttempted: boolean;
  externalPeaksFound: number;
  externalRoutesAdded: number;
  externalEnrichmentStatus: "not_needed" | "complete" | "depleted" | "partial" | "failed";
  summitElevationEnrichmentStatus: "not_needed" | "complete" | "partial" | "failed";
  canonicalSummitsFound?: number;
};

const areaCache = new Map<string, CachedArea>();
const AREA_CACHE_TTL_MS = 30 * 60 * 1_000;

function maxAttainableAscent(hills: Hill[]): number {
  return [...hills]
    .filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0)
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, 8)
    .reduce((sum, hill) => sum + hill.elevation * 3, 0);
}

function excludedLocalRouteDiagnostics(hills: Hill[]): Array<Record<string, unknown>> {
  const genericName = /\b(way|valley|coast|interest|sightseeing|heritage|trail|path|walk)\b/i;
  return hills
    .filter(hill => genericName.test(hill.name) || (hill.routeDistance ?? 0) >= 20)
    .map(hill => ({
      name: hill.name,
      routeName: hill.routeName ?? null,
      routeIdentityKey: hill.routeIdentityKey ?? null,
      distanceKm: hill.routeDistance ?? null,
      reason: genericName.test(hill.name)
        ? "Excluded generic local route: not attached to a verified or named summit."
        : "Excluded generic long-distance local route: not a principal summit objective.",
    }));
}

function fallbackMetricSources(source: FallbackProfileResult["source"]): Record<string, string> {
  return {
    name: source,
    country: source,
    summitElevation: source,
    totalElevationGain: source,
    totalDistance: source,
    typicalDuration: source,
    estimatedDays: source,
    dailyElevationGain: source,
    difficulty: source,
    altitudeExposure: source,
    routeDna: source,
    notes: source,
  };
}

function canonicalSummitToHills(mountain: VerifiedCanonicalMountain): Hill[] {
  // Verified route facts take precedence. No trailhead coordinates are exposed:
  // the mountain coordinate remains the summit identity only.
  return mountain.routes
    .filter(candidate => candidate.totalAscentM && candidate.distanceKm && candidate.typicalDurationHours)
    .sort((a, b) =>
      `${a.description} ${a.name}`.localeCompare(`${b.description} ${b.name}`, "en")
      || a.identityKey.localeCompare(b.identityKey))
    .map(route => ({
    name: mountain.name,
    routeIdentityKey: route.identityKey,
    routeName: route.name,
    summitIdentityKey: mountain.canonicalSourceKey,
    summitProminenceM: mountain.prominenceM,
    elevation: route.totalAscentM,
    distance: route.distanceKm,
    repeats: 1,
    totalElevation: route.totalAscentM,
    surface: `${route.description} ${route.name}`.trim() || "mountain route",
    grade: route.totalAscentM >= 1_000 ? "Hard" : "Moderate",
    emoji: "mountain",
    lat: mountain.latitude,
    lng: mountain.longitude,
    routeType: "hill",
    routeDistance: route.distanceKm,
    estimatedTime: `${route.typicalDurationHours} h`,
    summitElevationASL: route.summitElevationM ?? mountain.elevationM,
    dataSource: "canonical_verified",
    routeDataStatus: "external_route",
  }));
}

function buildDeterministicPlan(
  profile: TargetMountainProfile,
  match: DeterministicExpeditionMatch,
): ExpeditionPlan {
  const scoreByIdentity = new Map(match.rankedCandidates
    .filter(candidate => candidate.routeIdentityKey)
    .map(candidate => [candidate.routeIdentityKey!, candidate]));
  const scoreByName = new Map(match.rankedCandidates.map(candidate => [candidate.name, candidate]));
  const dayCount = Math.min(3, Math.max(1, profile.estimatedDays));
  const days: ExpeditionPlan["days"] = Array.from({ length: dayCount }, (_, index) => ({
    label: dayCount === 1 ? "Expedition day" : `Day ${index + 1}`,
    title: index === 0 ? "Primary ascent day" : "Back-to-back endurance day",
    focus: index === 0 ? "sustained climbing and terrain match" : "recovery under continued ascent",
    routes: [],
  }));
  const dayAscent = new Array(dayCount).fill(0) as number[];

  for (const hill of match.selectedHills) {
    const destination = dayAscent.indexOf(Math.min(...dayAscent));
    const ranked = (hill.routeIdentityKey
      ? scoreByIdentity.get(hill.routeIdentityKey)
      : undefined) ?? scoreByName.get(hill.name);
    const summit = hill.summitElevationASL != null
      ? ` Summit ${hill.summitElevationASL.toLocaleString()}m ASL.`
      : "";
    const routeDistance = hill.routeDistance != null
      ? ` Distance ${hill.routeDistance.toLocaleString()}km.`
      : "";
    const duration = hill.estimatedTime ? ` Duration ${hill.estimatedTime}.` : "";
    const terrainFit = ranked
      ? ` Terrain/technical fit ${ranked.components.terrainRouteType}%.`
      : "";
    const routeFactStatus = hill.routeDataStatus === "external_route"
      ? "verified route facts"
      : hill.routeDataStatus === "terrain_calculated"
        ? "calculated terrain route facts"
        : hill.routeDataStatus === "seeded_estimate"
          ? "estimated seeded route facts"
          : hill.routeDataStatus === "unverified_cache"
            ? "unverified cached route facts"
            : "route fact status unknown";
    const sourceLabel = hill.dataSource === "legacy_cache"
      ? "legacy route cache"
      : hill.dataSource === "seeded_osm"
        ? "seeded OSM catalogue"
        : hill.dataSource
          ? hill.dataSource.replaceAll("_", " ")
          : "source not recorded";
    const source = ` Source: ${sourceLabel}; ${routeFactStatus}.`;
    days[destination].routes.push({
      name: hill.name,
      routeIdentityKey: hill.routeIdentityKey,
      why: `${hill.routeName ? `${hill.routeName}: ` : ""}${hill.elevation.toLocaleString()}m route ascent${hill.repeats > 1 ? ` × ${hill.repeats} repeats` : ""}.`
        + `${summit}${routeDistance}${duration}${terrainFit}`
        + ` deterministic fit ${ranked?.score ?? 0}%.${source}`,
    });
    dayAscent[destination] += hill.elevation * hill.repeats;
  }

  const selectedIdentities = new Set(match.selectedHills.map(hill =>
    hill.routeIdentityKey ?? hill.name));
  const alternatives = match.rankedCandidates
    .filter(candidate =>
      !selectedIdentities.has(candidate.routeIdentityKey ?? candidate.name) &&
      candidate.compatible)
    .slice(0, 3)
    .map(candidate => candidate.name);
  const highestLocalSummit = Math.max(
    0,
    ...match.selectedHills.flatMap(hill =>
      hill.summitElevationASL != null ? [hill.summitElevationASL] : []),
  );
  const altitudeNote = highestLocalSummit === 0
    ? " Local candidates do not provide summit altitude, so the target's absolute altitude cannot be reproduced or compared."
    : profile.summitElevation >= highestLocalSummit + 500
      ? " The target's absolute summit altitude cannot be reproduced locally."
      : "";

  return {
    title: `${profile.name}: local simulation`,
    concept: `A deterministic local route combination of the highest suitable local summit objectives for this timeframe, using verified route facts or clearly labelled terrain-calculated estimates.`,
    days: days.filter(day => day.routes.length > 0),
    alternatives: Object.fromEntries(match.selectedHills.map(hill => [
      hill.routeIdentityKey ?? hill.name,
      alternatives,
    ])),
    adventureScore: match.deterministicScore,
    dnaMatchScore: match.deterministicScore,
    dnaMatchNotes: `Selected by ${match.matchMethod}: ${match.outingCount} outings across ${match.distinctRouteCount} distinct routes; ${match.achievedAscent.toLocaleString()}m of ${profile.totalElevationGain.toLocaleString()}m ascent (${Math.round(match.targetRatio * 100)}%) and ${match.achievedDistance.toLocaleString()}km of ${profile.totalDistance.toLocaleString()}km (${Math.round(match.distanceRatio * 100)}%). Summit altitude is local route context and is not substituted for ascent.${altitudeNote} Prominence is unavailable because local route facts do not contain prominence.${match.strongestAlternative ? ` Strongest alternative combination: ${match.strongestAlternative}` : ""}`,
  };
}

export function createVirtualExpeditionHandler(
  dependencies: VirtualExpeditionHandlerDependencies,
) {
  const canonicalLookup = dependencies.canonicalLookup ?? lookupVerifiedCanonicalMountain;
  const canonicalAreaLookup = dependencies.canonicalAreaLookup ?? lookupVerifiedCanonicalSummitsInArea;
  const loadLocalCandidates = dependencies.loadLocalCandidates ?? loadLocalDatabaseCandidates;
  const geocode = dependencies.geocode ?? geocodeLocation;
  const fetchPeaks = dependencies.fetchPeaks ?? fetchOSMPeaks;
  const peaksToHills = dependencies.peaksToHills ?? osmPeaksToHills;
  const fetchElevations = dependencies.fetchElevations ?? fetchTopoElevations;
  const matchCandidates = dependencies.matchCandidates ?? matchDeterministicExpedition;
  const now = dependencies.now ?? Date.now;

  return async function virtualExpeditionHandler(req: Request, res: Response) {
    const startedAt = performance.now();
    const timings: Record<string, number> = {
      canonicalTargetLookup: 0,
      targetRouteProfile: 0,
      localDatabaseLookup: 0,
      externalGeographicEnrichment: 0,
      elevationEnrichment: 0,
      deterministicMatching: 0,
      aiNarration: 0,
      total: 0,
    };
    const timed = async <T>(stage: string, work: () => Promise<T> | T): Promise<T> => {
      const stageStartedAt = performance.now();
      try {
        return await work();
      } finally {
        timings[stage] = (timings[stage] ?? 0) + Math.round(performance.now() - stageStartedAt);
      }
    };
    const log = (req as Request & {
      log?: {
        info?: (obj: object, message: string) => void;
        warn?: (obj: object, message: string) => void;
        error?: (obj: object, message: string) => void;
      };
    }).log;

    try {
      const input = z.object({
        targetMountain: z.string().trim().min(2).max(200),
        targetCountry: z.string().trim().min(2).max(120).optional(),
        targetRegion: z.string().trim().min(2).max(160).optional(),
        userLocation: z.string().trim().min(2).max(300),
        radius: z.number().positive().max(200).optional().default(30),
        daysOverride: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
        expeditionStyle: z.literal("quickest_high_summits").optional().default("quickest_high_summits"),
        difficultyPreference: z.string().optional().nullable(),
        targetRouteIdentityKey: z.string().trim().min(1).max(200).optional().nullable(),
        requireVerifiedRouteSelection: z.boolean().optional().default(false),
      }).parse(req.body);
      const userLocation = normalizeLocation(input.userLocation);
      const radiusKm = Math.min(100, Math.max(5, input.radius));
      const warnings: string[] = [];
      let usedAi = false;
      let profileCached = false;
      let metricSources: Record<string, string> = {};
      let targetMountainSource = "unverified_fallback";
      let targetRouteSource = "unavailable";
      let routeDataStatus: "verified" | "unverified" = "unverified";
      let selectedTargetRouteIdentityKey: string | null = null;
      let selectedTargetRouteName: string | null = null;

      const canonicalResult = await timed("canonicalTargetLookup", () =>
        canonicalLookup({
          name: input.targetMountain,
          country: input.targetCountry,
          region: input.targetRegion,
        }));
      if (canonicalResult.kind === "ambiguous") {
        timings.total = Math.round(performance.now() - startedAt);
        return res.status(409).json({
          error: "Multiple verified mountains match that name. Add a country or region.",
          code: "AMBIGUOUS_MOUNTAIN",
          candidates: canonicalResult.matches,
          _meta: process.env.NODE_ENV === "production" ? undefined : { timingsMs: timings },
        });
      }

      const canonicalMountain = canonicalResult.kind === "match"
        ? canonicalResult.mountain
        : null;
      const availableVerifiedRoutes = canonicalMountain
        ? verifiedRouteChoices(canonicalMountain)
        : [];
      if (canonicalMountain) targetMountainSource = "summit_data_engine_verified";

      if (
        canonicalMountain
        && input.targetRouteIdentityKey
        && !canonicalMountain.routes.some(route => route.identityKey === input.targetRouteIdentityKey)
      ) {
        timings.total = Math.round(performance.now() - startedAt);
        return res.status(422).json({
          error: "The selected verified route does not belong to this mountain.",
          code: "TARGET_ROUTE_NOT_FOUND",
          routes: availableVerifiedRoutes,
          _meta: process.env.NODE_ENV === "production" ? undefined : { timingsMs: timings },
        });
      }

      const selectedCanonicalRoute = canonicalMountain
        ? selectVerifiedRoute(canonicalMountain, input.targetRouteIdentityKey)
        : null;
      const routeSelectionRequired = Boolean(
        canonicalMountain && canonicalMountain.routes.length > 1 && !selectedCanonicalRoute,
      );
      if (routeSelectionRequired) {
        timings.total = Math.round(performance.now() - startedAt);
        return res.status(409).json({
          error: `Choose a verified ${canonicalMountain!.name} route before generating the expedition.`,
          code: "TARGET_ROUTE_SELECTION_REQUIRED",
          targetMountain: {
            id: canonicalMountain!.id,
            canonicalName: canonicalMountain!.name,
            matchedBy: canonicalMountain!.matchedBy,
          },
          routes: availableVerifiedRoutes,
          _meta: process.env.NODE_ENV === "production" ? undefined : { timingsMs: timings },
        });
      }

      let targetProfile: TargetMountainProfile | null = null;
      if (canonicalMountain && selectedCanonicalRoute) {
        const adapted = await timed("targetRouteProfile", () =>
          canonicalRouteToTargetProfile(canonicalMountain, selectedCanonicalRoute));
        if (adapted) {
          targetProfile = adapted.profile;
          metricSources = adapted.metricSources;
          targetRouteSource = "summit_data_engine_verified_route";
          routeDataStatus = "verified";
          selectedTargetRouteIdentityKey = adapted.route.identityKey;
          selectedTargetRouteName = adapted.route.name;
        } else {
          if (input.targetRouteIdentityKey) {
            timings.total = Math.round(performance.now() - startedAt);
            return res.status(422).json({
              error: `Verified facts for ${selectedCanonicalRoute.name} are incomplete.`,
              code: "TARGET_ROUTE_FACTS_UNAVAILABLE",
              selectedRoute: availableVerifiedRoutes.find(
                route => route.identityKey === input.targetRouteIdentityKey,
              ) ?? null,
              routes: availableVerifiedRoutes,
              _meta: process.env.NODE_ENV === "production"
                ? undefined
                : { timingsMs: timings },
            });
          }
          warnings.push(
            `Verified route ${selectedCanonicalRoute.name} lacks required route facts; using an explicitly unverified fallback profile.`,
          );
        }
      } else if (canonicalMountain && canonicalMountain.routes.length === 0) {
        warnings.push(
          `${canonicalMountain.name} is verified, but no fully verified route facts are available; using an explicitly unverified route profile.`,
        );
      } else if (routeSelectionRequired) {
        warnings.push(
          `Several verified routes are available for ${canonicalMountain!.name}; none was selected, so no verified route was silently chosen.`,
        );
      }

      if (!targetProfile) {
        const fallback = await timed("targetRouteProfile", () =>
          dependencies.resolveFallbackProfile(input.targetMountain));
        targetProfile = fallback.profile;
        profileCached = fallback.cached;
        usedAi = fallback.usedAi;
        targetRouteSource = fallback.source;
        metricSources = fallback.metricSources ?? fallbackMetricSources(fallback.source);
        warnings.push(
          fallback.cached
            ? "Target route metrics came from an unverified legacy profile cache."
            : "Target route metrics are AI-estimated because verified and cached route facts were unavailable.",
        );
        if (canonicalMountain) {
          targetProfile = {
            ...targetProfile,
            name: canonicalMountain.name,
            country: canonicalMountain.country ?? canonicalMountain.region ?? targetProfile.country,
            summitElevation: canonicalMountain.elevationM ?? targetProfile.summitElevation,
          };
          metricSources.name = "summit_data_engine.mountains.verified";
          if (canonicalMountain.country) {
            metricSources.country = "summit_data_engine.mountains.verified";
          }
          if (canonicalMountain.elevationM != null) {
            metricSources.summitElevation = "summit_data_engine.mountains.verified";
          }
        } else {
          targetMountainSource = fallback.source;
        }
      }

      const effectiveProfile: TargetMountainProfile = input.daysOverride
        ? { ...targetProfile, estimatedDays: input.daysOverride }
        : targetProfile;
      if (input.daysOverride) metricSources.estimatedDays = "user_override";

      const areaKey = `${userLocation.toLowerCase()}|${radiusKm}|${input.expeditionStyle}`;
      const cachedArea = areaCache.get(areaKey);
      let localHills: Hill[];
      let userLat: number;
      let userLng: number;
      let areaCacheHit = false;
      let localQueriedRows = { cachedHills: 0, seededTrails: 0 };
      let discoveryWarnings: string[] = [];
      let discoveryDiagnostics: DiscoveryDiagnostics;
      let canonicalSummitShortlist: Array<Record<string, unknown>> = [];
      let excludedLocalRoutes: Array<Record<string, unknown>> = [];

      if (cachedArea && now() - cachedArea.cachedAt < AREA_CACHE_TTL_MS) {
        localHills = cachedArea.hills;
        userLat = cachedArea.userLat;
        userLng = cachedArea.userLng;
        localQueriedRows = cachedArea.queriedRows;
        discoveryWarnings = [...cachedArea.discoveryWarnings];
        discoveryDiagnostics = { ...cachedArea.discoveryDiagnostics };
        canonicalSummitShortlist = cachedArea.canonicalSummitShortlist;
        excludedLocalRoutes = cachedArea.excludedLocalRoutes;
        warnings.push(...discoveryWarnings);
        areaCacheHit = true;
      } else {
        const coords = await timed("externalGeographicEnrichment", () => geocode(userLocation));
        if (!coords) {
          return res.status(400).json({
            error: `Could not geocode location: "${userLocation}"`,
          });
        }
        userLat = coords.lat;
        userLng = coords.lng;
        const canonicalSummits = await timed("localDatabaseLookup", () =>
          canonicalAreaLookup({ centerLat: userLat, centerLng: userLng, radiusKm, limit: 20 }));
        const canonicalHills = canonicalSummits.flatMap(canonicalSummitToHills);
        canonicalSummitShortlist = canonicalSummits.map(summit => ({
          name: summit.name,
          summitElevationASL: summit.elevationM ?? null,
          prominenceM: summit.prominenceM ?? null,
          summitIdentityKey: summit.canonicalSourceKey,
          routeCount: summit.routes.length,
          source: "canonical_verified",
          routeAvailable: canonicalHills.some(hill =>
            hill.summitIdentityKey === summit.canonicalSourceKey),
          skippedReason: canonicalHills.some(hill =>
            hill.summitIdentityKey === summit.canonicalSourceKey)
            ? null
            : "No complete verified route facts are available for this canonical summit.",
        }));
        // Default discovery never begins with generic cached route rows.
        // They are queried only for exclusion diagnostics after summit sources
        // are depleted, and are never promoted to candidates.
        localHills = canonicalHills;
        localQueriedRows = { cachedHills: 0, seededTrails: 0 };
        const preparedDatabaseHills = dependencies.prepareCandidateHills(
          localHills,
          effectiveProfile.routeDna,
        );
        const compatibleDatabaseHills = preparedDatabaseHills.filter(hill =>
          isDeterministicCandidateCompatible(hill, effectiveProfile));
        discoveryDiagnostics = {
          preparedDatabaseCandidates: compatibleDatabaseHills.length,
          databaseCandidatesFeasible: isDeterministicTargetFeasible(
            compatibleDatabaseHills,
            effectiveProfile,
            input.difficultyPreference,
          ),
          maxAttainableSafeAscent: maxAttainableAscent(compatibleDatabaseHills),
          targetAscentThreshold: effectiveProfile.totalElevationGain * 0.9,
          externalEnrichmentAttempted: false,
          externalPeaksFound: 0,
          externalRoutesAdded: 0,
          externalEnrichmentStatus: "not_needed",
          summitElevationEnrichmentStatus: "not_needed",
          canonicalSummitsFound: canonicalSummits.length,
        };
      }

      let preparedHills = dependencies.prepareCandidateHills(
        localHills,
        effectiveProfile.routeDna,
      );
      const compatiblePreparedHills = preparedHills.filter(hill =>
        isDeterministicCandidateCompatible(hill, effectiveProfile));
      const sufficientBeforeEnrichment = isDeterministicTargetFeasible(
        compatiblePreparedHills,
        effectiveProfile,
        input.difficultyPreference,
      );
      let externalEnrichmentCompleted = false;
      const needsNamedSummitFallback = input.expeditionStyle === "quickest_high_summits"
        && !areaCacheHit
        && !localHills.some(hill => hill.dataSource === "canonical_verified");
      if (
        input.expeditionStyle === "quickest_high_summits"
          ? needsNamedSummitFallback
          : !sufficientBeforeEnrichment
      ) {
        discoveryDiagnostics.externalEnrichmentAttempted = true;
        try {
          const peaks = await timed("externalGeographicEnrichment", () =>
            fetchPeaks(userLat, userLng, radiusKm));
          discoveryDiagnostics.externalPeaksFound = peaks.length;
          if (peaks.length === 0) {
            discoveryDiagnostics.externalEnrichmentStatus = "depleted";
            const warning =
              "Canonical summit routes were unavailable and named OSM summit discovery returned no peaks; summit evidence is depleted and will be retried.";
            discoveryWarnings.push(warning);
            warnings.push(warning);
          } else {
            const externalHills = await timed("elevationEnrichment", () =>
              peaksToHills(peaks, userLat, userLng, radiusKm, 0));
            discoveryDiagnostics.externalRoutesAdded = externalHills.length;
            if (externalHills.length === 0) {
              discoveryDiagnostics.externalEnrichmentStatus = "partial";
              const warning =
                "External OSM peaks were found, but terrain/topographic enrichment produced no usable routes; enrichment is partial and will be retried.";
              discoveryWarnings.push(warning);
              warnings.push(warning);
            } else {
              // Named OSM peaks are the summit fallback. Generic local
              // Ways/trails are never promoted into this pool.
              localHills = [
                ...localHills,
                ...externalHills.map(hill => ({
                  ...hill,
                  dataSource: "osm_overpass" as const,
                  routeDataStatus: "terrain_calculated" as const,
                })),
              ];
              externalEnrichmentCompleted = true;
              discoveryDiagnostics.externalEnrichmentStatus = "complete";
              preparedHills = dependencies.prepareCandidateHills(
                localHills,
                effectiveProfile.routeDna,
              );
              const warning =
                `Canonical summit routes were unavailable; added ${externalHills.length} terrain-calculated named OSM summit candidate${externalHills.length === 1 ? "" : "s"}.`;
              discoveryWarnings.push(warning);
              warnings.push(warning);
            }
          }
        } catch (error) {
          const warning =
            `External hill discovery was unavailable; continuing with ${localHills.length} database route${localHills.length === 1 ? "" : "s"}.`;
          discoveryWarnings.push(warning);
          warnings.push(warning);
          discoveryDiagnostics.externalEnrichmentStatus = "failed";
          log?.warn?.({ err: error }, "External local-hill enrichment failed");
        }
      }

      if (!localHills.length) {
        const excluded = await timed("localDatabaseLookup", () =>
          loadLocalCandidates(userLat, userLng, radiusKm));
        localQueriedRows = excluded.queriedRows;
        discoveryWarnings.push(
          `No usable canonical or named OSM summit routes were found; ${excluded.hills.length} local route row${excluded.hills.length === 1 ? "" : "s"} were excluded because they are not verified summit attachments.`,
        );
        return res.status(404).json({
          error: `Insufficient verified or named summit evidence was found within ${radiusKm} km of ${userLocation}. Try a larger radius.`,
          warnings: [...new Set([...warnings, ...discoveryWarnings])],
        });
      }
      if (!areaCacheHit) {
        const excluded = await timed("localDatabaseLookup", () =>
          loadLocalCandidates(userLat, userLng, radiusKm));
        localQueriedRows = excluded.queriedRows;
        excludedLocalRoutes = excludedLocalRouteDiagnostics(excluded.hills);
      }
      // Failed or partial enrichment is deliberately not promoted into the
      // 30-minute cache. A subsequent request can retry immediately.
      const discoveryEvidenceComplete = ![
        "depleted", "partial", "failed",
      ].includes(discoveryDiagnostics.externalEnrichmentStatus);
      if (
        discoveryEvidenceComplete
        && (
          input.expeditionStyle === "quickest_high_summits"
            ? localHills.length > 0
            : sufficientBeforeEnrichment || externalEnrichmentCompleted
        )
      ) {
        areaCache.set(areaKey, {
          hills: localHills,
          userLat,
          userLng,
          cachedAt: now(),
          queriedRows: localQueriedRows,
          discoveryWarnings,
          discoveryDiagnostics,
          canonicalSummitShortlist,
          excludedLocalRoutes,
        });
      }

      const candidateHills = preparedHills;
      if (!candidateHills.length) {
        return res.status(404).json({
          error: "No safe routes compatible with the target Route DNA were found.",
        });
      }

      const match = await timed("deterministicMatching", () =>
        (input.expeditionStyle === "quickest_high_summits"
          ? matchQuickestHighSummits
          : matchCandidates)(candidateHills, effectiveProfile, input.difficultyPreference));
      warnings.push(...match.warnings);
      if (!match.selectedHills.length) {
        return res.status(404).json({
          error: "No safe route combination could be built from the available candidates.",
          warnings,
        });
      }

      const recommendedHills = match.selectedHills;
      const expedition = buildDeterministicPlan(effectiveProfile, match);
      const summitElevations: Array<number | null> = recommendedHills.map(
        hill => hill.summitElevationASL ?? null,
      );
      const missingIndices = recommendedHills
        .map((hill, index) =>
          hill.summitElevationASL == null && hill.lat != null && hill.lng != null ? index : -1)
        .filter(index => index >= 0);
      if (missingIndices.length > 0) {
        try {
          const elevations = await timed("elevationEnrichment", () =>
            fetchElevations(missingIndices.map(index => ({
              lat: recommendedHills[index].lat!,
              lng: recommendedHills[index].lng!,
            }))));
          const resolvedCount = missingIndices.filter((_, elevationIndex) =>
            typeof elevations[elevationIndex] === "number"
            && Number.isFinite(elevations[elevationIndex])).length;
          missingIndices.forEach((hillIndex, elevationIndex) => {
            summitElevations[hillIndex] = elevations[elevationIndex] ?? null;
          });
          if (resolvedCount === missingIndices.length) {
            discoveryDiagnostics.summitElevationEnrichmentStatus = "complete";
          } else {
            discoveryDiagnostics.summitElevationEnrichmentStatus = "partial";
            areaCache.delete(areaKey);
            warnings.push(
              resolvedCount === 0
                ? "Local summit altitude enrichment returned no usable elevations; enrichment is partial and the area will be retried."
                : "Local summit altitude enrichment returned only some elevations; enrichment is partial and the area will be retried.",
            );
          }
        } catch (error) {
          discoveryDiagnostics.summitElevationEnrichmentStatus = "failed";
          areaCache.delete(areaKey);
          warnings.push("Local summit altitude enrichment was unavailable; ascent matching remains valid.");
          log?.warn?.({ err: error }, "Local summit altitude enrichment failed");
        }
      }

      const physicalScore = dependencies.computePhysicalScore(
        recommendedHills,
        summitElevations,
        effectiveProfile,
        effectiveProfile.estimatedDays === 1 || expedition.days.length >= 2,
      );
      physicalScore.adventureScore = match.deterministicScore;
      physicalScore.dnaMatchScore = match.deterministicScore;

      const localCandidateSources = [
        ...new Set(candidateHills.map(hill => hill.dataSource ?? "unknown")),
      ];
      const localCandidateRouteDataStatuses = [
        ...new Set(candidateHills.map(hill => hill.routeDataStatus ?? "unknown")),
      ];
      const selectedCandidateSources = [
        ...new Set(recommendedHills.map(hill => hill.dataSource ?? "unknown")),
      ];
      const selectedCandidateRouteDataStatuses = [
        ...new Set(recommendedHills.map(hill => hill.routeDataStatus ?? "unknown")),
      ];
      if (selectedCandidateRouteDataStatuses.includes("seeded_estimate")) {
        warnings.push(
          "Selected routes include synthetic OSM-derived seeded estimates; these are not verified route facts.",
        );
      }
      timings.total = Math.round(performance.now() - startedAt);
      const shortlistBySummit = new Map<string, Record<string, unknown>>();
      for (const entry of [
        ...canonicalSummitShortlist,
        ...candidateHills.map(hill => ({
          name: hill.name,
          summitElevationASL: hill.summitElevationASL ?? null,
          prominenceM: hill.summitProminenceM ?? null,
          summitIdentityKey: hill.summitIdentityKey ?? null,
          routeIdentityKey: hill.routeIdentityKey ?? null,
          routeName: hill.routeName ?? null,
          routeAvailable: true,
          source: hill.dataSource ?? "unknown",
        })),
      ]) {
        const key = String(entry.summitIdentityKey ?? `${entry.name}:${entry.summitElevationASL}`);
        const existing = shortlistBySummit.get(key);
        if (!existing || (!existing.routeAvailable && entry.routeAvailable)) {
          shortlistBySummit.set(key, { ...existing, ...entry });
        }
      }
      const eligibleSummitShortlist = [...shortlistBySummit.values()].sort((a, b) =>
        (Number(b.summitElevationASL) || 0) - (Number(a.summitElevationASL) || 0)
        || String(a.name).localeCompare(String(b.name), "en"));
      const skippedBySummit = new Map<string, Record<string, unknown>>();
      for (const canonical of canonicalSummitShortlist.filter(entry => !entry.routeAvailable)) {
        skippedBySummit.set(String(canonical.summitIdentityKey), {
          name: canonical.name,
          summitIdentityKey: canonical.summitIdentityKey,
          summitElevationASL: canonical.summitElevationASL ?? null,
          reasons: [canonical.skippedReason],
        });
      }
      for (const hill of candidateHills.filter(hill => !recommendedHills.some(selected =>
        selected.routeIdentityKey === hill.routeIdentityKey))) {
        const ranked = match.rankedCandidates.find(candidate =>
          candidate.routeIdentityKey === hill.routeIdentityKey);
        const key = hill.summitIdentityKey ?? hill.routeIdentityKey ?? hill.name;
        if (!skippedBySummit.has(key)) {
          skippedBySummit.set(key, {
            name: hill.name,
            summitIdentityKey: hill.summitIdentityKey ?? null,
            summitElevationASL: hill.summitElevationASL ?? null,
            reasons: ranked?.eligible
              ? ["Not selected after the requested distinct-summit cap."]
              : ranked?.rejectionReasons ?? ["No eligible route facts."],
          });
        }
      }
      const skippedHigherSummits = [...skippedBySummit.values()].sort((a, b) =>
        (Number(b.summitElevationASL) || 0) - (Number(a.summitElevationASL) || 0));
      const provenance = {
        expeditionStyle: input.expeditionStyle,
        targetMountainSource,
        targetRouteSource,
        routeDataStatus,
        selectedTargetRouteIdentityKey,
        selectedTargetRouteName,
        availableVerifiedRoutes,
        routeSelectionRequired,
        localCandidateSources,
        localCandidateRouteDataStatuses,
        selectedCandidateSources,
        selectedCandidateRouteDataStatuses,
        selectedCandidateProvenance: recommendedHills.map(hill => ({
          name: hill.name,
          routeName: hill.routeName ?? null,
          routeIdentityKey: hill.routeIdentityKey,
          dataSource: hill.dataSource ?? "unknown",
          routeDataStatus: hill.routeDataStatus ?? "unknown",
          summitElevationASL: hill.summitElevationASL ?? null,
          routeAscentM: hill.elevation,
          routeDistanceKm: hill.routeDistance ?? null,
          summitIdentityKey: hill.summitIdentityKey ?? null,
        })),
        eligibleSummitShortlist,
        skippedHigherSummits,
        excludedLongTrails: excludedLocalRoutes,
        principalSummitCount: match.selectedHills.length,
        requestedDays: effectiveProfile.estimatedDays,
        advisoryRatios: { ascent: match.targetRatio, distance: match.distanceRatio },
        localQueriedRows,
        localDiscovery: discoveryDiagnostics,
        matchMethod: match.matchMethod,
        usedAi,
        aiUsage: {
          targetProfile: usedAi,
          localCandidateDiscovery: false,
          routeSelection: false,
          narration: false,
        },
        metricSources,
        rankedCandidateScores: match.rankedCandidates,
        warnings,
      };

      if (process.env.NODE_ENV !== "production") {
        log?.info?.({
          timingsMs: timings,
          targetMountainSource,
          targetRouteSource,
          localCandidateSources,
          matchMethod: match.matchMethod,
          usedAi,
        }, "Virtual expedition provenance");
      }

      return res.json({
        targetProfile: effectiveProfile,
        expedition,
        recommendedHills,
        alternatives: expedition.alternatives,
        adventureScore: match.deterministicScore,
        dnaMatchScore: match.deterministicScore,
        simulationScore: physicalScore.overall,
        scoreBreakdown: physicalScore,
        provenance,
        _meta: {
          profileCached,
          areaCacheHit,
          usingAiExpedition: false,
          daysOverrideApplied: Boolean(input.daysOverride),
          expeditionStyle: input.expeditionStyle,
          hillsAvailable: candidateHills.length,
          timingsMs: process.env.NODE_ENV === "production" ? undefined : timings,
        },
      });
    } catch (error) {
      timings.total = Math.round(performance.now() - startedAt);
      log?.error?.({ err: error, timingsMs: timings }, "virtual-expedition failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: `Virtual expedition failed: ${message}` });
    }
  };
}