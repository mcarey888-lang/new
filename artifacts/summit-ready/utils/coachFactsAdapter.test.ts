import { describe, expect, it } from "vitest";
import { buildCoachFacts } from "./coachFactsAdapter";

describe("coach facts come only from authoritative sources", () => {
  it("reads readiness, projection and the plan's next session", () => {
    const f = buildCoachFacts({
      mountainName: "Mont Blanc",
      overallScore: 52,
      projectedDelta: 3,
      nextSession: { label: "Mountain Day", targetElevation: 900, duration: "3–5 hr" },
      nextSessionDay: "Saturday",
    });
    expect(f).toEqual({
      mountainName: "Mont Blanc",
      currentReadiness: 52,
      projectedReadiness: 55,
      nextSessionTitle: "Mountain Day",
      nextSessionElevationM: 900,
      nextSessionDuration: "3–5 hr",
      nextSessionDay: "Saturday",
    });
  });

  it("omits a projection the engine did not produce", () => {
    const f = buildCoachFacts({ overallScore: 52, projectedDelta: null });
    expect(f.currentReadiness).toBe(52);
    expect(f.projectedReadiness).toBeNull();
  });

  it("never invents readiness when the engine could not score", () => {
    const f = buildCoachFacts({ overallScore: null, projectedDelta: 5 });
    expect(f.currentReadiness).toBeNull();
    expect(f.projectedReadiness).toBeNull();
  });

  it("omits the priority session when the plan has none", () => {
    const f = buildCoachFacts({ overallScore: 40, nextSession: null });
    expect(f.nextSessionTitle).toBeNull();
    expect(f.nextSessionElevationM).toBeNull();
    expect(f.nextSessionDuration).toBeNull();
  });

  it("drops a zero or invalid elevation target rather than showing 0 m", () => {
    expect(buildCoachFacts({ nextSession: { label: "Recovery", targetElevation: 0 } })
      .nextSessionElevationM).toBeNull();
    expect(buildCoachFacts({ nextSession: { label: "Recovery", targetElevation: NaN } })
      .nextSessionElevationM).toBeNull();
  });

  it("treats blank strings as absent", () => {
    const f = buildCoachFacts({ mountainName: "  ", nextSession: { label: " ", duration: "" } });
    expect(f.mountainName).toBeNull();
    expect(f.nextSessionTitle).toBeNull();
    expect(f.nextSessionDuration).toBeNull();
  });

  it("copes with an entirely empty input", () => {
    const f = buildCoachFacts({});
    expect(Object.values(f).every((v) => v === null)).toBe(true);
  });

  it("caps a projection at 100", () => {
    expect(buildCoachFacts({ overallScore: 98, projectedDelta: 9 }).projectedReadiness).toBe(100);
  });
});
