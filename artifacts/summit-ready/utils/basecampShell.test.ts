/**
 * Guards for the shared app shell and the rebuilt Training Basecamp.
 *
 * There is no React Native renderer in this suite, so these are the same kind
 * of source-shape checks `noFixtureValues.test.ts` already uses, paired with
 * real behavioural assertions against the navigation functions the tab bar
 * delegates to. They exist to catch the things this rebuild could plausibly
 * break: a lost tab, a second navigation system, a dropped accessibility
 * contract, or old presentation left behind.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activePrimaryTabForSegments, primaryTabTarget, type PrimaryTab } from "./navigationTargets";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TAB_BAR = "components/SharedTabBar.tsx";
const SCREEN = "app/(tabs)/dashboard.tsx";

/** The locked SummitReady tab set, in order. */
const APPROVED_TABS: { id: PrimaryTab; label: string }[] = [
  { id: "home", label: "Basecamp" },
  { id: "explore", label: "Explore" },
  { id: "track", label: "Track" },
  { id: "expeditions", label: "Expeditions" },
  { id: "you", label: "You" },
];

describe("shared bottom navigation", () => {
  const src = read(TAB_BAR);

  it("still declares exactly the five approved tabs, in order", () => {
    const declared = [...src.matchAll(/\{\s*id:\s*"(\w+)",\s*label:\s*"([\w ]+)"/g)]
      .map(m => ({ id: m[1] as PrimaryTab, label: m[2] }));
    expect(declared).toEqual(APPROVED_TABS);
  });

  it("routes every tab to a real destination in both shell modes", () => {
    for (const { id } of APPROVED_TABS) {
      for (const mode of ["training", "expedition"] as const) {
        const withExpedition = primaryTabTarget(id, mode, "expedition-1");
        const without = primaryTabTarget(id, mode, null);
        for (const target of [withExpedition, without]) {
          expect(target).toMatch(/^\/\((tabs|expedition)\)\//);
        }
      }
    }
  });

  it("marks the active tab for every route the five tabs can land on", () => {
    const landings: [readonly string[], PrimaryTab][] = [
      [["(tabs)", "dashboard"], "home"],
      [["(tabs)", "explore"], "explore"],
      [["(tabs)", "trails"], "track"],
      [["(tabs)", "account"], "you"],
      [["(expedition)", "base-camp"], "home"],
      [["(expedition)", "mountains"], "expeditions"],
      [["(expedition)", "track"], "track"],
      [["(expedition)", "profile"], "you"],
    ];
    for (const [segments, expected] of landings) {
      expect(activePrimaryTabForSegments(segments)).toBe(expected);
    }
  });

  it("keeps the accessibility contract the shell had before the restyle", () => {
    expect(src).toMatch(/accessibilityRole="tab"/);
    expect(src).toMatch(/accessibilityState=\{\{\s*selected:\s*isActive\s*\}\}/);
    expect(src).toMatch(/accessibilityLabel=\{`\$\{t\.label\} tab`\}/);
  });

  it("still honours the bottom safe area", () => {
    expect(src).toMatch(/useSafeAreaInsets/);
    expect(src).toMatch(/insets\.bottom/);
  });

  it("delegates its routing rather than hard-coding paths", () => {
    expect(src).toMatch(/primaryTabTarget/);
    expect(src).toMatch(/activePrimaryTabForSegments/);
    /* a literal route in the tab bar means the routing rules have been
       duplicated, which is how the two shells start to disagree */
    expect(src).not.toMatch(/router\.(push|navigate)\("\//);
  });

  it("is the only bottom navigation implementation", () => {
    /* One shell, one tab bar. A Basecamp-only bar would show up here. */
    const layout = read("app/(tabs)/_layout.tsx");
    expect(layout).toMatch(/tabBar=\{\(props\) => <SharedTabBar \/>\}/);
    expect(read(SCREEN)).not.toMatch(/SharedTabBar|BottomNav|TabBar/);
  });
});

describe("Training Basecamp composition", () => {
  const src = read(SCREEN);

  it("renders the approved sections", () => {
    for (const component of [
      "BasecampHero",
      "BasecampReadiness",
      "MissionCard",
      "UpNextRail",
      "ProgressTiles",
      "CoachInsight",
      "QuickActionsGrid",
    ]) {
      expect(src).toMatch(new RegExp(`<${component}\\b`));
    }
  });

  it("no longer has a second readiness treatment to fall back to", () => {
    /* ReadinessV2Hero carried the four-segment multicolour ring. It is not
       merely unreferenced — it is deleted, so it cannot come back by import. */
    expect(existsSync(join(ROOT, "components/ReadinessV2Hero.tsx"))).toBe(false);
  });

  it("has dropped the superseded presentation rather than restyling it", () => {
    for (const gone of [
      "MountainHero",
      "HeroContent",
      "heroStyles",
      "ReadinessV2Hero",
      "FourSegmentRing",
      "pairedModules",
      "quietUpsell",
    ]) {
      /* comments may name them; code may not */
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      expect(code).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });

  it("keeps the AI Coach and its subscription gate", () => {
    expect(src).toMatch(/buildCoachInsight/);
    expect(src).toMatch(/entitled:\s*isSubscribed/);
    /* the ask box is only reachable for an entitled user */
    expect(src).toMatch(/\{isSubscribed && \(\s*<View style=\{styles\.askBox\}>/);
  });

  it("passes the Coach engine-supplied facts rather than letting it author them", () => {
    expect(src).toMatch(/facts:\s*buildCoachFacts\(\{/);
    expect(src).toMatch(/overallScore:\s*readinessV2\?\.result\?\.overallScore/);
    expect(src).toMatch(/projectedDelta:\s*readinessV2\?\.nextAction\?\.projectedImpact\?\.delta/);
  });

  it("reads the mission from the plan's own completion map", () => {
    expect(src).toMatch(/missionQueue\(trainingPlan, completedPlanSessions/);
    expect(src).toMatch(/weekProgress\(currentWeek, completedPlanSessions\)/);
  });
});

describe("readiness gating", () => {
  const gauge = read("components/SRReadinessGauge.tsx");
  const panel = read("components/basecamp/BasecampReadiness.tsx");

  it("withholds the figure when locked instead of showing a different ring", () => {
    expect(gauge).toMatch(/locked\s*\?/);
    /* no arc is drawn while locked — the sweep must not leak the score */
    expect(gauge).toMatch(/\{locked \? null : \(/);
    expect(gauge).toMatch(/proj && !locked \?/);
  });

  it("locks exactly on the existing entitlement", () => {
    expect(panel).toMatch(/locked=\{!isSubscribed\}/);
  });

  it("only shows a projection the engine actually produced", () => {
    expect(panel).toMatch(/projection\(result\.overallScore, nextAction\?\.projectedImpact\?\.delta \?\? null\)/);
    expect(panel).toMatch(/isSubscribed && proj \?/);
  });

  it("never turns a missing score into a zero", () => {
    expect(panel).toMatch(/result\.overallScore \?\? null/);
    expect(panel).not.toMatch(/overallScore \?\? 0/);
  });
});
