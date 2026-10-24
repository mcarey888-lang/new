import { describe, expect, it } from "vitest";
import {
  ageMinutes, catalogueWeatherCoords, currentHourIndex, formatDayLabel, formatHourLabel, localDateKey, parseCoord, validWeatherCoords,
} from "./mountainWeather";
import type { MountainDiscoveryPage } from "@workspace/api-client-react";

const catalogue: MountainDiscoveryPage = {
  items: [{
    id: "ben-nevis", name: "Ben Nevis [Beinn Nibheis]", country: "Scotland", region: "Highlands",
    area: null, elevationM: 1344.53, latitude: 56.796891, longitude: -5.003675,
    source: "catalogue", verificationStatus: "imported",
  }],
  hasMore: false, catalogueStatus: "available",
};

describe("mountain weather helpers", () => {
  it("can use an exact imported catalogue mountain for weather without canonical navigation trust", () => {
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", "Scotland")).toEqual({
      lat: 56.796891, lng: -5.003675,
    });
    expect(catalogueWeatherCoords(catalogue, "Beinn Nibheis")).not.toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis [Beinn Nibheis]")).not.toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", "Scotland, United Kingdom")).not.toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", "United Kingdom")).not.toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis North Ridge")).toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", "Wales")).toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", "Wales, United Kingdom")).toBeNull();
  });
  it("refuses ambiguous, incomplete, invalid or AI-only weather identities", () => {
    expect(catalogueWeatherCoords({ ...catalogue, items: [...catalogue.items, { ...catalogue.items[0], id: "other" }] }, "Ben Nevis")).toBeNull();
    expect(catalogueWeatherCoords({ ...catalogue, hasMore: true }, "Ben Nevis")).toBeNull();
    expect(catalogueWeatherCoords({ ...catalogue, items: [{ ...catalogue.items[0], source: "ai", verificationStatus: "ai_unverified" }] }, "Ben Nevis")).toBeNull();
    expect(catalogueWeatherCoords({ ...catalogue, items: [{ ...catalogue.items[0], latitude: NaN }] }, "Ben Nevis")).toBeNull();
    expect(catalogueWeatherCoords(catalogue, "Ben Nevis", undefined, "wrong-id")).toBeNull();
    expect(catalogueWeatherCoords({ ...catalogue, hasMore: true }, "Ben Nevis", undefined, "ben-nevis")).not.toBeNull();
  });
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
