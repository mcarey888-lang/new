import { describe, expect, it } from "vitest";
import { liveProgress, liveProgressCaption } from "./liveProgress";

const base = { currentSimulatedElevationM: 1200, targetSimulatedElevationM: 3000 };

describe("the mountain filling while you climb", () => {
  it("adds the hike so far to what is already banked", () => {
    const p = liveProgress(base, 300);
    expect(p.bankedM).toBe(1200);
    expect(p.liveM).toBe(300);
    expect(p.shownM).toBe(1500);
    expect(p.percent).toBeCloseTo(0.5);
  });

  it("keeps the existing limit at the summit", () => {
    /* An expedition does not go past its own summit because somebody kept
       walking. The committed calculation clamps, and so does this. */
    const p = liveProgress(base, 5000);
    expect(p.percent).toBe(1);
    expect(p.atTarget).toBe(true);
  });

  it("shows banked progress before anything is recorded", () => {
    const p = liveProgress(base, 0);
    expect(p.shownM).toBe(1200);
    expect(p.percent).toBeCloseTo(0.4);
  });

  it("treats missing or nonsense figures as nothing, not as zero progress of an unknown target", () => {
    const p = liveProgress({ currentSimulatedElevationM: NaN, targetSimulatedElevationM: 0 }, -5);
    expect(p.percent).toBe(0);
    expect(p.atTarget).toBe(false);
    expect(liveProgressCaption(p)).toBeNull();
  });
});

describe("what the caption claims", () => {
  it("keeps the recorded part separate from the banked part", () => {
    /* It is credited when the hike is saved, not while it is walked.
       Folding it into the banked figure claims a ledger entry that does
       not exist yet. */
    const caption = liveProgressCaption(liveProgress(base, 300))!;
    expect(caption).toContain("1200 m banked");
    expect(caption).toContain("+300 m this hike");
  });

  it("says how much is left", () => {
    expect(liveProgressCaption(liveProgress(base, 300))).toContain("1500 m to go");
  });

  it("says the target is reached rather than reporting a negative remainder", () => {
    const caption = liveProgressCaption(liveProgress(base, 2000))!;
    expect(caption).toContain("target reached");
    expect(caption).not.toMatch(/-\d/);
  });

  it("reads plainly before a hike has recorded anything", () => {
    expect(liveProgressCaption(liveProgress(base, 0))).toBe("1200 m of 3000 m · 1800 m to go");
  });
});
