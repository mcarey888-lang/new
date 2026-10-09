import { describe, expect, it } from "vitest";
import { canStart, COARSE_ACCURACY_M, gpsDisplay, gpsState, type GpsState } from "./gpsStatus";

describe("reading the GPS", () => {
  it("is ready on a tight fix", () => {
    expect(gpsState({ permission: "granted", accuracyM: 8 })).toBe("ready");
    expect(gpsState({ permission: "granted", accuracyM: COARSE_ACCURACY_M })).toBe("ready");
  });

  it("calls a loose fix weak rather than ready", () => {
    /* A 60 m fix draws the track through the next field. */
    expect(gpsState({ permission: "granted", accuracyM: COARSE_ACCURACY_M + 1 })).toBe("coarse");
    expect(gpsDisplay("coarse", 60).label).toMatch(/weak/i);
  });

  it("is searching with permission but no fix", () => {
    expect(gpsState({ permission: "granted", accuracyM: null })).toBe("searching");
    expect(gpsDisplay("searching", null).label).toBe("Finding GPS…");
  });

  it("separates a refusal from a device that has no GPS", () => {
    expect(gpsState({ permission: "denied", accuracyM: null })).toBe("denied");
    expect(gpsState({ permission: "granted", accuracyM: 5, available: false })).toBe("unavailable");
    expect(gpsDisplay("denied", null).label).not.toBe(gpsDisplay("unavailable", null).label);
  });

  it("says plainly that a refusal means no track", () => {
    /* Otherwise somebody walks six hours and finds an empty map. */
    expect(gpsDisplay("denied", null).label).toMatch(/no track/i);
    expect(gpsDisplay("denied", null).tone).toBe("bad");
  });

  it("shows the accuracy when it has one", () => {
    expect(gpsDisplay("ready", 12).label).toContain("±12 m");
    expect(gpsDisplay("ready", null).label).toBe("GPS ready");
  });
});

describe("whether Start may be pressed", () => {
  it("is always yes", () => {
    /* The whole offline-first promise in one assertion: a fix can take a
       minute in a valley, and the activity must exist the moment somebody
       asks for it. Disabling Start until GPS arrives is the obvious thing
       to do and it is the bug. */
    const states: GpsState[] = ["checking", "ready", "coarse", "searching", "denied", "unavailable"];
    for (const state of states) expect(canStart(state)).toBe(true);
  });
});
