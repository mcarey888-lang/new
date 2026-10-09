/**
 * What to say about GPS before a hike starts.
 *
 * Informational only. Nothing here may gate Start: a fix can take a minute
 * under trees or in a valley, and an app that will not begin recording until
 * it has one is an app people stop trusting at the trailhead. The recorder
 * commits the activity first and attaches points as they arrive.
 */

export type GpsState =
  | "checking"      // permission or first fix still being worked out
  | "ready"         // a fix good enough to record with
  | "coarse"        // a fix, but a poor one
  | "searching"     // permission granted, no fix yet
  | "denied"        // the person said no
  | "unavailable";  // no location services on this device

/** Beyond this the fix is too loose to call a position. */
export const COARSE_ACCURACY_M = 30;

export interface GpsReading {
  permission: "granted" | "denied" | "undetermined";
  accuracyM: number | null;
  /** False on a device or browser with no location services at all. */
  available?: boolean;
}

export function gpsState(reading: GpsReading): GpsState {
  if (reading.available === false) return "unavailable";
  if (reading.permission === "denied") return "denied";
  if (reading.permission === "undetermined") return "checking";
  if (reading.accuracyM === null) return "searching";
  return reading.accuracyM <= COARSE_ACCURACY_M ? "ready" : "coarse";
}

export interface GpsDisplay {
  label: string;
  /** "good" | "working" | "bad" — the dot beside it. */
  tone: "good" | "working" | "bad";
}

export function gpsDisplay(state: GpsState, accuracyM: number | null): GpsDisplay {
  switch (state) {
    case "ready":
      return { label: accuracyM ? `GPS ready · ±${Math.round(accuracyM)} m` : "GPS ready", tone: "good" };
    case "coarse":
      /* Named rather than dressed up as ready. A 60 m fix draws a track
         through the next field, and somebody should know that before they
         rely on the line. */
      return { label: `Weak GPS · ±${Math.round(accuracyM ?? 0)} m`, tone: "working" };
    case "searching":
      return { label: "Finding GPS…", tone: "working" };
    case "checking":
      return { label: "Checking GPS…", tone: "working" };
    case "denied":
      return { label: "Location off — no track will be recorded", tone: "bad" };
    case "unavailable":
      return { label: "No location on this device", tone: "bad" };
  }
}

/**
 * Whether Start may be pressed. Always.
 *
 * Written as a function, and tested, because "just disable it until we have a
 * fix" is the obvious thing to do and it is wrong: offline-first means the
 * activity exists the moment somebody asks for it, with points attached when
 * the hardware catches up.
 */
export function canStart(_state: GpsState): boolean {
  return true;
}
