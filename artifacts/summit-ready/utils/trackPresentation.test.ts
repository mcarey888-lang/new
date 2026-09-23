import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DETAILS_COPY, applyDetails, assertSameActivity, availableControls,
  canStartRecording, formatKm, formatMetres, formatPace, gpsLabel, offlineNotice,
  paceMinPerKm, statusLabel, trackContext,
} from "./trackPresentation";

describe("Start is never gated (offline-first is protected)", () => {
  it("is true regardless of network, fix, tiles or name", () => {
    expect(canStartRecording()).toBe(true);
    expect(canStartRecording({ isOffline: true, hasFix: false, hasRouteName: false, hasNetwork: false })).toBe(true);
    expect(canStartRecording({ isOffline: false, hasFix: true, hasRouteName: true, hasNetwork: true })).toBe(true);
  });

  it("offers Start only in the idle phase", () => {
    expect(availableControls("idle").start).toBe(true);
    expect(availableControls("tracking").start).toBe(false);
  });
});

describe("controls survive every phase", () => {
  it("pause while tracking, resume while paused", () => {
    expect(availableControls("tracking")).toMatchObject({ pause: true, resume: false, finish: true });
    expect(availableControls("paused")).toMatchObject({ pause: false, resume: true, finish: true });
  });
  it("finish stays available while paused so a recording cannot be stranded", () => {
    expect(availableControls("paused").finish).toBe(true);
  });
  it("offers nothing once finished", () => {
    expect(availableControls("finished")).toMatchObject({ start: false, pause: false, resume: false, finish: false });
  });
});

describe("missing data degrades, never substitutes", () => {
  it("shows an em dash rather than zero", () => {
    expect(formatMetres(null)).toBe("—");
    expect(formatMetres(undefined)).toBe("—");
    expect(formatMetres(NaN)).toBe("—");
    expect(formatKm(null)).toBe("—");
    expect(formatPace(null)).toBe("—");
  });
  it("still renders a real zero", () => {
    expect(formatMetres(0)).toBe("0 m");
    expect(formatKm(0)).toBe("0.00 km");
  });
  it("withholds pace until there is enough movement to state one", () => {
    expect(paceMinPerKm(0, 600)).toBeNull();
    expect(paceMinPerKm(0.02, 600)).toBeNull();
    expect(paceMinPerKm(2, 0)).toBeNull();
    expect(paceMinPerKm(2, 720)).toBeCloseTo(6, 6);
    expect(formatPace(paceMinPerKm(2, 720))).toBe("6:00 /km");
  });
  it("rolls a 60-second rounding up cleanly", () => {
    expect(formatPace(5.999)).toBe("6:00 /km");
  });
});

describe("offline is a normal condition, not an error", () => {
  it("says recording works offline before starting", () => {
    const n = offlineNotice(true, "idle")!;
    expect(n).toMatch(/works offline/i);
    expect(n).not.toMatch(/error|failed|cannot/i);
  });
  it("reassures mid-recording and promises a later sync", () => {
    expect(offlineNotice(true, "tracking")).toMatch(/Still recording/i);
  });
  it("says nothing when online", () => {
    expect(offlineNotice(false, "tracking")).toBeNull();
  });
  it("surfaces offline in the status pill", () => {
    expect(statusLabel("tracking", true)).toBe("RECORDING · OFFLINE");
    expect(statusLabel("tracking", false)).toBe("RECORDING");
    expect(statusLabel("idle", true)).toBe("READY · OFFLINE");
    expect(statusLabel("paused", false)).toBe("PAUSED");
  });
  it("labels every GPS quality", () => {
    (["acquiring", "good", "weak", "unavailable"] as const)
      .forEach((q) => expect(gpsLabel(q).length).toBeGreaterThan(0));
  });
});

describe("track context", () => {
  it("names the session this recording belongs to", () => {
    expect(trackContext({ sessionLabel: "Hill Session", hillName: "Pendle Hill", routeName: "Big End" }))
      .toEqual({ title: "Hill Session", subtitle: "Pendle Hill · Big End" });
  });
  it("falls back to the hill when there is no session", () => {
    expect(trackContext({ hillName: "Pendle Hill" })).toEqual({ title: "Pendle Hill", subtitle: null });
  });
  it("returns nothing for a standalone recording", () => {
    expect(trackContext({})).toBeNull();
    expect(trackContext({ hillName: "  " })).toBeNull();
  });
});

describe("one physical activity keeps one identity", () => {
  it("holds from start through completion", () => {
    const id = "act-uuid-1";
    expect(assertSameActivity(id, id)).toBe(true);
  });
  it("fails loudly if a second id appears", () => {
    expect(assertSameActivity("act-uuid-1", "act-uuid-2")).toBe(false);
    expect(assertSameActivity("", "")).toBe(false);
  });
});

describe("Activity Details edits the stored activity", () => {
  const existing = { activityId: "act-uuid-1", name: "Tracked Hike", notes: "", photoCount: 0 };

  it("never reassigns the activity id", () => {
    const next = applyDetails(existing, { name: "Pendle sunrise", notes: "Windy", photoCount: 3 });
    expect(next.activityId).toBe("act-uuid-1");
  });
  it("applies only what was edited", () => {
    expect(applyDetails(existing, { notes: "Windy" })).toEqual({
      activityId: "act-uuid-1", name: "Tracked Hike", notes: "Windy", photoCount: 0,
    });
  });
  it("cannot be tricked into changing identity", () => {
    const next = applyDetails(existing, { activityId: "act-uuid-2" } as any);
    expect(next.activityId).toBe("act-uuid-1");
  });
  it("uses the approved wording", () => {
    expect(ACTIVITY_DETAILS_COPY.title).toBe("Activity Details");
    expect(ACTIVITY_DETAILS_COPY.subtitle).toBe("Add photos, notes and details to your hike.");
    expect(ACTIVITY_DETAILS_COPY.cta).toBe("Save Details");
  });
});
