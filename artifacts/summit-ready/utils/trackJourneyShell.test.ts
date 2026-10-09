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
    expect(TRACK_CODE).toMatch(/const canStart = !canonicalRouteIntent \|\|/);
    expect(TRACK_CODE).toMatch(/!canonicalRouteContextPending && !canonicalRouteContextInvalid && canonicalContextFresh/);
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

  it("restores canonical route context by the owner's exact stored identity", () => {
    expect(TRACK_CODE).toMatch(/readCanonicalRouteHandoff\(\{/);
    expect(TRACK_CODE).toMatch(/canonicalRouteHandoffId/);
    expect(TRACK_CODE).toMatch(/canonicalRouteId: canonicalRouteContext\?\.routeId/);
    expect(TRACK_CODE).toMatch(/canonicalMountainId: canonicalRouteContext\?\.mountainId/);
  });

  it("blocks only a canonical-intent Start until local identity and geometry validate", () => {
    expect(TRACK_CODE).toMatch(/if \(canonicalRouteIntent &&/);
    expect(TRACK_CODE).toMatch(/canonicalRouteContextInvalid \|\| !canonicalRouteContext/);
    expect(TRACK_CODE).toMatch(/Canonical route context is unavailable or expired/);
    expect(TRACK_CODE).toMatch(/Return to Mountain Detail/);
  });

  it("draws canonical geometry only after map and local handoff are both ready", () => {
    expect(TRACK_CODE).toMatch(/if \(!mapReady \|\| !canonicalRouteIntent \|\| !canonicalRouteContext\) return;/);
    expect(TRACK_CODE).toMatch(/canonicalRouteMapPoints\(canonicalRouteContext\.geometry\.coordinates\)/);
    /* The planned line the recorded track is compared against. Renamed when
       recording moved onto the shared MapLibre map, whose own "route" and
       "clear" already meant the drawn route. */
    expect(TRACK_CODE).toMatch(/JSON\.stringify\(\{ type: "recPlanned", points \}\)/);
    expect(TRACK_CODE).toMatch(/target\.postMessage\(msg, "\*"\)/);
    expect(TRACK_CODE).toMatch(/webViewRef\.current\.postMessage\(msg\)/);
    expect(TRACK_CODE.match(/setMapReady\(true\)/g) ?? []).toHaveLength(2);
    expect(TRACK_CODE.match(/trackPoints\.current\.length > 0\) replayTrackOnMap\(\)/g) ?? []).toHaveLength(2);
  });

  it("shows optional route start metadata as route facts, not current GPS altitude", () => {
    expect(TRACK_CODE).toMatch(/Route start · \$\{canonicalRouteContext\.startLabel\}/);
    expect(TRACK_CODE).toMatch(/Route start elevation · \$\{fmtM\(canonicalRouteContext\.startElevationM\)\}/);
    expect(TRACK_CODE).toMatch(/typeof canonicalRouteContext\?\.startElevationM === "number"/);
    expect(TRACK_CODE).toMatch(/canonicalRouteContext\?\.startLabel/);
  });

  it("isolates canonical intent from community tracked-route fetches and picker", () => {
    expect(TRACK_CODE).toMatch(/if \(canonicalRouteIntent\) return;[\s\S]*?fetch\(`\$\{API_BASE\}\/tracked-routes\/\$\{routeId\}`\)/);
    expect(TRACK_CODE).toMatch(/if \(canonicalRouteIntent\) return;[\s\S]*?tracked-routes\/nearby/);
    expect(TRACK_CODE).toMatch(/\{!canonicalRouteIntent \? \([\s\S]*?Pick a nearby route/);
    expect(TRACK_CODE).toMatch(/visible=\{nearbyPickerOpen && !canonicalRouteIntent\}/);
    expect(TRACK_CODE).toMatch(/if \(canonicalRouteIntent\) return;[\s\S]*?const rid = params\.referenceRouteId/);
    const communitySync = TRACK_CODE.slice(
      TRACK_CODE.indexOf("const routeSyncId"),
      TRACK_CODE.indexOf("const hillSyncId"),
    );
    expect(communitySync).toMatch(/trackPoints: trackPoints\.current/);
    expect(communitySync).toMatch(/enqueueSyncPending\(userId/);
    expect(communitySync).not.toMatch(/canonicalRouteContext\?\.geometry/);
  });

  it("resolves restored canonical identity before mounting the map", () => {
    expect(TRACK_CODE).toMatch(/if \(restoreCheckpointPending\) return;/);
    expect(TRACK_CODE).toMatch(/restoreCheckpointPending \? \([\s\S]*?<WebView/);
    expect(TRACK_CODE).toMatch(/setRestoredCanonicalRouteIntent\(true\)/);
  });

  it("keeps the canonical SDE route separate from the local activity UUID", () => {
    expect(TRACK_CODE).toMatch(/activityId: routeId,/);
    expect(TRACK_CODE).toMatch(/canonicalRouteId: canonicalRouteContext\?\.routeId/);
    expect(TRACK_CODE).not.toMatch(/activityId:\s*canonicalRouteContext\?\.routeId/);
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

describe("off-route warning", () => {
  /* Added when the detector was wired in. These are source-level because the
     thing worth protecting is not how the banner looks — it is that the
     warning stays a statement of position and never becomes navigation. */

  it("judges every tracking fix, not only some of them", () => {
    /* There are three watchers that record a fix. A warning that only works on
       one of them is worse than none, because it is trusted and silent. */
    const hooks = TRACK_CODE.match(/checkOffRoute\(latitude, longitude/g) ?? [];
    expect(hooks.length).toBe(3);
  });

  it("passes the fix's own accuracy through", () => {
    /* The threshold widens with GPS uncertainty. Dropping the accuracy here
       would silently make every judgement use the cautious default. */
    expect(TRACK_CODE).toContain("loc.coords.accuracy ?? null");
  });

  it("never tells anybody which way to walk", () => {
    /* THE RULE. "Head west" asserts west is walkable, and the straight line
       back to a path can cross a crag that nothing in this data can see. The
       banner renders only the message the detector produced, which is a
       position. */
    const banner = TRACK_CODE.slice(
      TRACK_CODE.indexOf("offRoute?.message"),
      TRACK_CODE.indexOf("offRoute?.message") + 400,
    );
    expect(banner).toContain("{offRoute.message}");
    for (const word of ["Head ", "Turn ", "Go back", "Walk "]) {
      expect(banner).not.toContain(word);
    }
  });

  it("is judged against the same line the map is drawing", () => {
    /* Taken from where the overlay is sent, so the alert and the picture can
       never disagree about where the route is. */
    const sends = TRACK_CODE.match(/followedRouteRef\.current = /g) ?? [];
    expect(sends.length).toBe(2); // the canonical route and the community one
  });

  it("clears when the hike is saved", () => {
    /* A banner left standing would greet the next walk with a warning about a
       route nobody is on. */
    const save = TRACK_CODE.slice(TRACK_CODE.indexOf("const handleSave"));
    expect(save.slice(0, 600)).toContain("initialOffRouteMemory()");
  });

  it("does nothing on a free hike", () => {
    /* No route to leave. The detector returns early, and the banner needs a
       message that will never arrive. */
    expect(TRACK_CODE).toContain("if (route.length < 2) return;");
  });
});
