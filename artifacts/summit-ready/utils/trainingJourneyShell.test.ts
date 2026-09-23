/**
 * Guards for the Batch 1 rebuild: Full Readiness, Training Plan, Training
 * Session, Activity Complete and Activity Details.
 *
 * There is no React Native renderer in this suite, so these are source-shape
 * checks in the same style as `noFixtureValues.test.ts`, aimed at the things
 * this rebuild could plausibly break: a lost action, a dropped entitlement
 * gate, a fabricated figure, or old presentation left behind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Strip comments so prose about a thing does not count as using it. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const READINESS = "app/readiness-detail.tsx";
const PLAN = "app/(tabs)/plan.tsx";
const SESSION = "app/session-detail.tsx";
const TRACKING = "app/hike-tracking.tsx";
const ACTIVITY = "app/hike-detail.tsx";
const COMPLETE = "components/track/ActivityCompleteView.tsx";

describe("the rebuilt screens share one design system", () => {
  for (const rel of [READINESS, PLAN, SESSION, COMPLETE, ACTIVITY]) {
    it(`${rel} composes from the shared primitives`, () => {
      expect(read(rel)).toMatch(/from "@\/components\/ui"/);
    });

    it(`${rel} uses the approved palette rather than the legacy one`, () => {
      expect(read(rel)).toMatch(/BASECAMP/);
    });
  }

  it("the old Training Plan dashboard presentation is gone", () => {
    const body = code(read(PLAN));
    for (const gone of ["dashStyles", "planLockStyles", "calDayCol", "missionStartInner", "upcomingRow"]) {
      expect(body).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });

  it("the old Training Session presentation is gone", () => {
    const body = code(read(SESSION));
    for (const gone of ["heroWrap", "ctaBtnGps", "ctaBtnManual", "chipRow", "hillRow", "purposeBlock"]) {
      expect(body).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });

  it("the old Activity Complete presentation is gone", () => {
    const body = code(read(TRACKING) + read(COMPLETE));
    for (const gone of ["summaryContainer", "summaryGrid", "summaryCellValue", "saveBtnGrad", "consequenceCard"]) {
      expect(body).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });
});

describe("Full Readiness reads the engine and nothing else", () => {
  const src = read(READINESS);

  it("draws the accepted gauge from the engine's own score", () => {
    expect(src).toMatch(/<SRReadinessGauge/);
    expect(src).toMatch(/score=\{result\.overallScore\}/);
  });

  it("draws a projection only from the engine's own next-action impact", () => {
    expect(src).toMatch(/projection\(result\?\.overallScore, nextAction\?\.projectedImpact\?\.delta \?\? null\)/);
    expect(src).toMatch(/projected=\{proj \? proj\.projected : null\}/);
  });

  it("takes gaps from the engine's list rather than a threshold of its own", () => {
    const pillars = code(read("utils/readinessPresentation.ts"));
    expect(pillars).toMatch(/gaps = new Set\(result\?\.gaps \?\? \[\]\)/);
    expect(code(src)).not.toMatch(/score\s*<\s*50/);
  });

  it("lists only the evidence the engine included", () => {
    expect(src).toMatch(/includedEvidenceIds: result\?\.includedEvidenceIds \?\? \[\]/);
  });

  it("has a designed state for every absence rather than a blank", () => {
    for (const id of [
      "readiness-unavailable", "readiness-no-action", "readiness-no-evidence",
    ]) {
      expect(src).toContain(`testID="${id}"`);
    }
    expect(read("components/readiness/ReadinessHistoryChart.tsx"))
      .toContain('testID="readiness-history-empty"');
  });

  it("never renders a missing score as zero", () => {
    expect(code(src)).not.toMatch(/overallScore \?\? 0/);
  });
});

describe("Training Plan keeps its behaviour", () => {
  const src = read(PLAN);

  it("keeps the entitlement gate on the full plan", () => {
    expect(src).toMatch(/const isPlanLocked = !isSubscribed && week\.weekNumber > 1/);
    expect(src).toMatch(/router\.push\("\/paywall"\)/);
  });

  it("still starts a GPS session with the same parameters", () => {
    expect(src).toMatch(/pathname: "\/hike-tracking"/);
    for (const p of ["hillSessionKey", "hillName", "targetReps", "estimatedGainPerRep", "estimatedTotalGain"]) {
      expect(src).toContain(p);
    }
  });

  it("keeps the week navigation, day selection and swipe", () => {
    expect(src).toMatch(/setViewedWeekNum/);
    expect(src).toMatch(/setSelectedDow/);
    expect(src).toMatch(/missionPanResponder\.panHandlers/);
  });

  it("keeps the hill picker, the session editor and the day picker", () => {
    expect(src).toMatch(/openHillPicker\(/);
    expect(src).toMatch(/openEditSession\(/);
    expect(src).toMatch(/setDayPickerFor\(/);
  });

  it("keeps the week celebration and the week cards", () => {
    expect(src).toMatch(/<WeekCelebrationOverlay/);
    expect(src).toMatch(/<WeekCard/);
  });

  it("says rest day rather than leaving a day blank", () => {
    expect(src).toContain('testID="plan-rest-day"');
  });
});

describe("Training Session keeps its behaviour", () => {
  const src = read(SESSION);

  it("keeps every route out of the screen", () => {
    expect(src).toMatch(/pathname: "\/hike-tracking"/);
    expect(src).toMatch(/togglePlanSession\(weekNum, sessionIdx\)/);
    expect(src).toMatch(/handleSubmitWeek/);
  });

  it("keeps the loggers writing through the same setter", () => {
    expect(src).toMatch(/<RepLog/);
    expect(src).toMatch(/<MeterLog/);
    expect(src).toMatch(/onSet=\{setSessionReps\}/);
  });

  it("keeps all three pickers", () => {
    expect(src).toMatch(/<HillPickerModal/);
    expect(src).toMatch(/<ExercisePickerModal/);
    expect(src).toMatch(/<DayPickerModal/);
  });

  it("keeps the existing hero artwork resolution", () => {
    expect(src).toMatch(/heroImageSource/);
    expect(src).toMatch(/exercise-treadmill\.png/);
  });
});

describe("Activity Complete tells the truth about consequences", () => {
  const view = read(COMPLETE);
  const screen = read(TRACKING);

  it("keeps every consequence row the owning systems supply", () => {
    for (const id of [
      "completion-elevation-bank", "completion-readiness", "completion-training",
      "completion-expedition", "completion-challenge-achievement", "completion-offline",
    ]) {
      expect(view).toContain(`testID="${id}"`);
    }
  });

  /* The point of the whole screen: every consequence is the presentation's. */
  it("reads every consequence from CompletionPresentation and nothing else", () => {
    const body = code(view);
    for (const field of [
      "completionPresentation.elevationBank", "completionPresentation.training",
      "completionPresentation.expedition", "completionPresentation.challengeAchievement",
      "completionPresentation.sync", "completionPresentation.title",
    ]) {
      expect(body).toContain(field);
    }
  });

  it("owns no data source of its own", () => {
    const body = code(view);
    /* no queries, no engines, no storage, no network — it is handed the
       presentation and renders it */
    for (const forbidden of [
      "useGetElevationBank", "evaluateReadiness", "useReadinessV2", "useApp",
      "AsyncStorage", "fetch(", "Location", "syncOutbox", "Crypto",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("never claims a readiness increase at the moment of finishing", () => {
    expect(view).toMatch(/processing: true/);
    const body = code(view);
    expect(body).not.toMatch(/readinessDelta|readinessGain|\+\d+\s*readiness/i);
  });

  it("saves and discards through the screen's own handlers", () => {
    expect(view).toMatch(/onPress=\{onSave\}/);
    expect(view).toMatch(/onPress=\{onDiscard\}/);
    expect(view).toMatch(/ACTIVITY_DETAILS_COPY\.cta/);
    /* the screen still owns the save path and the canonical activity */
    expect(screen).toMatch(/onSave=\{handleSave\}/);
  });

  it("keeps the add-to-plan toggle", () => {
    expect(view).toMatch(/setAddToPlan\(v => !v\)/);
  });

  it("groups large metre figures so a lifetime total stays readable", () => {
    /* rendering showed "Lifetime 1284500 m" before this */
    expect(read(TRACKING)).toMatch(/Math\.round\(m\)\.toLocaleString\(\) } m|Math\.round\(m\)\.toLocaleString\(\)\} m/);
  });

  it("is the screen's only finished-state presentation", () => {
    expect(screen).toMatch(/<ActivityCompleteView/);
    const body = code(screen);
    for (const gone of ["doneHead", "rewardValue", "consequenceRow", "planToggleRow"]) {
      expect(body).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });
});

describe("Activity Details shows only what was recorded", () => {
  const src = read(ACTIVITY);

  it("derives pace through the shared formatter, which carries the minute", () => {
    expect(src).toMatch(/formatPace\(hike\.timeTaken, hike\.distance\)/);
    /* the old inline version could print 5:60/km */
    expect(code(src)).not.toMatch(/avgPaceMin/);
  });

  it("shows an em dash for a value the record does not carry", () => {
    expect(src).toMatch(/value \?\? "—"/);
  });

  it("has a designed state for a missing route and a missing activity", () => {
    expect(src).toContain('testID="activity-no-route"');
    expect(src).toContain('testID="activity-not-found"');
  });

  it("surfaces the recorder's own sync state rather than assuming it", () => {
    expect(src).toMatch(/hike\.syncState/);
  });
});
