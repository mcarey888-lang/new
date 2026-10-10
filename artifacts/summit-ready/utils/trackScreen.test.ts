import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Track screen's promises, checked against the screen.
 *
 * Structural, in the style this repo already uses for screens: the value is
 * in catching a later edit that quietly breaks a rule nobody remembers, not
 * in proving React renders.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const TRACK = read("components/SharedTrackScreen.tsx");
const TRACK_CODE = code(TRACK);

describe("starting a hike never waits for anything", () => {
  it("does not disable Start on GPS", () => {
    /* canStart() always returns true and is tested separately. What matters
       here is that nothing else creeps in beside it. */
    expect(TRACK_CODE).toMatch(/disabled=\{starting \|\| !canStart\(gps\)\}/);
    expect(TRACK_CODE).not.toMatch(/disabled=\{[^}]*gps\s*!==\s*["']ready["']/);
    expect(TRACK_CODE).not.toMatch(/disabled=\{[^}]*isOffline/);
  });

  it("does not await anything before navigating to the recorder", () => {
    const start = TRACK_CODE.slice(
      TRACK_CODE.indexOf("const start = useCallback"),
      TRACK_CODE.indexOf("const resume = useCallback"),
    );
    expect(start).toContain("router.push");
    /* An await here is a hike that does not begin until a network call
       finishes, which is the fault this whole design avoids. */
    expect(start).not.toMatch(/\bawait\b/);
  });
});

describe("two taps must not make two activities", () => {
  it("sets its guard synchronously, before anything else", () => {
    const start = TRACK_CODE.slice(TRACK_CODE.indexOf("const start = useCallback"));
    const guard = start.indexOf("startedRef.current = true");
    const push = start.indexOf("router.push");
    expect(guard).toBeGreaterThan(-1);
    /* A ref, not state: state is applied on the next render, and two taps a
       frame apart both read the old value. */
    expect(guard).toBeLessThan(push);
    expect(start).toMatch(/if \(startedRef\.current\) return;/);
  });

  it("guards resume the same way", () => {
    const resume = TRACK_CODE.slice(TRACK_CODE.indexOf("const resume = useCallback"));
    expect(resume).toMatch(/if \(startedRef\.current \|\| !activeHike\) return;/);
  });
});

describe("an existing recording is resumed, not replaced", () => {
  it("shows resume instead of start while one is live", () => {
    expect(TRACK_CODE).toMatch(/activeHike \?/);
    expect(TRACK_CODE).toMatch(/restore: "1"/);
  });

  it("drops a session too old to resume rather than offering it forever", () => {
    expect(TRACK_CODE).toMatch(/RESUME_WINDOW_MS/);
    expect(TRACK_CODE).toMatch(/discardActiveHike/);
  });
});

describe("context does not leak between Training and Expeditions", () => {
  it("clears a context belonging to the other shell", () => {
    expect(TRACK_CODE).toMatch(/isUsableIn\(context, shellMode\)/);
    expect(TRACK_CODE).toMatch(/setContext\(FREE_HIKE\)/);
    expect(TRACK_CODE).toMatch(/clearPendingHikeSelection/);
  });

  it("persists the selection so a detour does not lose it", () => {
    /* Search and the route planner are separate screens; coming back to a
       reset selection is how people start the wrong recording. */
    expect(TRACK_CODE).toMatch(/savePendingHikeSelection\(storedFromContext\(context, userId\)\)/);
    expect(TRACK_CODE).toMatch(/readPendingHikeSelection/);
  });

  it("hydrates once rather than fighting the user's choice", () => {
    expect(TRACK_CODE).toMatch(/if \(!userId \|\| hydrated\) return;/);
  });
});

describe("the map and its attribution", () => {
  it("uses the shared map rather than a second one", () => {
    expect(TRACK_CODE).toMatch(/<TrackMap/);
    expect(TRACK_CODE).not.toMatch(/hike-map/);
  });

  it("lifts the attribution clear of the sheet", () => {
    /* OS licensing requires it stay visible, and the sheet sits exactly
       where MapLibre puts it. */
    expect(TRACK_CODE).toMatch(/type: "bottomInset"/);
    expect(TRACK_CODE).toMatch(/onLayout=\{e => setSheetHeight/);
  });
});

describe("what the sheet says", () => {
  it("states where the recording is kept", () => {
    expect(TRACK).toContain("Saved on your phone. Syncs when connected.");
  });

  it("does not claim maps are downloaded", () => {
    /* Recording offline and having offline maps are different things, and
       the old screen's "OFFLINE READY" rail blurred them. */
    expect(TRACK).not.toMatch(/offline map|maps downloaded|OFFLINE READY/i);
  });

  it("carries no internal vocabulary", () => {
    expect(TRACK).not.toMatch(/Canonical route ready|canonicalRouteReady/);
  });

  it("keeps the back way out when opened from another screen", () => {
    expect(TRACK_CODE).toMatch(/params\.from === "push"/);
    expect(TRACK_CODE).toMatch(/router\.back\(\)/);
  });
});

describe("touch targets and safe areas", () => {
  it("gives the primary actions a thumb-sized target", () => {
    for (const style of ["start:", "resumeRow:", "choice:"]) {
      const block = TRACK.slice(TRACK.indexOf(style), TRACK.indexOf(style) + 320);
      expect(block, `${style} needs a minHeight`).toMatch(/minHeight: (5[6-9]|6[0-9]|[7-9][0-9])/);
    }
  });

  it("respects the bottom safe area", () => {
    expect(TRACK_CODE).toMatch(/Math\.max\(insets\.bottom, 12\)/);
    expect(TRACK_CODE).toMatch(/insets\.top \+ 8/);
  });
});


const REC = read("app/hike-tracking.tsx");
const REC_CODE = code(REC);

describe("the recording screen", () => {
  it("records on the shared map, not a second one", () => {
    /* Recording used to run on a Leaflet page with its own tiles and no
       basemap switch, so the one thing people want on a hill — satellite to
       read the ground — was the one thing recording could not do. */
    expect(REC_CODE).toContain("/route-map?recording=1");
    expect(REC_CODE).not.toContain("/hike-map");
  });

  it("shows the three metrics that get read at arm's length", () => {
    const primary = REC.slice(REC.indexOf("<View style={s.primaryStats}>"));
    const block = primary.slice(0, primary.indexOf("</View>\n\n"));
    for (const label of ["Distance", "Ascent", "Time"]) {
      expect(block).toContain(`>${label}</Text>`);
    }
  });

  it("calls the clock Time, because that is what it measures", () => {
    /* It is wall clock minus pauses the person took by hand. Nothing here
       detects a stop, so standing still counts, and "Moving time" would be
       a claim this recorder cannot make. */
    expect(REC_CODE).not.toMatch(/Moving time|movingTime/i);
    expect(REC_CODE).toMatch(/formatTime\(elapsedSecs\)[\s\S]{0,400}>Time<\/Text>/);
  });

  it("keeps the other metrics, below", () => {
    const secondary = REC.slice(REC.indexOf("<View style={s.statsRow}>"));
    expect(secondary.slice(0, 900)).toContain("Altitude");
    expect(secondary.slice(0, 900)).toContain("Descended");
  });

  it("gives the clock digits that do not jitter", () => {
    /* Proportional digits shift the time sideways every second, which on a
       glanceable readout is the difference between reading it and watching
       it move. */
    expect(REC_CODE).toMatch(/fontVariant: \["tabular-nums"\]/);
  });
});


describe("Map and Progress, for an expedition stage", () => {
  it("offers the switch only where there is a mountain behind it", () => {
    /* A switch with one meaningful side teaches people to ignore it. */
    expect(REC_CODE).toMatch(/const showProgressSwitch = !isIdle\s*\n\s*&& hillMeta\.trackingMode === "expedition-route"\s*\n\s*&& !!trackedExpedition;/);
  });

  it("opens on the map, not on progress", () => {
    /* The hike is the thing happening. */
    expect(REC_CODE).toMatch(/useState<"map" \| "progress">\("map"\)/);
  });

  it("reuses the existing mountain rather than drawing another", () => {
    const panel = read("components/track/TrackProgressPanel.tsx");
    expect(panel).toMatch(/import MountainProgress from "@\/components\/MountainProgress"/);
    expect(panel).toContain("selectExpeditionPresentation");
    /* No second progress bar, no invented graphic. */
    expect(panel).not.toMatch(/ProgressBar|<Svg|LinearGradient/);
  });

  it("feeds the mountain the ascent recorded so far, so the fill moves", () => {
    expect(REC_CODE).toMatch(/<TrackProgressPanel expedition=\{trackedExpedition\} recordedGainM=\{elevGainM\} \/>/);
  });

  it("says what is banked and what is only recorded, separately", () => {
    const panel = code(read("components/track/TrackProgressPanel.tsx"));
    /* Ascent is credited when the hike is saved. A caption folding it into
       the banked figure claims a ledger entry that does not exist yet. */
    expect(panel).toContain("liveProgressCaption");
  });

  it("names an unreadable expedition instead of drawing an empty mountain", () => {
    const panel = read("components/track/TrackProgressPanel.tsx");
    expect(panel).toContain("Expedition progress is unavailable right now.");
  });
});

describe("the recorded line only contains fixes that passed the filter", () => {
  it("guards every point sent to the map", () => {
    /* Three watchers feed the map. Each must reject an implausible fix
       before drawing it, or the line jumps to wherever the signal bounced. */
    const sends = REC_CODE.split("sendPointToMap(").length - 1;
    const guards = REC_CODE.split("isPlausiblePoint(").length - 1;
    expect(sends).toBeGreaterThan(0);
    /* One guard per send site, plus the definition and the batch drain. */
    expect(guards).toBeGreaterThanOrEqual(sends);
  });

  it("does not draw the warm-up fix as part of the track", () => {
    /* It is taken at Balanced accuracy to be fast, skips the plausibility
       filter, and is never pushed into trackPoints. Drawn as a track point
       it starts the line 50-100 m out and then jumps to the first real fix,
       and the line on screen disagrees with the track that gets saved. */
    const start = REC_CODE.indexOf("if (initialPosRef.current) {");
    const block = REC_CODE.slice(start, start + 200);
    expect(block).toContain("sendLocateToMap(");
    expect(block).not.toContain("sendPointToMap(");
  });

  it("keeps both rejection rules", () => {
    expect(REC_CODE).toMatch(/GPS_MAX_ACCURACY_M\s*=\s*25/);
    expect(REC_CODE).toMatch(/GPS_MAX_SPEED_KMH\s*=\s*20/);
    /* The background task applies the accuracy cap on its own, because its
       points never pass through the foreground watchers. */
    expect(REC_CODE).toMatch(/loc\.coords\.accuracy > GPS_MAX_ACCURACY_M\) continue;/);
  });
});
