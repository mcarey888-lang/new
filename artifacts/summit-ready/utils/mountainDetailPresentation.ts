/**
 * Mountain Detail — presentation.
 *
 * Shapes the production canonical mountain lookup into the approved Mountain
 * Detail composition: identity, overview facts, a canonical route list,
 * the selected route expanded in place, and Mountain DNA.
 *
 * ── TWO NUMBERS THAT ARE NOT THE SAME NUMBER ──────────────────────────────
 * SUMMIT ELEVATION is how high the mountain is (metres above sea level).
 * ROUTE ASCENT is how much you climb on a given line (metres gained).
 * They come from different fields, carry different labels and are never
 * derived from one another. A route's summit elevation agreeing with the
 * mountain's is a coincidence of geography, not an equivalence, so this
 * module keeps them apart everywhere and labels both explicitly.
 *
 * ── NOTHING IS INVENTED ───────────────────────────────────────────────────
 * Every fact carries a state. `missing` renders as "Not recorded"; it never
 * renders as a zero, a dash that reads like a value, or an estimate. There is
 * no default, no imputation and no rounding of an absent number into a
 * present one.
 *
 * ── IDENTITY ──────────────────────────────────────────────────────────────
 * A mountain is `sde:mountain:<uuid>`; a route is `sde:route:<key>@<version>`.
 * A display name identifies nothing here — two mountains share a name, and a
 * route's geometry changes between versions. A route whose lookup row lacks a
 * version is presented but carries NO identity, so nothing downstream can
 * plan or navigate against it.
 */
import {
  canonicalSelection, routeEligibility,
  type CanonicalRouteSelection, type RouteEligibility, type RouteVerificationState,
} from "./routeEligibility";
import type {
  ExploreRoute, MountainVerification, RouteElevationProfile, RouteFacts, SdeMountainId,
} from "./routeIntelligence";
import type {
  MountainDnaDimensionName, MountainDnaResult,
} from "./mountainDna";

/* ── The wire shape of POST /api/mountain-lookup ─────────────────────────── */

/** A route row the Summit Data Engine vouches for. Read-only. */
export interface TrustedRouteRow {
  identityKey: string;
  version?: string;
  mountainId?: string;
  routeId?: string;
  name: string;
  aliases?: string[];
  description?: string;
  startName?: string;
  startElevationM?: number;
  summitElevationM?: number;
  distanceKm?: number;
  totalAscentM?: number;
  totalDescentM?: number;
  typicalDurationHours?: number;
  evidence?: { publisher?: string; title?: string; url?: string };
}

/** The non-canonical row the lookup falls back to (cache or AI). No identity. */
export interface LegacyRouteRow {
  name: string;
  distance: number;
  elevationGain: number;
  highestAltitude: number;
  difficulty: string;
  description?: string;
  startingPoint?: string;
}

export interface MountainLookupResponse {
  mountainName: string;
  country?: string;
  region?: string;
  source?: "canonical" | "cache" | "ai";
  routeSource?: "canonical" | "unavailable";
  routes?: Array<TrustedRouteRow | LegacyRouteRow>;
  canonicalIdentity?: {
    id: string;
    canonicalName?: string;
    matchedBy?: string;
  };
  trustedFacts?: {
    verificationStatus?: string;
    area?: string;
    county?: string;
    elevationM?: number;
    prominenceM?: number;
    gridReference?: string;
    summitFeature?: string;
    provenanceVersion?: string;
  };
}

export function isTrustedRouteRow(
  row: TrustedRouteRow | LegacyRouteRow,
): row is TrustedRouteRow {
  return "identityKey" in row && typeof (row as TrustedRouteRow).identityKey === "string";
}

/* ── Facts ───────────────────────────────────────────────────────────────── */

/**
 * `verified` — the engine vouches for it.
 * `candidate` — held, but not yet verified; shown with an UNVERIFIED marker.
 * `missing`   — not held. Shown as "Not recorded". Never filled in.
 */
export type FactState = "verified" | "candidate" | "missing";

export interface PresentedFact {
  key: string;
  label: string;
  /** Null exactly when state is "missing". */
  value: string | null;
  state: FactState;
}

export const NOT_RECORDED = "Not recorded";

function fact(key: string, label: string, value: string | null, state: FactState = "verified"): PresentedFact {
  return value === null || value === "" ? { key, label, value: null, state: "missing" } : { key, label, value, state };
}

/* ── Formatting. Null in, null out — a caller never prints a fabricated 0. ── */

