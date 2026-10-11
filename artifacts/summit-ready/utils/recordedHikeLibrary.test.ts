import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
describe("completed hike library and recording integration", () => {
  it("shows local recordings alongside plans without requiring successful server sync", () => {
    const account = read("app/(tabs)/account.tsx");
    expect(account).toContain("<CompletedHikesSection />");
    expect(account).toContain('title="Planned routes"');
    const section = read("components/track/CompletedHikesSection.tsx");
    expect(section).toContain("exploreHikes");
    expect(section).toContain('pathname: "/hike-detail"');
    expect(section).toContain("params: { id: hike.id }");
    expect(section).toContain("Private backup confirmed");
    expect(section).toContain("hike.backedUpRevision === hike.backupRevision");
    expect(section).not.toMatch(/listRoutes|fetch\(/);
  });
  it("uses the same elevation filter for all three foreground watchers and background replay", () => {
    const recorder = read("app/hike-tracking.tsx");
    expect(recorder.match(/consumeAltitude\(altitude, loc.timestamp, loc.coords.altitudeAccuracy\)/g)).toHaveLength(3);
    expect(recorder).toContain("consumeAltitude(p.alt, p.ts, p.altAcc)");
    expect(recorder).not.toContain("ALTITUDE_NOISE_THRESHOLD");
    expect(recorder).toContain("elevationFilter: elevationFilterRef.current");
    expect(recorder).toContain("session.elevationFilter");
    expect(recorder).toContain("if (ts <= prev.ts) return false");
    expect(recorder).toContain("breakElevationContinuity(elevationFilterRef.current)");
  });
  it("opens recent recorded activity with its actual local hike ID, without requiring sync", () => {
    const account = read("app/(tabs)/account.tsx");
    const recent = account.slice(account.indexOf("const recentActivity ="), account.indexOf("// Lifetime stats"));
    expect(recent).toContain("hikeId: h.id");
    expect(recent).toContain("hikeId: null");
    const rows = account.slice(account.indexOf("{recentActivity.length ?"), account.indexOf('title="No activity yet"'));
    expect(rows).toContain("<TouchableOpacity");
    expect(rows).toContain("disabled={!activity.hikeId}");
    expect(rows).toContain('pathname: "/hike-detail", params: { id: activity.hikeId }');
    expect(rows).toContain("accessibilityLabel=");
    expect(rows).not.toMatch(/syncState|fetch\(|getToken/);
    const detail = read("app/hike-detail.tsx");
    expect(detail).toContain("exploreHikes.find(h => h.id === id)");
    expect(detail).toContain("buildMapHtml(hike.trackPoints!)");
  });
  it("does not advertise a successful local save before the storage write succeeds", () => {
    const context = read("context/AppContext.tsx");
    const save = context.slice(context.indexOf("const logExploreHike ="), context.indexOf("const deleteExploreHike ="));
    expect(save.indexOf("await AsyncStorage.setItem")).toBeLessThan(save.indexOf("setExploreHikes(updated)"));
    const recorder = read("app/hike-tracking.tsx");
    expect(recorder).toContain('Alert.alert("Hike save needs attention"');
    expect(recorder).toContain("savedLocally={exploreHikes.some");
    const complete = read("components/track/ActivityCompleteView.tsx");
    expect(complete).toContain("!savedLocally");
    expect(complete).toContain("Tap Save hike below");
  });
});
