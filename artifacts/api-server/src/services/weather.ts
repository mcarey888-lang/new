import { z } from "zod";
import { GetMountainWeatherResponse } from "@workspace/api-zod";

const condition = z.object({ text: z.string().min(1), code: z.number().int() });
const providerResponse = z.object({
  location: z.object({
    name: z.string(), lat: z.number(), lon: z.number(), tz_id: z.string(),
  }),
  current: z.object({ last_updated_epoch: z.number() }),
  forecast: z.object({
    forecastday: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      day: z.object({
        mintemp_c: z.number(), maxtemp_c: z.number(),
        daily_chance_of_rain: z.coerce.number().min(0).max(100),
        condition,
      }),
      hour: z.array(z.object({
        time_epoch: z.number(), temp_c: z.number(), feelslike_c: z.number(),
        chance_of_rain: z.coerce.number().min(0).max(100),
        wind_mph: z.number().nonnegative(),
        gust_mph: z.number().nonnegative().nullish(),
        condition, is_day: z.number(),
      })).min(1).max(25),
    })).min(1).max(7),
  }),
});

export function normalizeWeather(raw: unknown, now: number) {
  const parsed = providerResponse.parse(raw);
  // Reject unusable timezone identifiers before they reach native Intl formatters.
  new Intl.DateTimeFormat("en", { timeZone: parsed.location.tz_id }).format(now);
  return GetMountainWeatherResponse.parse({
    provider: "WeatherAPI.com",
    fetchedAt: new Date(now).toISOString(),
    updatedAt: new Date(parsed.current.last_updated_epoch * 1000).toISOString(),
    timezone: parsed.location.tz_id,
    locationName: parsed.location.name,
    latitude: parsed.location.lat,
    longitude: parsed.location.lon,
    days: parsed.forecast.forecastday.map(d => ({
      date: d.date, minC: d.day.mintemp_c, maxC: d.day.maxtemp_c,
      rainChance: d.day.daily_chance_of_rain,
      condition: d.day.condition.text, conditionCode: d.day.condition.code,
      hours: d.hour.map(h => ({
        time: h.time_epoch, temperatureC: h.temp_c, feelsLikeC: h.feelslike_c,
        rainChance: h.chance_of_rain, windMph: h.wind_mph,
        gustMph: h.gust_mph ?? null, condition: h.condition.text,
        conditionCode: h.condition.code, isDay: h.is_day === 1,
      })),
    })),
  });
}

export class WeatherUnavailable extends Error {
  constructor(public readonly reason: "configuration" | "provider" | "limit") {
    super("Weather forecast unavailable");
  }
}

const TTL = 30 * 60_000;
type Forecast = ReturnType<typeof normalizeWeather>;

/** A shared, bounded cache: weather has no account-private data. Never cache errors as weather. */
export function createWeatherService({
  key, fetcher = fetch, clock = Date.now, days = 3,
}: { key: () => string | undefined; fetcher?: typeof fetch; clock?: () => number; days?: number }) {
  const cache = new Map<string, { value: Forecast; expires: number }>();
  const inflight = new Map<string, Promise<Forecast>>();
  let blockedUntil = 0;
  let hourStart = clock();
  let calls = 0;
  const forecastDays = Math.max(3, Math.min(7, Math.floor(days) || 3));
  return async function forecast(lat: number, lng: number): Promise<Forecast> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Invalid coordinates");
    // 3 decimals shares forecasts within ~100m, without merging mountain and town locations.
    const latitude = lat.toFixed(3);
    const longitude = lng.toFixed(3);
    const id = `${latitude},${longitude}:${forecastDays}`;
    const now = clock();
    const found = cache.get(id);
    if (found && found.expires > now) return found.value;
    if (inflight.has(id)) return inflight.get(id)!;
    if (!key()) throw new WeatherUnavailable("configuration");
    if (now - hourStart >= 3_600_000) { hourStart = now; calls = 0; }
    // Protect the free quota. This budget is per process, not a cross-replica monthly guarantee.
    if (now < blockedUntil || inflight.size >= 5 || calls >= 100) {
      throw new WeatherUnavailable("limit");
    }
    calls++;
    const request = (async () => {
      const url = new URL("https://api.weatherapi.com/v1/forecast.json");
      url.search = new URLSearchParams({
        key: key()!, q: `${latitude},${longitude}`,
        days: String(forecastDays), aqi: "no", alerts: "no",
      }).toString();
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new WeatherUnavailable("provider");
        const value = normalizeWeather(await response.json(), clock());
        cache.delete(id);
        cache.set(id, { value, expires: clock() + TTL });
        while (cache.size > 500) cache.delete(cache.keys().next().value!);
        return value;
      } catch {
        // Never log the exception: provider request URLs contain the private API key.
        blockedUntil = clock() + 60_000;
        throw new WeatherUnavailable("provider");
      } finally {
        inflight.delete(id);
      }
    })();
    inflight.set(id, request);
    return request;
  };
}

export const getWeatherForecast = createWeatherService({
  key: () => process.env.WEATHERAPI_KEY,
  days: Number(process.env.WEATHER_FORECAST_DAYS ?? 3),
});
