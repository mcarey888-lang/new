import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planPhaseSpans } from "./basecampPresentation";
import { readyBrief } from "./trackPresentation";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/* ──────────────────────────────────────────────────────────────────────────
   A. Full plan — the block's shape, before any one week of it
   ────────────────────────────────────────────────────────────────────── */
describe("planPhaseSpans", () => {
  const plan = [
    { weekNumber: 1, phase: "Base" },
    { weekNumber: 2, phase: "Base" },
    { weekNumber: 3, phase: "Build" },
    { weekNumber: 4, phase: "Build" },
    { weekNumber: 5, phase: "Peak" },
    { weekNumber: 6, phase: "Taper" },
  ];

  it("merges consecutive weeks of one phase into a single span", () => {
    expect(planPhaseSpans(plan)).toEqual([
      { phase: "Base",  weeks: 2, firstWeek: 1, lastWeek: 2, isCurrent: false },
      { phase: "Build", weeks: 2, firstWeek: 3, lastWeek: 4, isCurrent: false },
      { phase: "Peak",  weeks: 1, firstWeek: 5, lastWeek: 5, isCurrent: false },
      { phase: "Taper", weeks: 1, firstWeek: 6, lastWeek: 6, isCurrent: false },
    ]);
  });

  it("lights exactly the span holding the current week", () => {
    const spans = planPhaseSpans(plan, 4);
    expect(spans.filter(s => s.isCurrent).map(s => s.phase)).toEqual(["Build"]);
  });

  it("lights nothing when no week is current — it never guesses one", () => {
    expect(planPhaseSpans(plan, null).some(s => s.isCurrent)).toBe(false);
    expect(planPhaseSpans(plan, 99).some(s => s.isCurrent)).toBe(false);
  });

  it("keeps a phase that returns later as its own span, in plan order", () => {
    const spans = planPhaseSpans([
      { weekNumber: 1, phase: "Base" },
      { weekNumber: 2, phase: "Build" },
      { weekNumber: 3, phase: "Base" },
    ]);
    expect(spans.map(s => `${s.phase}@${s.firstWeek}`)).toEqual(["Base@1", "Build@2", "Base@3"]);
  });

  it("segment widths add up to the real number of weeks", () => {
    expect(planPhaseSpans(plan).reduce((n, s) => n + s.weeks, 0)).toBe(plan.length);
  });

  it("is empty for an empty or missing plan rather than throwing", () => {
    expect(planPhaseSpans([])).toEqual([]);
    expect(planPhaseSpans(null)).toEqual([]);
    expect(planPhaseSpans(undefined)).toEqual([]);
  });
});

