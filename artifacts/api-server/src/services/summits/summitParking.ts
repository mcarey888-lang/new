import { distanceMetres, type ParkingCandidate } from "../directionsLookup.js";

/**
 * What the map may say about a car park.
 *
 * The honest distinction this module exists to protect: one of these has been
 * stood in by somebody with a working GPS, and the rest were found by
 * searching a map. Drawn the same, a guess sends people down a farm track at
 * seven in the morning. So the status travels with every car park, and the
 * only way to earn "gps_confirmed" is to match the confirmed record.
 */
export type ParkingStatus = "gps_confirmed" | "internet_lookup";

export interface ParkingPin {
  placeId: string;
  /** Null when it has no name. The map labels those by distance, which at
   *  least tells them apart; a placeholder repeated six times does not. */
  name: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  status: ParkingStatus;
}

/** How many car parks are worth drawing around one hill. */
export const MAX_PARKING = 6;

/** Beyond this, a car park is not "parking for this hill" in any useful sense. */
export const MAX_PARKING_DISTANCE_M = 15_000;

export interface ParkingTarget {
  name: string;
  lat: number;
  lng: number;
}

/**
 * Read a parking request off the query string.
 *
 * Returns null rather than throwing, and rather than defaulting: a missing
 * latitude silently read as 0 would look up car parks in the Gulf of Guinea.
 */
export function parseParkingQuery(query: unknown): ParkingTarget | null {
  if (!query || typeof query !== "object") return null;
  const q = query as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const num = (v: unknown): number => {
    const s = str(v);
    if (!s) return NaN;
    /* Number("") is 0 and Number(" ") is 0. Both would pass a finite check. */
    return Number(s);
  };

  const lat = num(q["lat"]);
  const lng = num(q["lng"]);
  const name = str(q["name"]);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  /* The hill's name is what identifies a confirmed car park, and it is what
     an unnamed place gets labelled with. Without it there is nothing to say. */
  if (name.length < 2 || name.length > 160) return null;

  return { name, lat, lng };
}

/** A confirmed destination as the directions flow stored it. */
export interface VerifiedRecord {
  placeId: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Mark the confirmed car park, and make sure it is in the list.
 *
 * A record confirmed by GPS may be older than the current Nominatim answer,
 * or sit just outside the search box. Dropping it because the search did not
 * return it would throw away the only car park here anybody has verified.
 */
export function markConfirmed(
  candidates: ParkingCandidate[],
  verified: VerifiedRecord | null,
  target: ParkingTarget,
  limit = MAX_PARKING,
): ParkingPin[] {
  const confirmedId = verified?.placeId?.trim() || null;

  const pins: ParkingPin[] = candidates
    .filter(c => c.distanceM <= MAX_PARKING_DISTANCE_M)
    .map(c => ({
      placeId: c.placeId,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      distanceM: c.distanceM,
      status: (confirmedId && c.placeId === confirmedId ? "gps_confirmed" : "internet_lookup") as ParkingStatus,
    }));

  const alreadyThere = confirmedId ? pins.some(p => p.placeId === confirmedId) : true;
  if (!alreadyThere && verified
      && typeof verified.lat === "number" && Number.isFinite(verified.lat)
      && typeof verified.lng === "number" && Number.isFinite(verified.lng)) {
    pins.push({
      placeId: confirmedId!,
      name: verified.label?.trim() || `Parking for ${target.name}`,
      lat: verified.lat,
      lng: verified.lng,
      distanceM: Math.round(distanceMetres(target, { lat: verified.lat, lng: verified.lng })),
      status: "gps_confirmed",
    });
  }

  /* Confirmed first, then nearest. Somebody scanning the list should meet the
     one that is known to work before the ones that were guessed. */
  pins.sort((a, b) => {
    if (a.status !== b.status) return a.status === "gps_confirmed" ? -1 : 1;
    return a.distanceM - b.distanceM;
  });
  return pins.slice(0, limit);
}
