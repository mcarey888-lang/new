export type Coordinates = { lat: number; lng: number };

export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function directionsIdentity(input: {
  hillName: string;
  routeIdentityKey?: string;
  summitIdentityKey?: string;
  summitLat: number;
  summitLng: number;
}): string {
  // Never share a guessed parking destination between identically named hills.
  const location = `${input.summitLat.toFixed(3)}:${input.summitLng.toFixed(3)}`;
  return `destination:${input.routeIdentityKey?.trim() || input.summitIdentityKey?.trim() || input.hillName.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${location}`;
}

type Place = {
  osm_type?: string;
  osm_id?: number;
  type?: string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  extratags?: { access?: string };
};

function eligibleParking(place: Place, summit: Coordinates) {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  return place.type === "parking" && ["node", "way", "relation"].includes(place.osm_type ?? "") &&
    Number.isSafeInteger(place.osm_id) && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    place.extratags?.access !== "private" &&
    distanceMetres(summit, { lat, lng }) <= 15_000;
}

let nextLookupAt = 0;
let lookupQueue = Promise.resolve();
let queuedLookups = 0;

async function nominatim(url: URL): Promise<Place[]> {
  // The public Nominatim endpoint requires a distinct User-Agent and <=1 request/second.
  if (queuedLookups >= 10) throw new Error("Parking lookup is busy");
  queuedLookups++;
  const request = lookupQueue.then(async () => {
    const wait = Math.max(0, nextLookupAt - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    nextLookupAt = Date.now() + 1100;
    const response = await fetch(url, {
      headers: { "User-Agent": "SummitReady/1.0 (https://summitready.uk)", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`OpenStreetMap lookup unavailable (${response.status})`);
    return response.json() as Promise<Place[]>;
  });
  lookupQueue = request.then(() => {}, () => {});
  return request.finally(() => { queuedLookups--; });
}

export async function searchParking(_hillName: string, _location: string, summit: Coordinates) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  const lonSpan = 0.07 / Math.max(0.3, Math.cos(summit.lat * Math.PI / 180));
  url.search = new URLSearchParams({
    q: "parking", format: "jsonv2", limit: "50", bounded: "1", extratags: "1",
    viewbox: `${summit.lng - lonSpan},${Math.min(90, summit.lat + 0.055)},${summit.lng + lonSpan},${Math.max(-90, summit.lat - 0.055)}`,
  }).toString();
  const candidates = (await nominatim(url)).filter(place => eligibleParking(place, summit));
  candidates.sort((a, b) =>
    distanceMetres(summit, { lat: Number(a.lat), lng: Number(a.lon) }) -
    distanceMetres(summit, { lat: Number(b.lat), lng: Number(b.lon) }));
  const place = candidates[0];
  return place ? {
    placeId: `${place.osm_type![0].toUpperCase()}${place.osm_id}`,
    name: place.name || `Mapped parking near ${_hillName}`,
    address: place.display_name ?? "",
    lat: Number(place.lat),
    lng: Number(place.lon),
  } : null;
}

export async function fetchParkingPlace(placeId: string, summit: Coordinates, hillName: string) {
  if (!/^[NWR][1-9]\d{0,15}$/.test(placeId)) return null;
  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  url.search = new URLSearchParams({ osm_ids: placeId, format: "jsonv2", extratags: "1" }).toString();
  const place = (await nominatim(url))[0];
  return place && eligibleParking(place, summit) ? {
    placeId,
    name: place.name || `Mapped parking near ${hillName}`,
    lat: Number(place.lat),
    lng: Number(place.lon),
  } : null;
}

export function gpsConfirmsPlace(
  place: Coordinates,
  fix: Coordinates & { accuracy: number; timestamp: number },
  now = Date.now(),
): boolean {
  return Number.isFinite(fix.accuracy) && fix.accuracy > 0 && fix.accuracy <= 35 &&
    Number.isFinite(fix.timestamp) && fix.timestamp <= now + 5000 &&
    now - fix.timestamp <= 60_000 &&
    Number.isFinite(fix.lat) && Math.abs(fix.lat) <= 90 &&
    Number.isFinite(fix.lng) && Math.abs(fix.lng) <= 180 &&
    distanceMetres(place, fix) <= 80;
}