import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRecordedHikeNotes, hasRecordedRoute, recordedHikeNotes,
  recordedMetricAvailability, TIME_ONLY_NOTES,
} from "./recordedHikePresentation";

vi.mock("react-native", () => ({ Platform: { OS: "web" }, Share: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("expo-file-system/legacy", () => ({ cacheDirectory: null, writeAsStringAsync: vi.fn() }));
vi.mock("expo-sharing", () => ({}));
vi.mock("./activityAudience", () => ({ activityApiBase: "/api" }));
import { recordedGpx } from "./recordedHikeExport";

const route = [{ lat: 53.1, lon: -4, alt: 100 }, { lat: 53.2, lon: -4, alt: 100 }];
const source = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
const legacy = "GPS tracked hike. Elevation loss: 0 m. Avg speed: — km/h.";

describe("recording descriptions reflect the captured route", () => {
  it.each([undefined, [], [route[0]]])("saves a time-only description with no usable route (%j)", trackPoints => {
    expect(buildRecordedHikeNotes({
      trackPoints, distance: 0, elevationGain: 0, elevationLoss: 0, elapsedSecs: 58,
    })).toBe(TIME_ONLY_NOTES);
  });
  it("keeps GPS descriptions and measured figures for real routes", () => {
    expect(buildRecordedHikeNotes({
      trackPoints: route, distance: 2, elevationGain: 10, elevationLoss: 5, elapsedSecs: 3600,
    })).toBe("GPS tracked hike. Elevation loss: 5 m. Avg speed: 2.0 km/h.");
  });
  it("corrects legacy automatic notes at display time without mutating the record", () => {
    const hike = { distance: 0, elevationGain: 0, notes: `${legacy} My own note.` };
    expect(recordedHikeNotes(hike)).toBe(`${TIME_ONLY_NOTES} My own note.`);
    expect(hike.notes).toBe(`${legacy} My own note.`);
  });
  it("does not rewrite manual notes or notes on real routes", () => {
    expect(recordedHikeNotes({ notes: "Lovely day", distance: 0 })).toBe("Lovely day");
    expect(recordedHikeNotes({ notes: legacy, trackPoints: route })).toBe(legacy);
    expect(recordedHikeNotes({})).toBe("");
  });
  it("preserves stored positive figures when an old recording lost its trace", () => {
    expect(recordedHikeNotes({ notes: legacy, distance: 2, elevationGain: 10 }))
      .toBe(legacy.replace("GPS tracked hike.", "Recording — no GPS track saved."));
    expect(buildRecordedHikeNotes({
      distance: 2, elevationGain: 10, elapsedSecs: 3600, elevationLoss: 5,
    })).toBe("Recording — no GPS track saved. Elevation loss: 5 m. Avg speed: 2.0 km/h.");
  });
});

describe("missing measurements are not measured zeroes", () => {
  it("marks no-GPS distance and ascent unavailable in both review and detail", () => {
    expect(recordedMetricAvailability({ trackPoints: [], distance: 0, elevationGain: 0 }))
      .toEqual({ distance: false, ascent: false });
  });
  it("preserves measured zeroes on a recorded flat/stationary route", () => {
    expect(recordedMetricAvailability({ trackPoints: route, distance: 0, elevationGain: 0 }))
      .toEqual({ distance: true, ascent: true });
  });
  it("does not invent zero ascent when GPS captured no altitude", () => {
    expect(recordedMetricAvailability({ trackPoints: route.map(({ lat, lon }) => ({ lat, lon })) }))
      .toEqual({ distance: true, ascent: false });
  });
  it("preserves manually entered positive figures without GPS", () => {
    expect(recordedMetricAvailability({ distance: 5, elevationGain: 200 }))
      .toEqual({ distance: true, ascent: true });
  });
});

describe("recorded GPX availability and screen wiring", () => {
  it.each([undefined, [], [route[0]], [{ lat: NaN, lon: 0 }, route[0]]])(
    "rejects route-less or unusable GPX (%j)", trackPoints => {
      expect(hasRecordedRoute(trackPoints)).toBe(false);
      expect(() => recordedGpx({ name: "QA", trackPoints })).toThrow("no recorded route");
    },
  );
  it("still exports the actual recorded route", () => {
    const xml = recordedGpx({ name: "QA & hike", trackPoints: route });
    expect(xml).toContain("QA &amp; hike");
    expect(xml.match(/<trkpt /g)).toHaveLength(2);
  });
  it("uses the shared description for saving, list cards and detail notes", () => {
    expect(source("app/hike-tracking.tsx")).toContain("notes: buildRecordedHikeNotes(");
    expect(source("app/(tabs)/hikes.tsx")).toContain("const notes = recordedHikeNotes(hike)");
    expect(source("app/hike-detail.tsx")).toContain("const notes = recordedHikeNotes(hike)");
  });
  it("disables route-less export with an accessible state and a visible explanation", () => {
    const detail = source("app/hike-detail.tsx");
    expect(detail).toContain('disabled={!hasRoute}');
    expect(detail).toContain("accessibilityState={{ disabled: !hasRoute }}");
    expect(detail).toContain("No recorded route to export as GPX.");
    expect(detail).toContain('accessibilityRole="alert"');
    expect(detail).not.toContain('Alert.alert("GPX not exported"');
  });
  it("review and detail share measurement availability and review receives actual points", () => {
    expect(source("app/hike-tracking.tsx")).toContain("recordedPoints={trackPoints.current}");
    const view = source("components/track/ActivityCompleteView.tsx");
    expect(view).toContain("recordedMetricAvailability(");
    expect(view).toContain('available.ascent ? fmtM(elevGainM) : "—"');
    expect(view).toContain("available.distance ? fmtKm(distanceKm) : null");
    expect(source("app/hike-detail.tsx")).toContain("recordedMetricAvailability(hike)");
  });
});
