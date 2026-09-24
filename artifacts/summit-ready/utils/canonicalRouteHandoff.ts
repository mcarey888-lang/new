import AsyncStorage from "@react-native-async-storage/async-storage";
import { canonicalRouteHandoffMatches } from "./hikeReliability";
import type { RouteGeometry, SdeMountainId, SdeRouteId } from "./routeIntelligence";

const HANDOFF_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CanonicalRouteHandoff {
  ownerUserId: string;
  handoffId: string;
  mountainId: SdeMountainId;
  routeId: SdeRouteId;
  routeIdentityKey: string;
  routeVersion: string;
  routeName: string;
  mountainName: string;
  geometry: RouteGeometry;
  savedAt: number;
}

export type CanonicalRouteHandoffIdentity = Pick<
  CanonicalRouteHandoff,
  "ownerUserId" | "handoffId" | "mountainId" | "routeId" | "routeIdentityKey" | "routeVersion"
>;

function handoffKey(userId: string, handoffId: string): string {
  return `summitready_canonical_route_handoff_v1_${userId}_${handoffId}`;
}

export function isReusableCanonicalGeometry(value: unknown): value is RouteGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as Partial<RouteGeometry>;
  if (
    geometry.coordinateReferenceSystem !== "EPSG:4326" ||
    geometry.topologyStatus !== "complete" ||
    typeof geometry.geometryVersion !== "string" || !geometry.geometryVersion.trim() ||
    typeof geometry.derivationMethod !== "string" || !geometry.derivationMethod.trim() ||
    !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2 ||
    !Array.isArray(geometry.sourceMembers) || geometry.sourceMembers.length === 0
  ) return false;
  const validCoordinates = geometry.coordinates.every(coordinate =>
    Array.isArray(coordinate) && coordinate.length >= 2 &&
    typeof coordinate[0] === "number" && Number.isFinite(coordinate[0]) &&
    coordinate[0] >= -180 && coordinate[0] <= 180 &&
    typeof coordinate[1] === "number" && Number.isFinite(coordinate[1]) &&
    coordinate[1] >= -90 && coordinate[1] <= 90);
  const reusableSources = geometry.sourceMembers.every(source =>
    source && typeof source === "object" &&
    (source as { rightsClassification?: unknown }).rightsClassification === "reusable_geometry");
  return validCoordinates && reusableSources;
}

export function isCanonicalRouteHandoffFresh(savedAt: unknown, now = Date.now()): boolean {
  return typeof savedAt === "number" && Number.isFinite(savedAt) &&
    savedAt <= now && now - savedAt <= HANDOFF_MAX_AGE_MS;
}

function validHandoff(handoff: CanonicalRouteHandoff, now = Date.now()): boolean {
  return !!handoff.ownerUserId && !!handoff.handoffId &&
    isCanonicalRouteHandoffFresh(handoff.savedAt, now) &&
    canonicalRouteHandoffMatches(handoff, handoff) &&
    isReusableCanonicalGeometry(handoff.geometry);
}

export async function saveCanonicalRouteHandoff(
  handoff: CanonicalRouteHandoff,
): Promise<void> {
  if (!validHandoff(handoff)) throw new Error("Canonical route identity or reusable geometry is invalid or stale.");
  await AsyncStorage.setItem(
    handoffKey(handoff.ownerUserId, handoff.handoffId),
    JSON.stringify(handoff),
  );
}

/** Reads geometry only when the owner and every canonical identity field match. */
export async function readCanonicalRouteHandoff(
  identity: CanonicalRouteHandoffIdentity,
): Promise<CanonicalRouteHandoff | null> {
  if (!identity.ownerUserId || !identity.handoffId) return null;
  const raw = await AsyncStorage.getItem(handoffKey(identity.ownerUserId, identity.handoffId));
  if (!raw) return null;
  try {
    const handoff = JSON.parse(raw) as CanonicalRouteHandoff;
    if (!validHandoff(handoff) || !canonicalRouteHandoffMatches(handoff, identity)) return null;
    return handoff;
  } catch {
    return null;
  }
}

export async function clearCanonicalRouteHandoff(
  identity: Pick<CanonicalRouteHandoff, "ownerUserId" | "handoffId">,
): Promise<void> {
  if (identity.ownerUserId && identity.handoffId) {
    await AsyncStorage.removeItem(handoffKey(identity.ownerUserId, identity.handoffId));
  }
}