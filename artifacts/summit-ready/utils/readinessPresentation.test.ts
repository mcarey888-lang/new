import { describe, expect, it } from "vitest";
import {
  PILLAR_LABELS, PILLAR_ORDER, formatScore, pillarDetails, pillars, projection, readinessStatus,
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

describe("pillarDetails", () => {
  const result = {
    state: "available",
    overallScore: 63,
    dimensions: {
      endurance: { score: 70, explanation: "Four long days in the last six weeks.", evidenceIds: ["a", "b"] },
      elevationCapacity: { score: 41, explanation: "Weekly ascent is below the target's demand.", evidenceIds: ["a"] },
      consistency: { score: null, explanation: "", evidenceIds: [] },
      mountainExperience: { score: 55, explanation: "Three distinct peaks logged.", evidenceIds: ["c"] },
    },
    gaps: ["elevationCapacity"],
    strengths: ["endurance"],
  } as any;

  it("returns the four approved pillars in order", () => {
    expect(pillarDetails(result).map(p => p.key))
      .toEqual(["endurance", "elevationCapacity", "consistency", "mountainExperience"]);
  });

  it("marks a gap from the engine's own list, not from a threshold", () => {
    const p = pillarDetails(result);
    expect(p.find(x => x.key === "elevationCapacity")?.isGap).toBe(true);
    /* 55 is below a naive 60 cut but the engine did not call it a gap */
    expect(p.find(x => x.key === "mountainExperience")?.isGap).toBe(false);
    expect(p.find(x => x.key === "endurance")?.isStrength).toBe(true);
  });

  it("keeps a missing score null rather than zero", () => {
    const c = pillarDetails(result).find(x => x.key === "consistency");
    expect(c?.score).toBeNull();
    expect(c?.missing).toBe(true);
  });

  it("carries the engine's explanation verbatim, or null when it has none", () => {
    const p = pillarDetails(result);
    expect(p.find(x => x.key === "endurance")?.explanation).toBe("Four long days in the last six weeks.");
    expect(p.find(x => x.key === "consistency")?.explanation).toBeNull();
  });

  it("flags only the dimension the next action targets", () => {
    const p = pillarDetails(result, "elevationCapacity");
    expect(p.filter(x => x.isFocus).map(x => x.key)).toEqual(["elevationCapacity"]);
  });

  it("flags nothing as focus when there is no next action", () => {
    expect(pillarDetails(result, null).some(x => x.isFocus)).toBe(false);
  });

  it("still returns four pillars with no result at all", () => {
    const p = pillarDetails(null);
    expect(p).toHaveLength(4);
    expect(p.every(x => x.score === null && x.missing && !x.isGap)).toBe(true);
  });

  it("gives every pillar stable descriptive copy that names no person or number", () => {
    for (const p of pillarDetails(result)) {
      expect(p.measures.length).toBeGreaterThan(20);
      expect(p.measures).not.toMatch(/\d/);
    }
  });

  it("reports the engine's evidence count", () => {
    expect(pillarDetails(result).find(x => x.key === "endurance")?.evidenceCount).toBe(2);
    expect(pillarDetails(result).find(x => x.key === "consistency")?.evidenceCount).toBe(0);
  });
});
