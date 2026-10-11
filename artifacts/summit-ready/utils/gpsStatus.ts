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

/**
 * Browser GPS uses its own watch lifecycle. Expo Location's web subscriber in
 * SDK 54 calls a missing removeSubscription method when its last watch ends.
 * This watcher is only for the passive pre-recording status, not hike recording.
 */
export function watchBrowserGpsStatus(
  geolocation: Pick<Geolocation, "watchPosition" | "clearWatch"> | null,
  onReading: (state: GpsState, accuracyM: number | null) => void,
): () => void {
  let closed = false;
  let watchId: number | null = null;
  if (!geolocation) {
    onReading("unavailable", null);
  } else {
    onReading("searching", null);
    try {
      watchId = geolocation.watchPosition(
        position => {
          if (closed) return;
          const raw = position.coords.accuracy;
          const accuracy = Number.isFinite(raw) && raw >= 0 ? raw : null;
          onReading(gpsState({ permission: "granted", accuracyM: accuracy }), accuracy);
        },
        error => {
          if (closed) return;
          onReading(error.code === 1 ? "denied" : error.code === 3 ? "searching" : "unavailable", null);
        },
        { enableHighAccuracy: false, maximumAge: 4000, timeout: 15000 },
      );
    } catch {
      onReading("unavailable", null);
    }
  }
  return () => {
    if (closed) return;
    closed = true;
    if (watchId !== null) geolocation?.clearWatch(watchId);
  };
}
