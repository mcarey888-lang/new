import { describe, expect, it } from "vitest";
import {
  ageMinutes, currentHourIndex, formatDayLabel, formatHourLabel, localDateKey, parseCoord, validWeatherCoords,
} from "./mountainWeather";

describe("mountain weather helpers", () => {
  it("rejects invalid and 0,0 coordinates", () => {
    expect(validWeatherCoords(0, 0)).toBeNull();
    expect(validWeatherCoords(91, 0)).toBeNull();
    expect(validWeatherCoords(NaN, 1)).toBeNull();
    expect(validWeatherCoords(54.6, -3.2)).toEqual({ lat: 54.6, lng: -3.2 });
    expect(parseCoord("")).toBeNull();
    expect(parseCoord("1.5")).toBe(1.5);
  });
  it("formats hours in provider timezone", () => {
    const t = Date.UTC(2025, 5, 1, 23, 30) / 1000;
    expect(formatHourLabel(t, "Europe/London")).toBe("00:30");
    expect(formatHourLabel(t, "UTC")).toBe("23:30");
    expect(localDateKey(t, "Europe/London")).toBe("2025-06-02");
  });
  it("labels days without shifting", () => {
    expect(formatDayLabel("2025-06-02", 0, "2025-06-02")).toBe("Today");
    expect(formatDayLabel("2025-06-03", 1, "2025-06-02")).toContain("3");
  });
  it("selects current hour by unix time", () => {
    const hs = [{ time: 1000 }, { time: 4600 }, { time: 8200 }];
    expect(currentHourIndex(hs, 5000)).toBe(1);
    expect(currentHourIndex(hs, 500)).toBe(-1);
    expect(currentHourIndex(hs, 20000)).toBe(-1);
  });
  it("computes age", () => {
    expect(ageMinutes("2025-01-01T00:00:00Z", Date.parse("2025-01-01T01:30:00Z"))).toBe(90);
    expect(ageMinutes("bad", 0)).toBeNull();
  });
});
