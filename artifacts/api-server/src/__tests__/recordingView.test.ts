import { describe, expect, it } from "vitest";
import {
  chromeFor, isUserGesture, nextFollowState, PLANNED_COLOR, shouldRecentre,
  TRACK_COLOR, type FollowState,
} from "../services/track/recordingView";

const following: FollowState = { following: true, offCentre: false };
const released: FollowState = { following: false, offCentre: true };

describe("following the walker", () => {
  it("keeps following as points arrive", () => {
    expect(nextFollowState(following, { kind: "point" })).toEqual(following);
  });

  it("lets go when the person moves the map", () => {
    /* They are looking at something. Dragging the map back under them is the
       behaviour that makes people put the phone away. */
    expect(nextFollowState(following, { kind: "gesture" })).toEqual(released);
  });

  it("stays let go while more points arrive", () => {
    expect(nextFollowState(released, { kind: "point" })).toEqual(released);
  });

  it("picks following back up on recentre", () => {
    expect(nextFollowState(released, { kind: "recenter" })).toEqual(following);
  });

  it("only counts a move as the person's when it carries their input", () => {
    /* Programmatic and human movement arrive as the same event. Without this
       the first GPS fix switches following off, so it never follows at all. */
    expect(isUserGesture({ originalEvent: { type: "touchstart" } })).toBe(true);
    expect(isUserGesture({})).toBe(false);
    expect(isUserGesture(null)).toBe(false);
    expect(isUserGesture(undefined)).toBe(false);
  });
});

describe("moving the map for a new fix", () => {
  it("ignores a fix that has barely moved", () => {
    /* GPS wanders a few metres while somebody stands still. Re-centring on
       that makes the map twitch and costs an animation a second. */
    expect(shouldRecentre(following, 2)).toBe(false);
    expect(shouldRecentre(following, 7.9)).toBe(false);
  });

  it("moves for a fix that has actually gone somewhere", () => {
    expect(shouldRecentre(following, 8)).toBe(true);
    expect(shouldRecentre(following, 40)).toBe(true);
  });

  it("never moves the map once the person has taken hold of it", () => {
    expect(shouldRecentre(released, 500)).toBe(false);
  });
});

describe("what the map shows while recording", () => {
  it("puts search and route drawing away", () => {
    const chrome = chromeFor(true);
    expect(chrome.search).toBe(false);
    expect(chrome.planning).toBe(false);
  });

  it("keeps the basemap switch and the way back to your position", () => {
    /* Switching to satellite to read the ground, and recentring after a pan,
       are the two things actually used on a hill. */
    const chrome = chromeFor(true);
    expect(chrome.layers).toBe(true);
    expect(chrome.recenter).toBe(true);
  });

  it("gives everything back when not recording", () => {
    expect(chromeFor(false)).toEqual({
      search: true, planning: true, layers: true, recenter: true,
    });
  });
});

describe("telling the two lines apart", () => {
  it("draws the recorded track and a planned route in different colours", () => {
    /* Both on screen in one colour makes the comparison impossible, and the
       comparison is the only reason to draw both. */
    
    expect(TRACK_COLOR).not.toBe(PLANNED_COLOR);
  });
});
