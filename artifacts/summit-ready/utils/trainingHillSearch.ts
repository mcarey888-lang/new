import type { NearbyHill } from "../context/AppContext";
import { normalizeUkPostcode } from "./explorePostcode";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";
export const NEARBY_HILL_RADIUS_KM = 25;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expires: number; hills: NearbyHill[] }>();
const pending = new Map<string, Promise<NearbyHill[]>>();

function abortError() {
  const error = new Error("Search cancelled");
  error.name = "AbortError";
  return error;
}

// A closing screen must not cancel a request another screen is using.
function forCaller(request: Promise<NearbyHill[]>, signal?: AbortSignal): Promise<NearbyHill[]> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export function searchTrainingHills(
  kind: "area" | "name",
  query: string,
  location = "",
  signal?: AbortSignal,
  radiusKm = NEARBY_HILL_RADIUS_KM,
): Promise<NearbyHill[]> {
  if (signal?.aborted) return Promise.reject(abortError());
  const term = normalizeUkPostcode(query) ?? query.trim();
  const area = normalizeUkPostcode(location) ?? location.trim();
  const body = kind === "area"
    ? { location: term, radius: radiusKm }
    : { hillName: term, location: area };
  const key = JSON.stringify(body).toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return forCaller(Promise.resolve(cached.hills), signal);
  cache.delete(key);
  let request = pending.get(key);
  if (!request) {
    request = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(`${API_BASE}/hills-unified`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 429
          ? "Search is busy. Wait a moment and try again."
          : response.status >= 500
            ? "Hill map data is temporarily unavailable. Please retry."
            : kind === "area"
              ? "Couldn't search that area. Try a town, postcode or region."
              : "Couldn't find that hill — try a different name.");
        const data = await response.json() as { hills?: NearbyHill[]; hill?: NearbyHill };
        const hills = kind === "area" ? data.hills : data.hill ? [data.hill] : [];
        if (!Array.isArray(hills)) throw new Error("Nearby hills are unavailable right now.");
        const usable = hills.filter(hill => Number.isFinite(hill.elevation) && hill.elevation > 0);
        // Never retain outages or empty results; retry must be able to recover.
        if (usable.length) {
          if (cache.size >= 30) cache.delete(cache.keys().next().value!);
          cache.set(key, { hills: usable, expires: Date.now() + CACHE_TTL_MS });
        }
        return usable;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          throw new Error("Hill search timed out. Please retry.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        pending.delete(key);
      }
    })();
    pending.set(key, request);
  }
  return forCaller(request, signal);
}
