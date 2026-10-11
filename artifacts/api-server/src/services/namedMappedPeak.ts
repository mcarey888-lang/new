/** Name lookup must resolve an actual mapped peak, never a street or suburb. */
export interface NamedMappedPeak {
  id: number;
  lat: number;
  lng: number;
  name: string;
  ele: number | null;
  source: "osm_nominatim";
}

export function parseNamedMappedPeaks(
  rows: unknown,
  center: { lat: number; lng: number },
  radiusKm: number,
): NamedMappedPeak[] {
  if (!Array.isArray(rows)) throw new Error("Invalid mapped peak response");
  return rows.flatMap(row => {
    if (row?.osm_type !== "node" || (row.category ?? row.class) !== "natural" || row.type !== "peak") return [];
    const lat = Number(row.lat), lng = Number(row.lon), id = Number(row.osm_id);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 ||
      !Number.isSafeInteger(id) || id <= 0 || typeof row.name !== "string" || !row.name.trim()) return [];
    const rad = Math.PI / 180;
    const a = Math.sin((lat - center.lat) * rad / 2) ** 2 +
      Math.cos(center.lat * rad) * Math.cos(lat * rad) * Math.sin((lng - center.lng) * rad / 2) ** 2;
    const distance = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    if (distance > radiusKm) return [];
    const elevation = Number.parseFloat(row.extratags?.ele ?? "");
    return [{
      id, lat, lng, name: row.name,
      ele: Number.isFinite(elevation) && elevation > 0 ? elevation : null,
      source: "osm_nominatim" as const,
    }];
  });
}

const cache = new Map<string, { expires: number; peaks: NamedMappedPeak[] }>();
let queue: Promise<void> = Promise.resolve();
let nextAllowedAt = 0;

export async function lookupNamedMappedPeaks(
  name: string, center: { lat: number; lng: number }, radiusKm: number, userAgent: string,
): Promise<NamedMappedPeak[]> {
  const key = JSON.stringify([name.toLowerCase(), center.lat, center.lng, radiusKm]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.peaks;
  // Bound this public geocoder to one named-peak request per second.
  let release!: () => void;
  const previous = queue;
  queue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const delay = Math.max(0, nextAllowedAt - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    nextAllowedAt = Date.now() + 1100;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: name, format: "jsonv2", extratags: "1", limit: "10",
      countrycodes: "gb",
    }).toString();
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Mapped peak lookup returned HTTP ${response.status}`);
    const peaks = parseNamedMappedPeaks(await response.json(), center, radiusKm);
    if (peaks.length) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 10 * 60_000, peaks });
    }
    return peaks;
  } finally {
    release();
  }
}
