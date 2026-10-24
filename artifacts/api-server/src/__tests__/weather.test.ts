import { describe, expect, it, vi } from "vitest";
import { createWeatherService, normalizeWeather } from "../services/weather";
import { GetMountainWeatherQueryParams } from "@workspace/api-zod";

const rawForecast = () => ({
  location: { name: "Capel Curig", lat: 53.1, lon: -4, tz_id: "Europe/London" },
  current: { last_updated_epoch: 1792882800 },
  forecast: {
    forecastday: [{
      date: "2026-10-25",
      day: { mintemp_c: 3, maxtemp_c: 8, daily_chance_of_rain: 70,
        condition: { text: "Light rain", code: 1183 } },
      hour: [{
        time_epoch: 1792882800, temp_c: 5, feelslike_c: 2, chance_of_rain: 70,
        wind_mph: 20, gust_mph: 35,
        condition: { text: "Light rain", code: 1183 }, is_day: 1,
      }],
    }],
  },
});
const response = (raw: unknown) => new Response(JSON.stringify(raw), { status: 200 });

describe("mountain weather", () => {
  it("uses real provider fields, preserving gusts and provider timezone", () => {
    const value = normalizeWeather(rawForecast(), 1792882800000);
    expect(value.provider).toBe("WeatherAPI.com");
    expect(value.timezone).toBe("Europe/London");
    expect(value.days[0].hours[0]).toMatchObject({
      gustMph: 35, windMph: 20, feelsLikeC: 2, temperatureC: 5, rainChance: 70,
    });
    expect(value.updatedAt).toBe("2026-10-24T23:00:00.000Z");
  });
  it("does not invent missing gust values or accept invalid provider data", () => {
    const raw = rawForecast();
    delete (raw.forecast.forecastday[0].hour[0] as { gust_mph?: number }).gust_mph;
    expect(normalizeWeather(raw, 1).days[0].hours[0].gustMph).toBeNull();
    raw.location.tz_id = "invalid/timezone";
    expect(() => normalizeWeather(raw, 1)).toThrow();
    expect(() => normalizeWeather({}, 1)).toThrow();
  });
  it("shares concurrent requests, caches across users, and expires after 30 minutes", async () => {
    let now = 1792882800000;
    const fetcher = vi.fn(async () => response(rawForecast()));
    const service = createWeatherService({ key: () => "test-only", fetcher, clock: () => now });
    const [first, second] = await Promise.all([service(53.1, -4), service(53.1, -4)]);
    expect(first).toEqual(second);
    await service(53.10001, -4);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = fetcher.mock.calls[0] as unknown[];
    expect(String(url[0])).toContain("days=3");
    now += 30 * 60_000 + 1;
    await service(53.1, -4);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps key failures private and backs off without returning invented weather", async () => {
    const fetcher = vi.fn(async () => { throw new Error("private-url?key=do-not-expose"); });
    const service = createWeatherService({ key: () => "test-only", fetcher, clock: () => 1 });
    await expect(service(53, -4)).rejects.toThrow("Weather forecast unavailable");
    await expect(service(53, -4)).rejects.toMatchObject({ reason: "limit" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const unconfigured = createWeatherService({ key: () => undefined, fetcher });
    await expect(unconfigured(53, -4)).rejects.toMatchObject({ reason: "configuration" });
  });
  it("validates coordinate bounds and supports seven days only when configured", async () => {
    expect(GetMountainWeatherQueryParams.safeParse({ lat: "91", lng: "-4" }).success).toBe(false);
    expect(GetMountainWeatherQueryParams.safeParse({ lat: "53", lng: "181" }).success).toBe(false);
    const fetcher = vi.fn(async () => response(rawForecast()));
    const service = createWeatherService({ key: () => "test-only", fetcher, days: 7 });
    await expect(service(NaN, -4)).rejects.toThrow("Invalid coordinates");
    await service(53, -4);
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toContain("days=7");
  });
  it("does not retry a provider rejection or serve expired data as fresh", async () => {
    let now = 1;
    const fetcher = vi.fn(async () => response(rawForecast()));
    const service = createWeatherService({ key: () => "test-only", fetcher, clock: () => now });
    await service(53, -4);
    now += 31 * 60_000;
    fetcher.mockImplementation(async () => new Response("quota exceeded", { status: 403 }));
    await expect(service(53, -4)).rejects.toMatchObject({ reason: "provider" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
