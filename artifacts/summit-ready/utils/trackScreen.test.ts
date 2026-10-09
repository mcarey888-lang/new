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
