import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elevationAtDistance } from "./routeProgress";
import type { ElevationProfilePoint } from "./mountainDetailPresentation";

const SRC = readFileSync(join(__dirname, "..", "components/mountain/ElevationProfile.tsx"), "utf8");

const PROFILE: ElevationProfilePoint[] = [
  { distanceM: 0,    elevationM: 300 },
  { distanceM: 300,  elevationM: 420 },
  { distanceM: 600,  elevationM: 560 },
  { distanceM: 900,  elevationM: 700 },
];

describe("height at a distance along the drawn line", () => {
  it("returns the sample exactly on a sample", () => {
    expect(elevationAtDistance(PROFILE, 300)).toBe(420);
    expect(elevationAtDistance(PROFILE, 0)).toBe(300);
  });

  it("follows the line between samples", () => {
    /* The marker sits on the curve that is already drawn. This is not invented
       terrain — the line between two samples is interpolation the chart is
       showing anyway, and putting the dot anywhere else would place it off the
       curve it belongs to. */
    expect(elevationAtDistance(PROFILE, 450)).toBe(490);
  });

  it("clamps rather than extrapolating past either end", () => {
    /* Continuing the last gradient past the end would draw ground that does
       not exist. */
    expect(elevationAtDistance(PROFILE, -500)).toBe(300);
    expect(elevationAtDistance(PROFILE, 99999)).toBe(700);
  });

  it("has nothing to say about an empty profile", () => {
    expect(elevationAtDistance([], 100)).toBeNull();
  });
});

describe("the live marker", () => {
  it("is drawn only for a position actually on the profile", () => {
    /* A position beyond either end would pin the marker to a corner and imply
       the walker is standing there. */
    expect(SRC).toContain("positionM >= points[0].distanceM && positionM <= points[points.length - 1].distanceM");
  });

  it("splits the line so what is walked and what is ahead read differently", () => {
    expect(SRC).toContain("behind ? \"rgba(255,255,255,0.28)\" : EXPLORE.accent");
  });

  it("joins the two halves on the marker, not on the nearest sample", () => {
    /* Meeting at a sample would leave a visible step up to thirty metres from
       where the person actually is. */
    expect(SRC).toContain("x(livePosition).toFixed(1)");
  });
});

describe("climbing left", () => {
  it("shows nothing rather than zero when it is not known", () => {
    /* Unknown is not zero. A reassuring "0 m of climbing left" at the foot of a
       mountain is the worst available wrong answer, so the label is absent
       instead. */
    expect(SRC).toContain('typeof remainingAscentM === "number" && Number.isFinite(remainingAscentM)');
  });
});

describe("the existing chart is untouched", () => {
  it("still keeps altitude and total ascent apart", () => {
    /* The reason this component carries a caption at all: a route that drops
       and re-climbs accumulates ascent its high point cannot show. */
    expect(SRC).toContain("Total ascent is listed separately");
  });

  it("takes the live props as optional, so every existing caller is unaffected", () => {
    expect(SRC).toContain("positionM?: number | null");
    expect(SRC).toContain("remainingAscentM?: number | null");
  });
});
