import { describe, expect, it } from "vitest";
import {
  COACH_DISCLAIMER, buildCoachInsight, compactCoach, hasProjection, normaliseFacts,
} from "./coachInsightPresentation";

const assessment = { summary: "Solid start.", tone: "positive" as const, tips: ["A", "B", "C"] };
const base = { hasGoal: true, entitled: true, loading: false, error: false, assessment, facts: {} };

describe("coach gating preserves existing behaviour", () => {
  it("hides before a summit goal exists", () => {
    expect(buildCoachInsight({ ...base, hasGoal: false }).kind).toBe("hidden");
  });
  it("locks when the user is not entitled", () => {
    expect(buildCoachInsight({ ...base, entitled: false }).kind).toBe("locked");
  });
  it("shows loading while the service is working", () => {
    expect(buildCoachInsight({ ...base, loading: true }).kind).toBe("loading");
    expect(buildCoachInsight({ ...base, assessment: null }).kind).toBe("loading");
  });
  it("shows an error state that the screen can retry from", () => {
    expect(buildCoachInsight({ ...base, error: true }).kind).toBe("error");
  });
  it("error takes precedence over loading", () => {
    expect(buildCoachInsight({ ...base, error: true, loading: true }).kind).toBe("error");
  });
});

describe("the Coach never becomes the source of a fact", () => {
  it("keeps facts and interpretation structurally separate", () => {
    const s = buildCoachInsight(base) as any;
    expect(Object.keys(s.facts).sort()).toEqual([
      "currentReadiness", "mountainName", "nextSessionDay", "nextSessionDuration",
      "nextSessionElevationM", "nextSessionTitle", "projectedReadiness",
    ]);
    expect(Object.keys(s.interpretation).sort()).toEqual(["summary", "tips", "tone"]);
  });

  it("carries no readiness value when the engines supplied none", () => {
    const s = buildCoachInsight(base) as any;
    expect(s.facts.currentReadiness).toBeNull();
    expect(s.facts.projectedReadiness).toBeNull();
    expect(hasProjection(s.facts)).toBe(false);
  });

  it("cannot take a number out of the assessment text", () => {
    const s = buildCoachInsight({
      ...base,
      assessment: { summary: "You are at 87% readiness.", tone: "positive", tips: [] },
    }) as any;
    expect(s.facts.currentReadiness).toBeNull();
  });

  it("uses engine facts when they are supplied", () => {
    const s = buildCoachInsight({
      ...base, facts: { mountainName: "Mont Blanc", currentReadiness: 52, projectedReadiness: 55 },
    }) as any;
    expect(s.facts.currentReadiness).toBe(52);
    expect(hasProjection(s.facts)).toBe(true);
  });

  it("always carries the guidance disclaimer", () => {
    const s = buildCoachInsight(base) as any;
    expect(s.disclaimer).toBe(COACH_DISCLAIMER);
    expect(s.disclaimer).toMatch(/not medical advice/);
  });

  it("makes no safety or capability claim", () => {
    expect(COACH_DISCLAIMER).not.toMatch(/safe to climb|definitely capable|guaranteed/i);
  });
});

describe("fact normalisation", () => {
  it("rejects non-finite numbers rather than rendering them", () => {
    const f = normaliseFacts({ currentReadiness: NaN, nextSessionElevationM: Infinity });
    expect(f.currentReadiness).toBeNull();
    expect(f.nextSessionElevationM).toBeNull();
  });
  it("clamps percentages", () => {
    expect(normaliseFacts({ currentReadiness: 140 }).currentReadiness).toBe(100);
    expect(normaliseFacts({ currentReadiness: -5 }).currentReadiness).toBe(0);
  });
  it("treats blank strings as absent", () => {
    expect(normaliseFacts({ mountainName: "   " }).mountainName).toBeNull();
    expect(normaliseFacts({ mountainName: " Mont Blanc " }).mountainName).toBe("Mont Blanc");
  });
  it("handles a completely absent input", () => {
    expect(normaliseFacts(null).mountainName).toBeNull();
  });
});

describe("compact Basecamp treatment", () => {
  it("shows identity, one assessment and one next action", () => {
    const c = compactCoach(buildCoachInsight(base))!;
    expect(c.summary).toBe("Solid start.");
    expect(c.nextActions).toEqual(["A"]);
    expect(c.hasMore).toBe(true);
  });
  it("reports when there is nothing more to open", () => {
    const c = compactCoach(buildCoachInsight({
      ...base, assessment: { ...assessment, tips: ["only"] },
    }))!;
    expect(c.hasMore).toBe(false);
  });
  it("returns nothing when the coach is not ready", () => {
    expect(compactCoach(buildCoachInsight({ ...base, loading: true }))).toBeNull();
  });
  it("survives a malformed tips payload", () => {
    const c = compactCoach(buildCoachInsight({
      ...base, assessment: { summary: "s", tone: "neutral", tips: null as any },
    }))!;
    expect(c.nextActions).toEqual([]);
  });
});
