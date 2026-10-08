import { describe, expect, it } from "vitest";
import { DEFAULT_EXPLORE_FILTERS as defaults, exploreDurationMinutes, filterExploreRoutes, mountainDiscoveryParameters } from "./exploreFilters";

const routes = [
  { name: "Long climb", location: "Wales", difficulty: "Hard", elevationGain: 900, estimatedTime: "5h 30m" },
  { name: "Short walk", location: "England", difficulty: "Easy", elevationGain: 200, estimatedTime: "45 minutes" },
  { name: "Missing figures", location: "Wales" },
];

describe("Explore filters", () => {
  it("parses source time units and conservative upper bounds", () => {
    expect(exploreDurationMinutes("7h 30m")).toBe(450);
    expect(exploreDurationMinutes("7h30m")).toBe(450);
    expect(exploreDurationMinutes("1 hour 15 minutes")).toBe(75);
    expect(exploreDurationMinutes("2–3 hours")).toBe(180);
    expect(exploreDurationMinutes("1h – 2h")).toBe(120);
    expect(exploreDurationMinutes("45")).toBeNull();
    expect(exploreDurationMinutes("Unknown")).toBeNull();
  });
  it("combines route name/place, difficulty, ascent and time", () => {
    expect(filterExploreRoutes(routes, "Wales", { ...defaults, difficulty: "Hard", ascentMinM: 200, timeMaxMinutes: 360 }, "recommended").map(r => r.name)).toEqual(["Long climb"]);
  });
  it("never treats route ascent as summit altitude", () => {
    expect(filterExploreRoutes(routes, "", { ...defaults, summitMinM: 5000 }, "recommended")).toHaveLength(3);
    expect(mountainDiscoveryParameters({ ...defaults, ascentMinM: 200 }, "ascent_desc").has("summitMinM")).toBe(false);
  });
  it("excludes missing figures from active numeric ranges, not from default browsing", () => {
    expect(filterExploreRoutes(routes, "", defaults, "recommended")).toHaveLength(3);
    expect(filterExploreRoutes(routes, "", { ...defaults, ascentMinM: 200 }, "recommended")).toHaveLength(2);
    expect(filterExploreRoutes(routes, "", { ...defaults, timeMaxMinutes: 60 }, "recommended")[0].name).toBe("Short walk");
  });
  it("sorts numeric values both ways and keeps missing values last", () => {
    expect(filterExploreRoutes(routes, "", defaults, "ascent_desc").map(r => r.name)).toEqual(["Long climb", "Short walk", "Missing figures"]);
    expect(filterExploreRoutes(routes, "", defaults, "time_asc").map(r => r.name)).toEqual(["Short walk", "Long climb", "Missing figures"]);
    expect(filterExploreRoutes(routes, "", defaults, "difficulty_desc")[0].name).toBe("Long climb");
  });
  it("respects result type and sends summit filters/sort to the server", () => {
    expect(filterExploreRoutes(routes, "", { ...defaults, kind: "mountains" }, "recommended")).toEqual([]);
    expect(mountainDiscoveryParameters({ ...defaults, summitMinM: 200, summitMaxM: 1000 }, "summit_desc").toString()).toBe("summitMinM=200&summitMaxM=1000&sort=summit_desc");
  });
});
