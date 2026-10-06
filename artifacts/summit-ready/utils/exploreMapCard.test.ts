import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const EXPLORE = readFileSync(join(__dirname, "..", "app/(tabs)/explore.tsx"), "utf8");
const HIKES = readFileSync(join(__dirname, "..", "app/(tabs)/hikes.tsx"), "utf8");
const LAYOUT = readFileSync(join(__dirname, "..", "app/_layout.tsx"), "utf8");

describe("the Explore by Map card", () => {
  it("opens the map, which is what it says it does", () => {
    const section = EXPLORE.slice(EXPLORE.indexOf('title="Explore by Map"'));
    const card = section.slice(0, section.indexOf("</SRPanel>"));
    expect(card).toContain('router.push("/route-planner"');
    expect(card).not.toContain("hills-finder");
  });

  it("describes itself as opening a map", () => {
    const section = EXPLORE.slice(EXPLORE.indexOf('title="Explore by Map"'));
    expect(section.slice(0, 600)).toContain('accessibilityLabel="Open the map"');
  });

  it("leaves the hills list reachable from its other ways in", () => {
    /* It is a 614-line screen that does real work. Moving one entry point is
       a change; removing the only one would be burying it. */
    const explore = EXPLORE.split("hills-finder").length - 1;
    expect(explore, "Explore lost its hills-list links").toBeGreaterThanOrEqual(2);
    expect(HIKES).toContain("hills-finder");
  });

  it("keeps both screens registered", () => {
    expect(LAYOUT).toContain('name="route-planner"');
    expect(LAYOUT).toContain('name="hills-finder"');
  });
});
