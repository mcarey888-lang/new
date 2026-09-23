/**
 * Guards the rule that prototype example values must never become production
 * behaviour: no production source may depend on 52 or 55 (the readiness
 * example), or on the prototype's Mont Blanc / 12,420 m figures.
 *
 * Comments are allowed to mention them; code is not.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const PRODUCTION_SOURCES = [
  "components/SRReadinessGauge.tsx",
  "components/CoachInsight.tsx",
  "components/ui/index.tsx",
  "utils/readinessGauge.ts",
  "utils/readinessPresentation.ts",
  "utils/coachInsightPresentation.ts",
  "utils/coachFactsAdapter.ts",
  "utils/trackPresentation.ts",
  "utils/sessionPurpose.ts",
  /* Training Basecamp production rebuild */
  "utils/basecampPresentation.ts",
  "components/basecamp/BasecampHero.tsx",
  "components/basecamp/BasecampReadiness.tsx",
  "components/basecamp/MissionSection.tsx",
  "components/basecamp/ProgressTiles.tsx",
  "components/basecamp/QuickActions.tsx",
  "components/SharedTabBar.tsx",
  "hooks/useElevationBank.ts",
  /* Batch 1 — Training Journey */
  "utils/readinessHistory.ts",
  "utils/readinessEvidencePresentation.ts",
  "utils/mountainImage.ts",
  "components/readiness/PillarGrid.tsx",
  "components/readiness/ReadinessHistoryChart.tsx",
  "hooks/useReadinessHistory.ts",
  /* Batch 2 — Explore journey */
  "utils/routeEligibility.ts",
  "utils/mountainDetailPresentation.ts",
  "constants/capabilities.ts",
  "components/mountain/parts.tsx",
  "components/mountain/RouteCard.tsx",
  "components/mountain/SelectedRoute.tsx",
  "components/mountain/MountainDnaPanel.tsx",
  "components/mountain/RouteActionBar.tsx",
];

/** Strip // and block comments so prose about the example does not trip this. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("no prototype fixture values in production paths", () => {
  for (const rel of PRODUCTION_SOURCES) {
    it(`${rel} has no readiness example literals`, () => {
      const body = code(readFileSync(join(ROOT, rel), "utf8"));
      /* 52 and 55 as standalone numeric literals */
      expect(body).not.toMatch(/(?<![\w.])(52|55)(?![\w.%])/);
    });

    it(`${rel} has no prototype mountain or elevation literals`, () => {
      const body = code(readFileSync(join(ROOT, rel), "utf8"));
      expect(body).not.toMatch(/Mont Blanc/);
      expect(body).not.toMatch(/12,?420/);
      expect(body).not.toMatch(/Everest Simulation/);
    });
  }

  it("Training Basecamp names no mountain, date or figure of its own", () => {
    const body = code(readFileSync(join(ROOT, "app/(tabs)/dashboard.tsx"), "utf8"));
    expect(body).not.toMatch(/Mont Blanc/);
    expect(body).not.toMatch(/12,?420/);
    /* every objective value on screen must come from the summit goal */
    expect(body).toMatch(/mountainName=\{summitGoal\.mountainName\}/);
    expect(body).toMatch(/summitDate=\{summitGoal\.summitDate\}/);
    expect(body).toMatch(/goal=\{summitGoal\}/);
  });

  it("the Training Journey screens name no mountain or figure of their own", () => {
    for (const rel of [
      "app/readiness-detail.tsx", "app/(tabs)/plan.tsx",
      "app/session-detail.tsx", "app/hike-detail.tsx",
    ]) {
      const body = code(readFileSync(join(ROOT, rel), "utf8"));
      expect(body).not.toMatch(/Mont Blanc/);
      expect(body).not.toMatch(/12,?420/);
      expect(body).not.toMatch(/88,?429/);
    }
  });

  it("the readiness history replays the engine instead of storing a series", () => {
    const body = code(readFileSync(join(ROOT, "hooks/useReadinessHistory.ts"), "utf8"));
    expect(body).toMatch(/evaluateReadiness\(input\)\.overallScore/);
    expect(body).not.toMatch(/\[\s*\d+\s*,\s*\d+\s*,\s*\d+/);
  });

  it("the Explore journey names no prototype mountain, route or figure", () => {
    for (const rel of [
      "app/(tabs)/explore.tsx", "app/mountain.tsx",
      "utils/mountainDetailPresentation.ts", "utils/routeEligibility.ts",
      "components/mountain/parts.tsx", "components/mountain/RouteCard.tsx",
      "components/mountain/SelectedRoute.tsx", "components/mountain/ElevationProfile.tsx",
      "components/mountain/MountainDnaPanel.tsx", "components/mountain/RouteActionBar.tsx",
    ]) {
      const body = code(readFileSync(join(ROOT, rel), "utf8"));
      /* The Mountain Detail prototype's worked example. */
      expect(body).not.toMatch(/Helvellyn/);
      expect(body).not.toMatch(/Striding Edge/);
      expect(body).not.toMatch(/Swirral|Thirlmere|Grisedale|Glenridding/);
      expect(body).not.toMatch(/uk-lake-helvellyn/);
      /* Its figures: 950 m summit, 820 m ascent, 10.4 km, 4-6 hrs. */
      expect(body).not.toMatch(/(?<![\w.])(950|820)(?![\w.%])/);
      expect(body).not.toMatch(/(?<![\w.])10\.4(?![\w.])/);
      expect(body).not.toMatch(/4[–-]6\s*hrs/);
      /* The Explore prototype's example peaks. */
      expect(body).not.toMatch(/Mont Blanc|Kilimanjaro|Matterhorn/);
    }
  });

  it("no Explore surface decides navigability for itself", () => {
    for (const rel of [
      "app/mountain.tsx",
      "components/mountain/SelectedRoute.tsx", "components/mountain/RouteActionBar.tsx",
    ]) {
      const body = code(readFileSync(join(ROOT, rel), "utf8"));
      /* trackAvailability and the trust fields belong to the one predicate. */
      expect(body).not.toMatch(/trackAvailability/);
      expect(body).not.toMatch(/productLifecycle/);
      expect(body).not.toMatch(/engineStatus/);
    }
    /* And the predicate is the only place that reads them. */
    const guard = code(readFileSync(join(ROOT, "utils/routeEligibility.ts"), "utf8"));
    expect(guard).toMatch(/trackAvailability === "can_track"/);
    expect(guard).toMatch(/productLifecycle === "summitready_verified"/);
  });

  it("the gauge derives everything from its props", () => {
    const body = code(readFileSync(join(ROOT, "components/SRReadinessGauge.tsx"), "utf8"));
    /* the only numbers left should be layout constants, never a score */
    expect(body).toMatch(/score/);
    expect(body).toMatch(/projected/);
    expect(body).not.toMatch(/defaultScore|DEFAULT_SCORE|fallbackScore/);
  });
});
