/**
 * THE canonical route eligibility predicate.
 *
 * One place decides what a route may be used for. Every surface — the route
 * list, the expanded route, the action bar, the handoff into Track — asks this
 * module, so a route cannot be navigable on one screen and not another.
 *
 * It reads the Summit Data Engine's own verdict through
 * `mapExploreRoute()`. It does not re-derive trust, does not soften a reason,
 * and never promotes a compatibility record to canonical.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * VERIFIED route      inspect · 3D* · offline* · Add to Plan · Start Route
 * UNVERIFIED route    inspect · 3D* · Add to Plan
 *                     NEVER Start Route, offline download, or navigation.
 * (* only where the production capability genuinely exists — see
 *    `constants/capabilities.ts`.)
 *
 * ── THE GUARD IS NOT THE BUTTON ───────────────────────────────────────────
 * Hiding a control is presentation. `startRouteHandoff()` and
 * `offlineDownloadRequest()` return null for an ineligible route whatever the
 * caller believed, so a stale closure, a deep link or a programmatic call
 * cannot start navigation on an unverified line.
 */
import { CAPABILITIES } from "../constants/capabilities";
import {
  makeRouteVersion,
  parseSdeMountainId,
  parseSdeRouteId,
  type ExploreRoute,
  type RouteDataReason,
  type RouteVersion,
  type SdeMountainId,
} from "./routeIntelligence";

/** What the product says about a route's standing. */
export type RouteVerificationState =
  /** Canonical, engine-verified, SummitReady-verified, geometry complete. */
  | "verified"
  /** Canonical identity, but the engine has not finished verifying it. */
  | "candidate"
  /** No canonical identity at all — a compatibility or local record. */
  | "unidentified";

export interface RouteEligibility {
  state: RouteVerificationState;
  /** Read the route's facts, profile and description. Always allowed. */
  canInspect: boolean;
  /** Save this canonical route against the user's training goal. */
  canAddToPlan: boolean;
  /**
   * The single navigation gate. True only for a verified canonical route with
   * usable geometry. Start Route, offline packaging and any navigation
   * guidance all hang off this.
   */
  isNavigable: boolean;
  /** Only where a production 3D capability genuinely exists. */
  canView3D: boolean;
  /** Only where a production offline capability genuinely exists AND navigable. */
  canDownloadOffline: boolean;
  /** The engine's own reasons, unedited. */
  reasons: RouteDataReason[];
}

const DENIED: RouteEligibility = {
  state: "unidentified",
  canInspect: true,
  canAddToPlan: false,
  isNavigable: false,
  canView3D: false,
  canDownloadOffline: false,
  reasons: ["missing_identity"],
};

/**
 * Decide what this route may be used for.
 *
 * `trackAvailability === "can_track"` is the engine's own statement that the
 * record is canonical, fully available and carries complete geometry. That is
 * the navigation gate; nothing here widens it.
 */
export function routeEligibility(route: ExploreRoute | null | undefined): RouteEligibility {
  if (!route || !route.route || !route.mountain) {
    return { ...DENIED, reasons: route ? dedupe(collectReasons(route)) : ["missing_identity"] };
  }

  const reasons = dedupe(collectReasons(route));
  const trustVerified =
    route.trust?.engineStatus === "verified" &&
    route.trust?.productLifecycle === "summitready_verified";
  const navigable = route.trackAvailability === "can_track" &&
    authoritativeGeometryReady(route) &&
    trustVerified;

  return {
    state: navigable ? "verified" : "candidate",
    canInspect: true,
    /* A canonical identity is enough to plan against; navigation is not. */
    canAddToPlan: true,
    isNavigable: navigable,
    canView3D: CAPABILITIES.routeView3D,
    canDownloadOffline: navigable && CAPABILITIES.routeOfflineDownload,
    reasons,
  };
}

/** A route line is authoritative only with explicit proof and reusable SDE geometry. */
function authoritativeGeometryReady(route: ExploreRoute): boolean {
  const geometryResult = route.geometry;
  const geometry = geometryResult.availability === "available" ? geometryResult.value : null;
  const coordinates: unknown = geometry?.coordinates;
  const sourceMembers: unknown = geometry?.sourceMembers;
  if (!geometry || geometry.coordinateReferenceSystem !== "EPSG:4326" ||
      geometry.topologyStatus !== "complete" || !geometry.geometryVersion ||
      !Array.isArray(coordinates) || coordinates.length < 2 ||
      !Array.isArray(sourceMembers) || sourceMembers.length === 0 ||
      route.attribution?.rightsClassification !== "reusable_geometry") return false;
  if (!coordinates.every(coordinate =>
    Array.isArray(coordinate) && coordinate.length >= 2 &&
    typeof coordinate[0] === "number" && Number.isFinite(coordinate[0]) &&
    coordinate[0] >= -180 && coordinate[0] <= 180 &&
    typeof coordinate[1] === "number" && Number.isFinite(coordinate[1]) &&
    coordinate[1] >= -90 && coordinate[1] <= 90)) return false;
  return sourceMembers.every(source =>
    source && typeof source === "object" &&
    (source as { rightsClassification?: unknown }).rightsClassification === "reusable_geometry");
}

