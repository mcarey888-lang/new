import { createHash } from "node:crypto";
import type { SnapResponse } from "../../routes/path-snap";
import type { LatLng } from "./pathSnapping";

export interface HostedRoutingStore {
  get(key: string): Promise<unknown>;
  put(key: string, result: SnapResponse): Promise<void>;
  reserve(): Promise<boolean>;
}

type Point = { lat: number; lng: number };
const TIMEOUT_MS = 8000;
const MAX_PENDING = 8;
const PROFILE = "foot-hiking";
const ATTRIBUTION = "© openrouteservice by HeiGIT | Data from OpenStreetMap · CC BY-SA 4.0";
export const routingAttribution = ATTRIBUTION;

function distance(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function point(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [lng, lat] = value;
  return typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Never log provider bodies/URLs/headers: Authorization holds the API key.
 * All failures stay unconfirmed. In particular, a timeout is not off-path,
 * and no fallback substitutes an invented straight line or different profile. */
export function createHikingRouter(options: {
  key: string;
  store: HostedRoutingStore;
  fetcher?: typeof fetch;
  onStorageError?: () => void;
}) {
  const inflight = new Map<string, Promise<SnapResponse>>();
  let blockedUntil = 0;
  let active = 0;
  const unavailable = (detail: string, status: number | null = null): SnapResponse =>
    ({ outcome: "unavailable", detail, status });

  function validateReply(body: any, from: Point | null, to: Point, radius: number): SnapResponse {
    if (!from) {
      const location = body?.locations?.[0];
      if (Array.isArray(body?.locations) && body.locations.length === 1 && location === null) {
        return { outcome: "off_path", which: "to" };
      }
      const snapped = point(location?.location);
      if (!snapped || distance(snapped, to) > radius + 2) {
        return unavailable("Path service returned an invalid snap");
      }
      return { outcome: "snapped", point: snapped, distanceM: Math.round(distance(snapped, to)),
        wayName: typeof location.name === "string" ? location.name.slice(0, 200) : null };
    }
    const feature = body?.type === "FeatureCollection" && body.features?.length === 1
      ? body.features[0] : null;
    const coordinates = feature?.geometry?.type === "LineString" ? feature.geometry.coordinates : null;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 10000) {
      return unavailable("Path service returned invalid geometry");
    }
    const points = coordinates.map(point);
    if (points.some(p => p === null)) return unavailable("Path service returned invalid coordinates");
    const valid = points as Point[];
    // Never snap a tap across a valley just because the provider found a road.
    if (distance(valid[0], from) > radius + 2 || distance(valid[valid.length - 1], to) > radius + 2) {
      return unavailable("Path service moved an endpoint too far");
    }
    const length = feature.properties?.summary?.distance;
    const measured = valid.slice(1).reduce((sum, p, i) => sum + distance(valid[i], p), 0);
    if (typeof length !== "number" || !Number.isFinite(length) || length <= 0 ||
      length > 100000 || Math.abs(length - measured) > Math.max(30, measured * 0.05)) {
      return unavailable("Path service returned inconsistent distance");
    }
    const direct = distance(from, to);
    return { outcome: "routed", points: valid, lengthM: Math.round(length),
      directM: Math.round(direct), detourFactor: Math.round(length / Math.max(1, direct) * 100) / 100,
      wayName: null };
  }

  return {
    async snap(fromInput: LatLng | null, toInput: LatLng, radius: number): Promise<SnapResponse> {
      const from = fromInput ? { lat: fromInput.latitude, lng: fromInput.longitude } : null;
      const to = { lat: toInput.latitude, lng: toInput.longitude };
      // Hash exact request coordinates (not names, IDs or user details).
      // Do not round cache keys: nearby taps can select different paths.
      const key = createHash("sha256").update(JSON.stringify(["ors-hike-v1", from, to, radius])).digest("hex");
      const pending = inflight.get(key);
      if (pending) return pending;
      if (active >= MAX_PENDING) return unavailable("Routing is busy; retry shortly", 429);

      const work = (async (): Promise<SnapResponse> => {
        active++;
        try {
          let cached: any;
          try {
            cached = await options.store.get(key);
          } catch {
            options.onStorageError?.();
            return unavailable("Routing cache is temporarily unavailable");
          }
          // Validate persisted geometry too; expiry is enforced by the store.
          if (cached?.outcome === "routed" && from) {
            const checked = validateReply({ type: "FeatureCollection", features: [{
              geometry: { type: "LineString", coordinates: Array.isArray(cached.points)
                ? cached.points.map((p: Point | null) => [p?.lng, p?.lat]) : null },
              properties: { summary: { distance: cached.lengthM } },
            }] }, from, to, radius);
            if (checked.outcome === "routed") return checked;
          } else if (cached?.outcome === "snapped" && !from) {
            const p = cached.point;
            const checked = validateReply({ locations: [{ location: [p?.lng, p?.lat], name: cached.wayName }] }, null, to, radius);
            if (checked.outcome === "snapped") return checked;
          }
          if (Date.now() < blockedUntil) return unavailable("Routing service limit reached; retry later", 429);
          try {
            if (!await options.store.reserve()) return unavailable("Routing allowance reached; retry later", 429);
          } catch {
            options.onStorageError?.();
            return unavailable("Routing allowance could not be checked");
          }

          const controller = new AbortController();
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const response = await Promise.race([
              (async () => {
                const url = from ? `https://api.openrouteservice.org/v2/directions/${PROFILE}/geojson`
                  : `https://api.openrouteservice.org/v2/snap/${PROFILE}`;
                const result = await (options.fetcher ?? fetch)(url, {
                  method: "POST",
                  headers: { Authorization: options.key, "Content-Type": "application/json" },
                  body: JSON.stringify(from
                    ? { coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
                        radiuses: [radius, radius], instructions: false, elevation: false }
                    : { locations: [[to.lng, to.lat]], radius }),
                  signal: controller.signal,
                });
                const body: any = await result.json().catch(() => null);
                return { status: result.status, ok: result.ok, body,
                  retryAfter: result.headers.get("retry-after") };
              })(),
              new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, TIMEOUT_MS);
              }),
            ]);
            if (!response.ok) {
              if (response.status === 429) {
                const retry = Number(response.retryAfter);
                blockedUntil = Date.now() + (Number.isFinite(retry) && retry > 0
                  ? Math.min(retry, 86400) * 1000 : 60000);
                return unavailable("Routing service limit reached; retry later", 429);
              }
              // A valid ORS no-network answer is distinct from a provider outage.
              if (response.body?.error?.code === 2010) {
                const message = String(response.body.error.message ?? "");
                return { outcome: "off_path", which: message.includes("coordinate 0") ? "from" :
                  message.includes("coordinate 1") ? "to" : "both" };
              }
              if (response.body?.error?.code === 2009 && from) {
                // No invented gap coordinates or fabricated gap length.
                return unavailable("No connected hiking route was returned");
              }
              return unavailable(response.status === 401 || response.status === 403
                ? "Hiking routing account is not authorised" : "Hiking routing service is unavailable", response.status);
            }
            const result = validateReply(response.body, from, to, radius);
            if (result.outcome === "routed" || result.outcome === "snapped") {
              try { await options.store.put(key, result); }
              catch { options.onStorageError?.(); /* The verified live result remains usable. */ }
            }
            return result;
          } catch {
            return unavailable("Hiking path lookup timed out or could not connect");
          } finally {
            if (timer) clearTimeout(timer);
          }
        } finally {
          active--;
        }
      })();
      inflight.set(key, work);
      try { return await work; }
      finally { inflight.delete(key); }
    },
  };
}
