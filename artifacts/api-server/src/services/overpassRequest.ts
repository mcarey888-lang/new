import { logger } from "../lib/logger";

// Full-planet providers only. Regional mirrors cannot distinguish unmapped
// terrain from requests outside their coverage.
export const OVERPASS_ENDPOINTS: readonly string[] = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
const TIMEOUT_MS = 8_000;
const COOLDOWN_MS = 30_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 64;
const cache = new Map<string, { at: number; value: OverpassResult }>();
const pending = new Map<string, Promise<OverpassResult>>();
const unavailableUntil = new Map<string, number>();
let preferred: string | undefined;

interface OverpassResult {
  elements: unknown[];
}
class InvalidQueryError extends Error {}

/** Test/reset hook; successful empty areas are cacheable, outages are not. */
export function clearOverpassRequestState(): void {
  cache.clear();
  pending.clear();
  unavailableUntil.clear();
  preferred = undefined;
}

function retryDelay(response: Response): number {
  const value = response.headers?.get("retry-after");
  if (!value) return COOLDOWN_MS;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(COOLDOWN_MS, ms) : COOLDOWN_MS;
}

/** One request per identical query, sequential failover, bounded body reads,
 * and a provider-wide pause after failures. Never cache partial/error data. */
export function requestOverpass(query: string): Promise<OverpassResult> {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.value);
  if (hit) cache.delete(query);
  const existing = pending.get(query);
  if (existing) return existing;
  const work = (async () => {
    const endpoints = [...OVERPASS_ENDPOINTS].sort((a, b) =>
      Number(b === preferred) - Number(a === preferred));
    const failures: string[] = [];
    for (const endpoint of endpoints) {
      const host = new URL(endpoint).hostname;
      if ((unavailableUntil.get(endpoint) ?? 0) > Date.now()) {
        failures.push(`${host}: temporarily paused after failure`);
        continue;
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let delay = COOLDOWN_MS;
      try {
        const value = await Promise.race([
          (async (): Promise<OverpassResult> => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "User-Agent": "SummitReady/1.0 (+https://summitready.uk)",
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
              },
              body: new URLSearchParams({ data: query }).toString(),
              signal: controller.signal,
            });
            if (!response.ok) {
              delay = retryDelay(response);
              if (response.status === 400) throw new InvalidQueryError("Overpass rejected the query (HTTP 400)");
              throw new Error(`HTTP ${response.status}`);
            }
            const body = await response.json() as { elements?: unknown; remark?: unknown } | null;
            if (!body || !Array.isArray(body.elements) || body.remark) {
              throw new Error("incomplete Overpass response");
            }
            return { elements: body.elements };
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Overpass request timed out"));
            }, TIMEOUT_MS);
          }),
        ]);
        unavailableUntil.delete(endpoint);
        preferred = endpoint;
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
        cache.set(query, { at: Date.now(), value });
        return value;
      } catch (error) {
        if (error instanceof InvalidQueryError) throw error;
        unavailableUntil.set(endpoint, Date.now() + delay);
        const message = error instanceof Error ? error.message : "";
        const reason = /^(HTTP \d{3}|incomplete Overpass response|Overpass request timed out)$/.test(message)
          ? message : "network or response error";
        failures.push(`${host}: ${reason}`);
        // Never log the query (precise location), URL credentials or response
        // bodies. Operators still see which provider failed and how to retry.
        logger.warn({ provider: host, reason, retryAfterMs: delay }, "Overpass provider unavailable");
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw new Error(`Overpass unavailable: ${failures.join("; ")}`);
  })();
  pending.set(query, work);
  void work.finally(() => pending.delete(query)).catch(() => {});
  return work;
}