function collectReasons(route: ExploreRoute): RouteDataReason[] {
  return [
    ...(route.definition.availability === "available" ? [] : route.definition.reasons),
    ...(route.facts.availability === "available" ? [] : route.facts.reasons),
    ...(route.geometry.availability === "available" ? [] : route.geometry.reasons),
  ];
}

function dedupe(reasons: RouteDataReason[]): RouteDataReason[] {
  return [...new Set(reasons)];
}

/* ── Identity carried downstream ─────────────────────────────────────────── */

/**
 * The identity a selected route must keep: the mountain, the route and the
 * route's VERSION. A display name is never enough — two mountains share a
 * name, and a route changes between versions.
 */
export interface CanonicalRouteSelection {
  mountainId: SdeMountainId;
  routeId: string;
  routeIdentityKey: string;
  routeVersion: string;
  /** For display only. Never used to identify anything. */
  routeName: string;
  mountainName: string;
}

export function canonicalSelection(
  route: ExploreRoute | null | undefined,
  names: { routeName?: string | null; mountainName?: string | null },
): CanonicalRouteSelection | null {
  if (!route?.route || !route.mountain) return null;
  const version: RouteVersion = route.route;
  const mountainId = parseSdeMountainId(route.mountain);
  const parsedRoute = parseSdeRouteId(version.routeId);
  const expectedVersion = makeRouteVersion(route.mountain, version.identityKey, version.version);
  if (!mountainId || !parsedRoute || !expectedVersion ||
      version.mountainId !== mountainId ||
      parsedRoute.identityKey !== version.identityKey ||
      parsedRoute.version !== version.version ||
      version.routeId !== expectedVersion.routeId ||
      parsedRoute.routeId !== version.routeId) return null;
  return {
    mountainId: route.mountain,
    routeId: version.routeId,
    routeIdentityKey: version.identityKey,
    routeVersion: version.version,
    routeName: names.routeName?.trim() || version.identityKey,
    mountainName: names.mountainName?.trim() || route.mountain,
  };
}

/* ── Action-level guards ─────────────────────────────────────────────────── */

export interface StartRouteHandoff {
  mountainId: SdeMountainId;
  routeId: RouteVersion["routeId"];
  routeIdentityKey: string;
  routeVersion: string;
  routeName: string;
  mountainName: string;
}

/**
 * The parameters to hand a verified route into the existing Track journey, or
 * NULL when the route may not be navigated.
 *
 * This is the guard, not the button. A caller that ignores the rendered state
 * still gets null, so navigation cannot start on an unverified route.
 */
export function startRouteHandoff(
  route: ExploreRoute | null | undefined,
  names: { routeName?: string | null; mountainName?: string | null },
): StartRouteHandoff | null {
  const eligibility = routeEligibility(route);
  if (!eligibility.isNavigable) return null;
  const selection = canonicalSelection(route, names);
  if (!selection) return null;
  return { ...selection, routeId: selection.routeId as RouteVersion["routeId"] };
}

export interface OfflineDownloadRequest {
  mountainId: SdeMountainId;
  routeId: string;
  routeVersion: string;
}

/**
 * An offline packaging request, or NULL.
 *
 * Returns null when the route is not navigable AND when production has no
 * offline capability — an unverified route must never be packaged for
 * navigation, and a capability that does not exist must not be offered.
 */
export function offlineDownloadRequest(
  route: ExploreRoute | null | undefined,
): OfflineDownloadRequest | null {
  const eligibility = routeEligibility(route);
  if (!eligibility.isNavigable) return null;
  if (!CAPABILITIES.routeOfflineDownload) return null;
  const selection = canonicalSelection(route, {});
  if (!selection) return null;
  return {
    mountainId: selection.mountainId,
    routeId: selection.routeId,
    routeVersion: selection.routeVersion,
  };
}

/** Copy for the unverified state. One wording, used everywhere. */
export const VERIFICATION_NOTICE = {
  badge: "UNVERIFIED",
  title: "Route verification in progress",
  body:
    "We are still confirming this route's geometry against recorded tracks. SummitReady enables "
    + "navigation and offline download once a route is verified — until then you can explore the "
    + "detail and add it to your plan.",
  blockedAction: "Verification in progress",
} as const;
