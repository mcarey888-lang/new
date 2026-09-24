/**
 * Journey 1 visual correction — the rules the live QA found broken.
 *
 * These are behavioural and structural, not stylistic: which tab lights up,
 * whether two centred things can collide, whether two screens can state
 * different readiness figures, and whether generated artwork can bleed behind
 * functional content again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activePrimaryTabForSegments } from "./navigationTargets";
import { planWeekDays, weekDateRange, weeksUntilPlanStart } from "./basecampPresentation";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("Training Plan belongs to the Basecamp journey", () => {
  it("lights Basecamp, not Explore", () => {
    expect(activePrimaryTabForSegments(["(tabs)", "plan"])).toBe("home");
    expect(activePrimaryTabForSegments(["(tabs)", "dashboard"])).toBe("home");
  });

  it("leaves the other tabs where they were", () => {
    expect(activePrimaryTabForSegments(["(tabs)", "explore"])).toBe("explore");
    expect(activePrimaryTabForSegments(["(tabs)", "hills"])).toBe("explore");
    expect(activePrimaryTabForSegments(["(tabs)", "trails"])).toBe("track");
    expect(activePrimaryTabForSegments(["(tabs)", "account"])).toBe("you");
    expect(activePrimaryTabForSegments(["(expedition)", "base-camp"])).toBe("home");
  });
});

describe("the mode toggle cannot overlap a screen title", () => {
  it("a screen that owns a toggle opts out of the floating one", () => {
    const layout = code(read("app/(tabs)/_layout.tsx"));
    expect(layout).toMatch(/SCREENS_WITH_OWN_MODE_TOGGLE/);
    expect(layout).toMatch(/"dashboard"/);
    expect(layout).toMatch(/"plan"/);
    expect(layout).toMatch(/SCREENS_WITH_OWN_MODE_TOGGLE\.includes\(currentRoute\) \? null : <ModeTogglePill \/>/);
  });

  it("both opted-out screens really do render one", () => {
    expect(code(read("app/(tabs)/plan.tsx"))).toMatch(/<ModeTogglePill embedded \/>/);
    expect(code(read("components/basecamp/BasecampHero.tsx"))).toMatch(/<ModeTogglePill embedded \/>/);
  });

  it("Training Plan puts it on its own row, above the header", () => {
    const body = read("app/(tabs)/plan.tsx");
    const toggle = body.indexOf("<ModeTogglePill embedded />");
    const header = body.indexOf('title="Training plan"');
    expect(toggle).toBeGreaterThan(-1);
    expect(toggle).toBeLessThan(header);
  });
});

describe("both screens state the same readiness", () => {
  it("Training Plan reads Readiness 2.0, as Basecamp does", () => {
    const plan = code(read("app/(tabs)/plan.tsx"));
    expect(plan).toMatch(/useReadinessV2\(\)/);
    expect(plan).toMatch(/heroReadiness = readinessV2\?\.result\?\.overallScore \?\? null/);
    /* The legacy context score no longer drives the hero figure. */
    expect(plan).not.toMatch(/\{readinessScore\}%/);
  });

  it("shows a dash rather than a zero when the engine has no score", () => {
    expect(read("app/(tabs)/plan.tsx")).toMatch(/heroReadiness === null \? "—"/);
  });
});

