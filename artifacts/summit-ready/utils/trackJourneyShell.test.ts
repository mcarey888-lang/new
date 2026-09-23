/**
 * Track journey — the invariants that must survive a presentation pass.
 *
 * These are not style checks. Track is the one screen where a visual change
 * could quietly break something that matters on a mountainside, so the rules
 * that protect a recording are asserted at the source level.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const TRACK = read("app/hike-tracking.tsx");
const TRACK_CODE = code(TRACK);

describe("START never waits", () => {
  it("commits the activity and its checkpoint before permissions, GPS or any server call", () => {
    const impl = TRACK_CODE.slice(
      TRACK_CODE.indexOf("const startTrackingImpl"),
      TRACK_CODE.indexOf("const startTracking ="),
    );
    const commit = impl.indexOf("await saveActiveSession()");
    expect(commit).toBeGreaterThan(-1);

    /* Everything that could block must come AFTER the commit. */
    for (const later of [
      "requestBackgroundPermissionsAsync",
      "startLocationUpdatesAsync",
      "watchPositionAsync",
      "logHillSessionStarted",
    ]) {
      const at = impl.indexOf(later);
      expect(at, `${later} must not run before the activity is committed`).toBeGreaterThan(commit);
    }
  });

  it("does not gate the Start button on GPS, network or a route name", () => {
    expect(TRACK_CODE).toMatch(/const canStart\s*=\s*true;/);
    /* The name falls back to a local title rather than blocking. */
    expect(TRACK_CODE).toMatch(/routeName\.trim\(\) \|\| localActivityTitle\(\)/);
  });

  it("reports GPS and connectivity as information, never as a gate", () => {
    const impl = TRACK_CODE.slice(
      TRACK_CODE.indexOf("const startTrackingImpl"),
      TRACK_CODE.indexOf("const startTracking ="),
    );
    expect(impl).not.toMatch(/if \(!gpsReady\).*return/s);
    expect(impl).not.toMatch(/if \(isOffline\).*return/s);
  });
});

describe("one physical activity, one canonical identity", () => {
  it("mints the identity once, in a ref, at mount", () => {
    expect(TRACK_CODE).toMatch(/routeIdRef\s*=\s*useRef\(\s*Crypto\.randomUUID\(\),?\s*\)/);
    /* Exactly one UUID is generated in this screen. */
    expect(TRACK_CODE.match(/Crypto\.randomUUID\(\)/g) ?? []).toHaveLength(1);
  });

  it("uses that same identity for the credit, the completion and the details", () => {
    expect(TRACK_CODE).toMatch(/activityId: routeId\b/);
    expect(TRACK_CODE).toMatch(/activityId: routeIdRef\.current/);
  });

  it("never re-mints an identity during completion", () => {
    const completion = TRACK_CODE.slice(TRACK_CODE.indexOf("finishHike"));
    expect(completion).not.toMatch(/randomUUID/);
  });
});

describe("the offline-first architecture is intact", () => {
  it("still saves to the device and still says so", () => {
    expect(TRACK_CODE).toMatch(/saveActiveSession/);
    expect(TRACK_CODE).toMatch(/offlineNotice\(/);
    expect(TRACK).toMatch(/saves to this device/);
  });

  it("keeps the checkpoint and batch machinery", () => {
    expect(TRACK_CODE).toMatch(/batchStorageKey|selectBatchKeys|shouldRestoreCheckpoint/);
    expect(TRACK_CODE).toMatch(/HIKE_LOCATION_TASK/);
  });

  it("still restores a hike the OS killed", () => {
    expect(TRACK_CODE).toMatch(/params\.restore === "1"/);
    expect(TRACK_CODE).toMatch(/readBackgroundActiveHike|readActiveHike/);
  });
});

describe("Activity Complete is not rebuilt here", () => {
  it("still renders the extracted view rather than a second implementation", () => {
    expect(TRACK_CODE).toMatch(/ActivityCompleteView/);
    const view = code(read("components/track/ActivityCompleteView.tsx"));
    /* It owns no data source — everything arrives as props. */
    expect(view).not.toMatch(/useApp\(|fetch\(|randomUUID/);
  });
});

describe("Track draws on the shared system", () => {
  it("uses the shared tokens rather than one-off colours", () => {
    expect(TRACK_CODE).toMatch(/from "@\/constants\/tokens"/);
    expect(TRACK_CODE).toMatch(/BASECAMP\.ink/);
  });

  it("keeps every control at the minimum touch target", () => {
    for (const style of ["confirmPrimary", "confirmCancel", "nearbyBtn"]) {
      const at = TRACK.indexOf(`  ${style}: {`);
      expect(at, style).toBeGreaterThan(-1);
      const block = TRACK.slice(at, TRACK.indexOf("},", at));
      expect(block, style).toMatch(/minHeight: (4[4-9]|[5-9]\d)/);
    }
  });
});