describe("Full plan presentation", () => {
  const plan = read("app/(tabs)/plan.tsx");

  it("states the progression before it lists any week", () => {
    expect(plan.indexOf("phaseArcTrack")).toBeLessThan(plan.indexOf("<WeekCard"));
  });

  it("carries the phase as a rail rather than a wash behind the card", () => {
    expect(plan).toContain("styles.phaseRail");
    /* the full-bleed tint and the per-card banner are both gone */
    expect(plan).not.toContain("currentBanner");
    expect(plan).not.toContain('pc + "08"');
  });

  it("no longer nests a card inside a card for every session", () => {
    /* session rows are separated by a hairline, not by their own surface */
    const rowStyle = plan.slice(plan.indexOf("  sessionRow: {"), plan.indexOf("  sessionRowDone:"));
    expect(rowStyle).toContain("borderTopWidth");
    expect(rowStyle).not.toContain("backgroundColor");
  });

  it("keeps every existing week action — nothing was dropped in the restyle", () => {
    for (const handler of ["onEditSession", "onSwapExercise", "onChangeHill",
                           "onScheduleSession", "onToggleSession", "onSubmitWeek",
                           "onSessionPress"]) {
      expect(plan).toContain(handler);
    }
  });

  it("keeps the FREE / Pro entitlement gate on the full plan", () => {
    expect(plan).toContain("const isPlanLocked = !isSubscribed && week.weekNumber > 1");
    expect(plan).toContain('router.push("/paywall")');
  });

  it("leaves the approved Schedule composition alone", () => {
    /* the locked week strip, the plan-start note and the THIS WEEK rail */
    expect(plan).toContain("viewedWeekDays");
    expect(plan).toContain("planStartNote");
    expect(plan).toContain("dash.weekCardVisual");
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   B. Training session
   ────────────────────────────────────────────────────────────────────── */
describe("Training session", () => {
  const session = read("app/session-detail.tsx");
  const at = (s: string) => session.indexOf(s);

  it("reads type → why → target → instructions", () => {
    expect(at('title="Why this session"')).toBeLessThan(at('title="The prescription"'));
    expect(at('title="The prescription"')).toBeLessThan(at('title="Coaching notes"'));
    expect(at('title="Coaching notes"')).toBeLessThan(at('title="Where and when"'));
    expect(at('title="Where and when"')).toBeLessThan(at('title="Complete this session"'));
  });

  it("makes starting the one filled control on the screen", () => {
    expect(session).toContain("Start session");
    expect(session).toContain("backgroundColor: BASECAMP.accent");
  });

  it("keeps the existing WHY THIS SESSION logic", () => {
    expect(session).toContain("sessionPurpose({");
  });

  it("carries the same tracking params into Track", () => {
    for (const p of ["hillSessionKey", "hillName", "targetReps",
                     "estimatedGainPerRep", "estimatedTotalGain"]) {
      expect(session).toContain(p);
    }
  });

  /* THE ARTWORK RULE. Generated exercise artwork carries its own lettering,
     so it is never bleed imagery — it stays contained. */
  it("never puts generated exercise artwork behind the hero", () => {
    const hero = session.slice(at("<SRHeroFrame"), at("</SRHeroFrame>"));
    expect(hero).toContain("heroImageSource");
    expect(hero).not.toContain('artwork="generated"');
    expect(hero).not.toContain("exerciseArtwork");
  });

  it("keeps the exercise illustration contained, with nothing laid over it", () => {
    expect(session).toContain("exercisePlate");
    const plate = session.slice(at("<View style={s.exercisePlate}>"), at("</View>\n              )}"));
    expect(plate).toContain("exerciseArtwork");
    expect(plate).toContain('resizeMode="contain"');
    expect(plate).not.toContain("<Text");
  });

  it("falls the hero back to place photography, not to invented imagery", () => {
    expect(session).toContain("sessionImageSubject({ mountainName:");
    expect(session).toContain("mountain-image?name=");
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   C. Track Ready — what / where / is the phone ready / can I start
   ────────────────────────────────────────────────────────────────────── */
describe("readyBrief", () => {
  it("names the session when the launch came from one", () => {
    const b = readyBrief({ sessionLabel: "Hill Repeats", hillName: "High Knott" });
    expect(b.what).toBe("Hill Repeats");
    expect(b.where).toBe("High Knott");
    expect(b.isOpenGround).toBe(false);
  });

  it("names the hill when there is no session label", () => {
    const b = readyBrief({ hillName: "High Knott" });
    expect(b.what).toBe("High Knott");
    /* the hill is already the headline; it is not repeated underneath */
    expect(b.where).toBe("No route chosen — record any path");
    expect(b.isOpenGround).toBe(true);
  });

  it("puts a chosen route in WHERE alongside the hill", () => {
    const b = readyBrief({ hillName: "High Knott", routeName: "North Ridge" });
    expect(b.where).toBe("North Ridge");
    expect(b.isOpenGround).toBe(false);
  });

  it("answers both questions for a bare free hike rather than returning nothing", () => {
    const b = readyBrief({});
    expect(b.what).toBe("Free hike");
    expect(b.where).toBe("No route chosen — record any path");
    expect(b.isOpenGround).toBe(true);
  });

  it("uses a name the user chose when there is no session, hill or route", () => {
    expect(readyBrief({ activityTitle: "Sunrise loop" }).what).toBe("Sunrise loop");
  });

  it("treats blank strings as absent", () => {
    const b = readyBrief({ sessionLabel: "  ", hillName: "", routeName: "   " });
    expect(b.what).toBe("Free hike");
    expect(b.isOpenGround).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   C/D. The Track screen itself
   ────────────────────────────────────────────────────────────────────── */
describe("Track screen", () => {
  const track = read("app/hike-tracking.tsx");

  it("mints exactly one activity id, and only at the top of the screen", () => {
    expect(track.match(/randomUUID\(\)/g) ?? []).toHaveLength(1);
    expect(track).toContain("routeIdRef");
  });

  it("never gates Start on GPS or connectivity, but protects canonical handoffs", () => {
    const startGuard = track.match(/const canStart = !canonicalRouteIntent \|\|([\s\S]*?canonicalContextFresh\);)/)?.[0];
    expect(startGuard).toBeDefined();
    expect(startGuard).not.toMatch(/\bgpsReady\b|\bisOffline\b/);
    expect(startGuard).toContain("!canonicalRouteContextPending");
    expect(startGuard).toContain("!canonicalRouteContextInvalid");
    expect(track).toContain("Connectivity is advisory only");
  });

  it("does not echo its own placeholder title back as the activity", () => {
    expect(track).toContain("defaultTitleRef");
    expect(track).toContain("routeName === defaultTitleRef.current ? null : routeName");
  });

  it("answers WHERE on the ready sheet", () => {
    expect(track).toContain("readyBrief({");
    expect(track).toContain("brief.where");
  });

  it("states the recording state once, not twice", () => {
    /* the drawer repeats the header pill only when it can add "· OFFLINE" */
    const drawer = track.slice(track.indexOf("The sheet header pill above"));
    expect(drawer.slice(0, 400)).toContain("{isOffline && (");
  });

  it("keeps pause, resume and finish on the recording sheet", () => {
    expect(track).toContain("isPaused ? resumeTracking : pauseTracking");
    expect(track).toContain("Finish Hike");
  });

  it("keeps the offline checkpoint and outbox paths", () => {
    expect(track).toContain("writeActiveHike");
    expect(track).toContain("retrySyncOutbox");
    expect(track).toContain('syncState: isOffline ? "queued" : "local_only"');
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   E/F. Activity Complete and Activity Details
   ────────────────────────────────────────────────────────────────────── */
describe("Activity complete and details", () => {
  const view = read("components/track/ActivityCompleteView.tsx");

  it("leads with the recorded ascent as the moment", () => {
    expect(view.indexOf("rewardValue")).toBeLessThan(view.indexOf("recordGrid"));
    expect(view).toContain("{fmtM(elevGainM)}");
    expect(view).toContain("ELEVATION GAINED");
  });

  it("takes every consequence from the presentation and invents none", () => {
    expect(view).toContain("completionPresentation");
    expect(view).not.toMatch(/\+\s*\d+\s*%/);
  });

  it("keeps the Activity Details copy exactly", () => {
    expect(view).toContain("ACTIVITY_DETAILS_COPY");
    expect(read("utils/trackPresentation.ts")).toContain("Add photos, notes and details to your hike.");
  });

  it("never implies Save Details is what creates the activity", () => {
    expect(view).toContain("ACTIVITY_DETAILS_COPY.reassurance");
    expect(read("utils/trackPresentation.ts"))
      .toContain("Saved to this device already — this just adds the detail.");
  });
});