describe("a plan week is shown in its own dates", () => {
  it("runs seven consecutive days from the week's start", () => {
    /* 22 Oct 2026 is a Thursday. */
    const days = planWeekDays("2026-10-22T00:00:00", new Date("2026-10-24T09:00:00"));
    expect(days.map(d => d.date)).toEqual([22, 23, 24, 25, 26, 27, 28]);
    expect(days.map(d => d.dow)).toEqual([4, 5, 6, 0, 1, 2, 3]);
  });

  it("marks today by the calendar, not by the weekday", () => {
    const days = planWeekDays("2026-10-19T00:00:00", new Date("2026-10-21T09:00:00"));
    expect(days.filter(d => d.isToday).map(d => d.date)).toEqual([21]);
    /* A week the user is not in has no today at all. */
    const future = planWeekDays("2026-11-16T00:00:00", new Date("2026-10-21T09:00:00"));
    expect(future.some(d => d.isToday)).toBe(false);
  });

  it("falls back to Monday-first with no numbers when there is no date", () => {
    const days = planWeekDays(null, new Date("2026-10-21T09:00:00"));
    expect(days.map(d => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.every(d => d.date === null)).toBe(true);
  });
});

describe("WEEK n OF m is explained rather than left to look wrong", () => {
  it("states the week's real dates", () => {
    expect(weekDateRange("2026-10-19", "2026-10-25")).toBe("19 – 25 Oct");
    expect(weekDateRange("2026-10-29", "2026-11-04")).toBe("29 Oct – 4 Nov");
    expect(weekDateRange(null, "2026-11-04")).toBeNull();
  });

  it("says how far off a plan that has not begun is", () => {
    expect(weeksUntilPlanStart("2026-10-19", new Date("2026-09-24"))).toBe(4);
    /* Once it has started there is nothing to count down to. */
    expect(weeksUntilPlanStart("2026-09-21", new Date("2026-09-24"))).toBeNull();
    expect(weeksUntilPlanStart(null)).toBeNull();
  });

  it("the screen renders that explanation", () => {
    const plan = read("app/(tabs)/plan.tsx");
    expect(plan).toMatch(/weeksUntilStart !== null/);
    expect(plan).toMatch(/scheduled to finish on your target date/);
  });
});

describe("generated artwork never bleeds behind functional content", () => {
  it("the session panel refuses the exercise assets", () => {
    const plan = code(read("app/(tabs)/plan.tsx"));
    expect(plan).toMatch(/const missionBleedUri = _missionGymEx\s*\?\s*null/);
    /* The bleed is built from the place helpers, not from a require(). */
    const bleed = plan.slice(plan.indexOf("const missionBleedUri"), plan.indexOf("const weekSessions"));
    expect(bleed).not.toMatch(/require\(/);
    expect(bleed).toMatch(/sessionImageSubject/);
  });

  it("Training Session still declares its artwork to the hero", () => {
    expect(code(read("app/session-detail.tsx")))
      .toMatch(/artwork=\{heroIsGeneratedArtwork \? "generated" : "photo"\}/);
  });
});

describe("Basecamp reads as a composition, not a stack of cards", () => {
  const dash = code(read("app/(tabs)/dashboard.tsx"));

  it("the Coach is an integrated band, not another panel", () => {
    expect(dash).toMatch(/styles\.coachBand/);
    const styles = read("app/(tabs)/dashboard.tsx");
    const band = styles.slice(styles.indexOf("  coachBand: {"), styles.indexOf("  coachInner:"));
    expect(band).toMatch(/borderTopWidth: 1/);
    expect(band).not.toMatch(/borderRadius/);
  });

  it("keeps the Coach in the required hierarchy position", () => {
    /* JSX usages, not the import lines at the top of the file. */
    const mission = dash.indexOf("This week's mission");
    const coach = dash.indexOf("styles.coachBand");
    const bank = dash.indexOf("<ProgressTiles");
    expect(mission).toBeLessThan(coach);
    expect(coach).toBeLessThan(bank);
  });

  it("keeps the AI Coach gate and its engine-supplied facts", () => {
    expect(dash).toMatch(/buildCoachInsight\(/);
    expect(dash).toMatch(/entitled: isSubscribed/);
    expect(dash).toMatch(/buildCoachFacts\(/);
    expect(dash).toMatch(/onUnlock=\{\(\) => router\.push\("\/paywall"\)\}/);
  });

  it("gives the mission and the rail real photography", () => {
    expect(dash).toMatch(/imageUri=\{sessionImage\(mission\)\}/);
    expect(dash).toMatch(/imageUriFor=\{sessionImage\}/);
    expect(dash).toMatch(/sessionImageSubject\(/);
  });

  it("states the objective as a fact line and keeps the target date", () => {
    const hero = code(read("components/basecamp/BasecampHero.tsx"));
    expect(hero).toMatch(/styles\.factLine/);
    expect(hero).toMatch(/targetDateDisplay\(summitDate\)/);
    expect(hero).not.toMatch(/metricDivider/);
  });
});
