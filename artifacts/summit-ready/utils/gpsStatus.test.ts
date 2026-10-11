import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canStart, COARSE_ACCURACY_M, gpsDisplay, gpsState, watchBrowserGpsStatus, type GpsState } from "./gpsStatus";

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

describe("browser GPS listener lifecycle", () => {
  function setup() {
    let success!: PositionCallback;
    let error!: PositionErrorCallback;
    const geolocation = {
      watchPosition: vi.fn((onPosition: PositionCallback, onError?: PositionErrorCallback | null) => {
        success = onPosition;
        error = onError!;
        return 0;
      }),
      clearWatch: vi.fn(),
    };
    const reading = vi.fn();
    const close = watchBrowserGpsStatus(geolocation, reading);
    return { geolocation, reading, close, success, error };
  }

  it("clears the actual browser watch exactly once, including watch ID zero", () => {
    const { geolocation, close } = setup();
    expect(() => { close(); close(); }).not.toThrow();
    expect(geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("reports real accuracy and ignores queued positions after closing", () => {
    const { success, close, reading } = setup();
    const position = { coords: { accuracy: 12 } } as GeolocationPosition;
    success(position);
    expect(reading).toHaveBeenLastCalledWith("ready", 12);
    close();
    reading.mockClear();
    success(position);
    expect(reading).not.toHaveBeenCalled();
  });

  it("reports denied permission and ignores queued errors after closing", () => {
    const { error, close, reading } = setup();
    error({ code: 1 } as GeolocationPositionError);
    expect(reading).toHaveBeenLastCalledWith("denied", null);
    close();
    reading.mockClear();
    error({ code: 2 } as GeolocationPositionError);
    expect(reading).not.toHaveBeenCalled();
  });

  it("keeps a timeout searching and distinguishes unavailable GPS", () => {
    const { error, reading } = setup();
    error({ code: 3 } as GeolocationPositionError);
    expect(reading).toHaveBeenLastCalledWith("searching", null);
    error({ code: 2 } as GeolocationPositionError);
    expect(reading).toHaveBeenLastCalledWith("unavailable", null);
  });

  it("handles browsers without geolocation or with a failing watch", () => {
    const reading = vi.fn();
    expect(() => watchBrowserGpsStatus(null, reading)()).not.toThrow();
    expect(reading).toHaveBeenLastCalledWith("unavailable", null);
    const geolocation = {
      watchPosition: vi.fn(() => { throw new Error("Geolocation unavailable"); }),
      clearWatch: vi.fn(),
    };
    expect(() => watchBrowserGpsStatus(geolocation, reading)()).not.toThrow();
    expect(reading).toHaveBeenLastCalledWith("unavailable", null);
    expect(geolocation.clearWatch).not.toHaveBeenCalled();
  });

  it("uses browser cleanup on web and removes late native subscriptions", () => {
    const hook = readFileSync(join(__dirname, "../hooks/useGpsStatus.ts"), "utf8");
    expect(hook).toContain('if (Platform.OS === "web")');
    expect(hook).toContain("return watchBrowserGpsStatus(");
    expect(hook).toContain("if (cancelled) watch?.remove()");
    expect(hook).not.toContain("subRef.current?.remove()");
  });
});
