import { describe, expect, it } from "vitest";
import {
  PILLAR_LABELS, PILLAR_ORDER, formatScore, pillars, projection, readinessStatus,
} from "./readinessPresentation";
import type { ReadinessResult } from "./readinessV2";

const dim = (score: number | null) => ({ score, contributions: [], missingInputs: [] }) as any;
const DEFAULTS: Record<string, number> = {
  endurance: 60, elevationCapacity: 55, consistency: 40, mountainExperience: 30,
};
/* `??` would swallow an explicit null, which is the case under test, so key
   presence decides whether the default applies. */
const result = (scores: Partial<Record<string, number | null>>): ReadinessResult => ({
  modelVersion: 2, state: "available", overallScore: 50,
  dimensions: Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, dim(k in scores ? scores[k]! : DEFAULTS[k])]),
  ),
} as any);

describe("pillars", () => {
  it("uses the approved order and labels", () => {
    expect(PILLAR_ORDER).toEqual(["endurance", "elevationCapacity", "consistency", "mountainExperience"]);
    expect(Object.values(PILLAR_LABELS)).toEqual(["Endurance", "Elevation", "Consistency", "Experience"]);
  });

  it("reads scores straight from the engine result", () => {
    const p = pillars(result({ endurance: 72 }));
    expect(p.map((x) => x.score)).toEqual([72, 55, 40, 30]);
    expect(p.every((x) => !x.missing)).toBe(true);
  });

  it("marks an unscored pillar missing rather than zero", () => {
    const p = pillars(result({ mountainExperience: null }));
    const exp = p.find((x) => x.key === "mountainExperience")!;
    expect(exp.score).toBeNull();
    expect(exp.missing).toBe(true);
    expect(formatScore(exp.score)).toBe("—");
  });

  it("returns four pillars even with no result at all", () => {
    expect(pillars(null)).toHaveLength(4);
    expect(pillars(null).every((x) => x.missing)).toBe(true);
  });
});

describe("status mapping", () => {
  it("maps the engine's degraded state to BUILDING", () => {
    expect(readinessStatus("degraded", 64)).toBe("building");
  });

  it("maps unavailable to unavailable, never to a score", () => {
    expect(readinessStatus("unavailable", null)).toBe("unavailable");
    expect(readinessStatus("available", null)).toBe("unavailable");
    expect(readinessStatus(undefined, 80)).toBe("unavailable");
  });

  it("bands an available score", () => {
    expect(readinessStatus("available", 82)).toBe("ready");
    expect(readinessStatus("available", 55)).toBe("nearly");
    expect(readinessStatus("available", 30)).toBe("building");
  });

  it("shows PENDING while an activity is still being processed", () => {
    expect(readinessStatus("available", 80, { processing: true })).toBe("pending");
    expect(readinessStatus("unavailable", null, { processing: true })).toBe("pending");
  });
});

describe("projection", () => {
  it("adds the engine's delta to the earned score", () => {
    expect(projection(52, 3)).toEqual({ current: 52, projected: 55, delta: 3 });
  });

  it("never fabricates a projection", () => {
    expect(projection(52, null)).toBeNull();
    expect(projection(52, undefined)).toBeNull();
    expect(projection(52, 0)).toBeNull();
    expect(projection(null, 5)).toBeNull();
  });

  it("caps at 100 and drops a projection that adds nothing", () => {
    expect(projection(98, 10)).toEqual({ current: 98, projected: 100, delta: 2 });
    expect(projection(100, 5)).toBeNull();
  });
});