export function formatMetres(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString()} m`;
}

export function formatKilometres(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return `${Number(value.toFixed(1)).toLocaleString()} km`;
}

/** Metres on the wire, kilometres on the screen. */
export function formatDistanceM(metres: number | null | undefined): string | null {
  if (typeof metres !== "number" || !Number.isFinite(metres) || metres < 0) return null;
  return formatKilometres(metres / 1000);
}

/** Hours → "4h 30m" / "45 min". Rounds to whole minutes before carrying. */
export function formatHours(hours: number | null | undefined): string | null {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) return null;
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Seconds → the same shape. The engine's facts carry seconds. */
export function formatSeconds(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatHours(seconds / 3600);
}

/* ── The mountain ────────────────────────────────────────────────────────── */

export interface PresentedMountain {
  /** Canonical identity, or null when the lookup fell back to cache or AI. */
  id: SdeMountainId | null;
  name: string;
  /** "Lake District, England" — only the parts that are held. */
  place: string | null;
  /** The mountain's height above sea level. NOT any route's ascent. */
  summitElevation: PresentedFact;
  /** The three-up overview row. */
  overview: PresentedFact[];
  /** The Practical information list. */
  practical: PresentedFact[];
  verified: boolean;
  /** True when the lookup is not canonical — no identity, so no navigation. */
  fallback: boolean;
  provenanceVersion: string | null;
}

/**
 * The mountain header and its facts.
 *
 * A cache or AI lookup carries no canonical identity. That is surfaced, not
 * smoothed over: `id` is null, `verified` is false, and every action that
 * needs an identity stays closed downstream.
 */
export function presentMountain(lookup: MountainLookupResponse): PresentedMountain {
  const canonical = lookup.source === "canonical" && typeof lookup.canonicalIdentity?.id === "string";
  const id: SdeMountainId | null = canonical
    ? (`sde:mountain:${lookup.canonicalIdentity!.id}` as SdeMountainId)
    : null;
  const facts = lookup.trustedFacts;
  const place = [lookup.region, lookup.country].filter(part => !!part && part.trim()).join(", ") || null;

  /* The mountain's own elevation, which is an ALTITUDE. */
  const summit = fact("summit", "Summit", formatMetres(facts?.elevationM));

  return {
    id,
    name: lookup.mountainName,
    place,
    summitElevation: summit,
    overview: [
      summit,
      fact("place", "Location", place),
      fact("prominence", "Prominence", formatMetres(facts?.prominenceM)),
    ],
    practical: [
      fact("area", "Area", facts?.area ?? null),
      fact("county", "County", facts?.county ?? null),
      fact("grid", "Grid reference", facts?.gridReference ?? null),
      fact("summitFeature", "Summit feature", facts?.summitFeature ?? null),
      fact("country", "Country", lookup.country ?? null),
    ],
    verified: canonical && facts?.verificationStatus === "verified",
    fallback: !canonical,
    provenanceVersion: facts?.provenanceVersion ?? null,
  };
}

/* ── The route list ──────────────────────────────────────────────────────── */

export interface PresentedRoute {
  /** A stable list key. The canonical route id where there is one. */
  key: string;
  /** Canonical identity, or null when this row cannot be identified. */
  selection: CanonicalRouteSelection | null;
  name: string;
  aliases: string[];
  description: string | null;
  /** The first sentence of the description, for the collapsed card. */
  summary: string | null;
  /** Distance · ascent · time, in that order. Missing entries are dropped. */
  headline: PresentedFact[];
  /** The full fact list for the expanded state. */
  facts: PresentedFact[];
  /** How much you climb on this line. Never the mountain's height. */
  ascent: PresentedFact;
  /** Where this line starts, as an altitude. */
  startElevation: PresentedFact;
  /**
   * This ROUTE's recorded summit altitude. Kept beside, never merged with,
   * the mountain's — a disagreement is information, not an error to hide.
   */
  routeSummitElevation: PresentedFact;
  /**
   * Presentation-level standing, from the identity alone. Whether the route
   * may actually be NAVIGATED is decided by `routeEligibility` against the
   * engine's own read — see `presentSelectedRoute`.
   */
  verification: RouteVerificationState;
  attribution: string | null;
}

/** The first sentence, for the collapsed card. Never a hard character cut. */
export function firstSentence(text: string | null | undefined): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
}

function presentTrustedRoute(row: TrustedRouteRow, mountainId: SdeMountainId | null, mountainName: string): PresentedRoute {
  const identified = Boolean(mountainId && row.version && row.routeId);
  const selection: CanonicalRouteSelection | null = identified
    ? {
        mountainId: mountainId!,
        routeId: row.routeId!,
        routeIdentityKey: row.identityKey,
        routeVersion: row.version!,
        routeName: row.name,
        mountainName,
      }
    : null;

  const distance = fact("distance", "Distance", formatKilometres(row.distanceKm));
  const ascent = fact("ascent", "Total ascent", formatMetres(row.totalAscentM));
  const time = fact("time", "Typical time", formatHours(row.typicalDurationHours));
  const start = fact("startElevation", "Start altitude", formatMetres(row.startElevationM));
  const routeSummit = fact("routeSummit", "Summit altitude", formatMetres(row.summitElevationM));

  return {
    key: row.routeId ?? `${row.identityKey}@${row.version ?? "unversioned"}`,
    selection,
    name: row.name,
    aliases: row.aliases ?? [],
    description: row.description?.trim() || null,
    summary: firstSentence(row.description),
    headline: [distance, ascent, time].filter(f => f.state !== "missing"),
    facts: [
      fact("start", "Start point", row.startName ?? null),
      distance,
      ascent,
      fact("descent", "Total descent", formatMetres(row.totalDescentM)),
      start,
      routeSummit,
      time,
    ],
    ascent,
    startElevation: start,
    routeSummitElevation: routeSummit,
    verification: identified ? "candidate" : "unidentified",
    attribution: row.evidence?.publisher?.trim() || null,
  };
}

/**
 * A cache or AI route row.
 *
 * It has no identity, so it is presented for reading and nothing else. Its
 * numbers are shown as `candidate` — they are held, but nothing has verified
 * them — so the screen marks them rather than passing them off as engine data.
 */
function presentLegacyRoute(row: LegacyRouteRow, index: number): PresentedRoute {
  const distance = fact("distance", "Distance", formatKilometres(row.distance), "candidate");
  const ascent = fact("ascent", "Total ascent", formatMetres(row.elevationGain), "candidate");
  const routeSummit = fact("routeSummit", "Summit altitude", formatMetres(row.highestAltitude), "candidate");

  return {
    key: `unidentified:${index}:${row.name}`,
    selection: null,
    name: row.name,
    aliases: [],
    description: row.description?.trim() || null,
    summary: firstSentence(row.description),
    headline: [distance, ascent].filter(f => f.state !== "missing"),
    facts: [
      fact("start", "Start point", row.startingPoint ?? null, "candidate"),
      distance,
      ascent,
      routeSummit,
      fact("difficulty", "Difficulty", row.difficulty ?? null, "candidate"),
    ],
    ascent,
    startElevation: fact("startElevation", "Start altitude", null),
    routeSummitElevation: routeSummit,
    verification: "unidentified",
    attribution: null,
  };
}

export function presentRoutes(
  lookup: MountainLookupResponse,
  mountain: PresentedMountain,
): PresentedRoute[] {
  const rows = lookup.routes ?? [];
  return rows.map((row, index) =>
    isTrustedRouteRow(row)
      ? presentTrustedRoute(row, mountain.id, mountain.name)
      : presentLegacyRoute(row, index));
}

/* ── The selected route, expanded in place ───────────────────────────────── */

export interface PresentedSelectedRoute {
  route: PresentedRoute;
  /** THE navigation decision. Nothing else may make it. */
  eligibility: RouteEligibility;
  /** The engine's facts where it has them, merged under the lookup's. */
  facts: PresentedFact[];
  /** Distance · ascent · time for the three-up row. */
  headline: PresentedFact[];
  /** Altitude samples along the route, or null when the engine holds none. */
  profile: ElevationProfilePoint[] | null;
  /** The high point of the drawn profile. An altitude, never an ascent. */
  profileHighPointM: number | null;
}

export interface ElevationProfilePoint {
  distanceM: number;
  elevationM: number;
}

/**
 * Merge the engine's read of a route into its lookup presentation and decide
 * what may be done with it.
 *
 * `exploreRoute` is `mapExploreRoute()`'s output for THIS route — the engine's
 * own verdict. Passing null (the record has not loaded, or does not exist)
 * yields a route that can be read and planned but never navigated.
 */
export function presentSelectedRoute(
  route: PresentedRoute,
  exploreRoute: ExploreRoute | null,
  elevationProfile?: Pick<RouteElevationProfile, "samples"> | null,
): PresentedSelectedRoute {
  const eligibility = routeEligibility(exploreRoute);
  const engineFacts = exploreRoute?.facts.availability === "available" ||
    exploreRoute?.facts.availability === "degraded"
    ? exploreRoute.facts.value
    : null;

  const merged = mergeEngineFacts(route, engineFacts);
  const profile = profileFrom(elevationProfile);

  return {
    route: {
      ...route,
      /* The identity the engine confirmed wins over the lookup's, when it has
         one — they agree in practice, and if they ever do not, the engine is
         the one that decides what may be navigated. */
      selection: canonicalSelection(exploreRoute, {
        routeName: route.name,
        mountainName: route.selection?.mountainName,
      }) ?? route.selection,
      verification: eligibility.state === "unidentified" && route.selection
        ? "candidate"
        : eligibility.state,
    },
    eligibility,
    facts: merged.facts,
    headline: merged.headline,
    profile,
    profileHighPointM: profile && profile.length > 0
      ? Math.max(...profile.map(p => p.elevationM))
      : null,
  };
}

/**
 * The engine's figure replaces the lookup's for the same fact; a fact the
 * engine does not hold keeps whatever the lookup had, including "missing".
 * Nothing is averaged, and nothing absent becomes present.
 */
function mergeEngineFacts(
  route: PresentedRoute,
  engine: RouteFacts | null,
): { facts: PresentedFact[]; headline: PresentedFact[] } {
  if (!engine) return { facts: route.facts, headline: route.headline };

  const overrides = new Map<string, PresentedFact>();
  const put = (key: string, label: string, value: string | null) => {
    if (value !== null) overrides.set(key, fact(key, label, value));
  };
  put("distance", "Distance", formatDistanceM(engine.distanceM));
  put("ascent", "Total ascent", formatMetres(engine.ascentM));
  put("descent", "Total descent", formatMetres(engine.descentM));
  put("startElevation", "Start altitude", formatMetres(engine.startElevationM));
  put("routeSummit", "Summit altitude", formatMetres(engine.summitElevationM));
  put("time", "Typical time", formatSeconds(engine.typicalDurationS));
  put("terrain", "Terrain", engine.terrain?.value ?? null);
  put("technical", "Technical character", engine.technicalCharacter?.value ?? null);
  const gradient = engine.gradient?.meanPercent;
  if (typeof gradient === "number" && Number.isFinite(gradient)) {
    overrides.set("gradient", fact("gradient", "Mean gradient", `${Math.round(gradient * 10) / 10}%`));
  }

  const facts = route.facts.map(f => overrides.get(f.key) ?? f);
  const seen = new Set(facts.map(f => f.key));
  for (const [key, value] of overrides) if (!seen.has(key)) facts.push(value);

  const pick = (key: string) => facts.find(f => f.key === key);
  const headline = [pick("distance"), pick("ascent"), pick("time")]
    .filter((f): f is PresentedFact => !!f && f.state !== "missing");

  return { facts, headline };
}

/**
 * The elevation profile the engine holds, as altitude against distance.
 *
 * Samples with no elevation are DROPPED rather than interpolated — a gap in a
 * DEM is a gap, and drawing through it would invent terrain. Fewer than two
 * real samples is not a profile, so the screen shows nothing rather than a
 * line implying a shape.
 */
export function profileFrom(
  profile: Pick<RouteElevationProfile, "samples"> | null | undefined,
): ElevationProfilePoint[] | null {
  const samples = profile?.samples;
  if (!Array.isArray(samples)) return null;
  const points = samples
    .filter((s): s is { distanceM: number; elevationM: number } =>
      typeof s?.distanceM === "number" && Number.isFinite(s.distanceM) &&
      typeof s?.elevationM === "number" && Number.isFinite(s.elevationM))
    .map(s => ({ distanceM: s.distanceM, elevationM: s.elevationM }));
  return points.length >= 2 ? points : null;
}

/* ── Mountain DNA ────────────────────────────────────────────────────────── */

/**
 * Production's Mountain DNA is a COMPARISON, not a profile.
 *
 * The prototype draws Mountain DNA as an absolute character reading of a route
 * — steepness, exposure, technicality on their own scale. The production
 * engine (`utils/mountainDna.ts`) does something different and more useful: it
 * scores how like your TARGET route a candidate is, dimension by dimension.
 *
 * No absolute character scores exist in production, and inventing them would
 * be fabricating a safety-adjacent reading of real terrain. So the panel keeps
 * the approved presentation and carries the engine's real meaning: each bar is
 * this route measured against your goal. Without a target route it has nothing
 * to compare, and says so.
 */
export type DnaPresentationState = "ready" | "degraded" | "unavailable";

export interface PresentedDnaDimension {
  name: MountainDnaDimensionName;
  label: string;
  /** 0–100, or null when the engine could not score this dimension. */
  score: number | null;
  /** "Not comparable" when null — never a zero bar, which reads as "no match". */
  valueLabel: string;
  status: "scored" | "unknown" | "excluded";
  explanation: string;
}

export interface PresentedDna {
  state: DnaPresentationState;
  overallScore: number | null;
  confidence: MountainDnaResult["confidence"];
  dimensions: PresentedDnaDimension[];
  /** Why there is nothing to show. Null when there is. */
  unavailableReason: string | null;
  modelVersion: string | null;
}

const DNA_LABELS: Record<MountainDnaDimensionName, string> = {
  ascent: "Ascent",
  distance: "Distance",
  steepness: "Steepness",
  terrain: "Terrain",
  technical: "Technical character",
  altitude: "Altitude",
  exposure: "Exposure",
  profileShape: "Profile shape",
};

export const DNA_NO_TARGET =
  "Mountain DNA compares a route with your summit goal. Set a goal with a verified route and this fills in.";

/**
 * Shape an engine result for the panel, or the designed unavailable state.
 *
 * A dimension the engine left unscored stays unscored here. It is listed with
 * its reason rather than dropped, because "we could not compare this" is worth
 * knowing and a quietly shorter list is not.
 */
export function presentMountainDna(result: MountainDnaResult | null): PresentedDna {
  if (!result) {
    return {
      state: "unavailable",
      overallScore: null,
      confidence: "unavailable",
      dimensions: [],
      unavailableReason: DNA_NO_TARGET,
      modelVersion: null,
    };
  }

  const dimensions = result.dimensions
    /* Weightless dimensions are not part of this model's verdict. */
    .filter(d => d.weight > 0 || d.status === "scored")
    .map(d => ({
      name: d.name,
      label: DNA_LABELS[d.name] ?? d.name,
      score: d.status === "scored" ? d.score : null,
      valueLabel: d.status === "scored" && typeof d.score === "number"
        ? `${Math.round(d.score)}`
        : "Not comparable",
      status: d.status,
      explanation: d.explanation,
    }));

  return {
    state: result.state,
    overallScore: result.overallScore,
    confidence: result.confidence,
    dimensions,
    unavailableReason: result.state === "unavailable"
      ? (result.explanations[0] ?? DNA_NO_TARGET)
      : null,
    modelVersion: result.modelVersion,
  };
}

/* ── Sorting the route list ──────────────────────────────────────────────── */

export type RouteSort = "Ascent" | "Distance" | "Name";
export const ROUTE_SORTS: RouteSort[] = ["Ascent", "Distance", "Name"];

/**
 * Sort by a real recorded number, putting routes without that number last —
 * an absent figure must not sort as a zero and lead the list.
 */
export function sortRoutes(routes: readonly PresentedRoute[], sort: RouteSort): PresentedRoute[] {
  const copy = [...routes];
  if (sort === "Name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  const key = sort === "Ascent" ? "ascent" : "distance";
  const numberOf = (route: PresentedRoute) => {
    const f = route.facts.find(x => x.key === key);
    if (!f || f.state === "missing" || !f.value) return null;
    const parsed = Number(f.value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return copy.sort((a, b) => {
    const left = numberOf(a);
    const right = numberOf(b);
    if (left === null && right === null) return a.name.localeCompare(b.name);
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left || a.name.localeCompare(b.name);
  });
}

/* ── Copy used in more than one place ────────────────────────────────────── */

export const ELEVATION_FOOTNOTE =
  "Summit elevation is the height of the mountain. Each route lists its own ascent — the height you actually climb.";

export const PRACTICAL_FOOTNOTE =
  "SummitReady shows what has been verified for this mountain. Fields we do not hold are marked, never filled in.";

export const FALLBACK_NOTICE = {
  title: "Not in the verified catalogue yet",
  body:
    "This mountain has not been matched to SummitReady's verified catalogue, so its routes carry no canonical "
    + "identity. You can read what we hold, but planning and navigation stay closed until it is verified.",
} as const;

export const NO_ROUTES_NOTICE = {
  title: "No verified routes yet",
  body: "SummitReady has verified this mountain but holds no routes for it yet.",
} as const;

export function routePickerHint(mountainName: string): string {
  return `Pick a route to see its profile, terrain and options — you stay on ${mountainName} throughout.`;
}

export type { RouteEligibility, CanonicalRouteSelection, MountainVerification };
