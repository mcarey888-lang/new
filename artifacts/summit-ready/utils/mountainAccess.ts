import type { MountainLookupResponse } from "./mountainDetailPresentation";
import { presentMountain } from "./mountainDetailPresentation";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
export interface MountainAccessPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  trust: "Community confirmed" | "Mapped";
  sourceName: string;
  sourceUrl: string;
  lastChecked?: string;
  canGetDirections: boolean;
  note: string;
}
export function presentMountainAccess(
  value: unknown, summit?: { latitude: number; longitude: number } | null,
): MountainAccessPoint | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if ((row.status !== "gps_confirmed" && row.status !== "internet_lookup") ||
      typeof row.name !== "string" || !row.name.trim() ||
      typeof row.lat !== "number" || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 ||
      typeof row.lng !== "number" || !Number.isFinite(row.lng) || Math.abs(row.lng) > 180) return null;
  // Even a malformed stored destination must never become directions to the summit.
  if (summit && Math.abs(summit.latitude - row.lat) < 0.000001 &&
      Math.abs(summit.longitude - row.lng) < 0.000001) return null;
  const confirmed = row.status === "gps_confirmed";
  const sourceUrl = typeof row.sourceUrl === "string" && /^https:\/\/www\.openstreetmap\.org\/(?:node|way|relation)\/\d+$/.test(row.sourceUrl)
    ? row.sourceUrl : "https://www.openstreetmap.org/copyright";
  return {
    id: typeof row.placeId === "string" ? row.placeId : `${row.lat},${row.lng}`,
    name: row.name.trim(), latitude: row.lat, longitude: row.lng,
    trust: confirmed ? "Community confirmed" : "Mapped",
    sourceName: "OpenStreetMap", sourceUrl,
    ...(typeof row.lastChecked === "string" && Number.isFinite(Date.parse(row.lastChecked))
      ? { lastChecked: row.lastChecked } : {}),
    canGetDirections: confirmed,
    note: confirmed
      ? "Arrival at this mapped parking feature was GPS-confirmed. This does not confirm legal parking, opening hours or the correct approach for your route; check local signs."
      : "Mapped parking candidate only. It has not been confirmed as suitable parking or the start of this mountain route. Check its source and local access.",
  };
}
export async function lookupMountainAccess(
  lookup: MountainLookupResponse, signal?: AbortSignal,
): Promise<MountainAccessPoint | null> {
  const mountain = presentMountain(lookup);
  if (!mountain.summitCoordinates || !lookup.canonicalIdentity?.id) {
    throw new Error("No verified mountain location is available for parking lookup. Search nearby parking in Maps instead.");
  }
  const response = await fetch(`${API_BASE}/directions/lookup`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({
      hillName: mountain.name, location: mountain.place ?? "",
      summitIdentityKey: mountain.id,
      summitLat: mountain.summitCoordinates.latitude,
      summitLng: mountain.summitCoordinates.longitude,
    }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Parking lookup is unavailable. Search in Maps and check access locally before travelling.");
  return presentMountainAccess(await response.json(), mountain.summitCoordinates);
}