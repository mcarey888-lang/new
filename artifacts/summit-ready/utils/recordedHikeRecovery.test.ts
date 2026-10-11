import { describe, expect, it } from "vitest";
import { applyRecordedAltitudeReview, privateRecordedHikeBackup, reviewRecordedAltitude } from "./recordedHikeRecovery";

const points = Array.from({ length: 121 }, (_, i) => ({
  lat: 53, lon: -2, alt: 200 + (i <= 60 ? i : 120 - i), ts: 1_000_000 + i * 5000, altAcc: 2,
}));
const hike = { id: "local-hike", elevationGain: 1670, timeTaken: 10,
  notes: "GPS tracked hike. Elevation loss: 1670 m.", trackPoints: points };

describe("historical recorded altitude review", () => {
  it("uses saved GPS evidence, preserves raw data and audits the original figures", () => {
    const corrected = applyRecordedAltitudeReview(hike, "2026-10-11T20:00:00.000Z");
    expect(corrected.elevationGain).toBeGreaterThan(50);
    expect(corrected.elevationGain).toBeLessThanOrEqual(60);
    expect(corrected.elevationCorrection?.originalGainM).toBe(1670);
    expect(corrected.elevationCorrection?.originalLossM).toBe(1670);
    expect(corrected.elevationCorrection?.originalNotes).toBe(hike.notes);
    expect(corrected.trackPoints).toBe(hike.trackPoints);
    expect(hike.elevationGain).toBe(1670);
    expect(corrected.notes).not.toContain("Elevation loss: 1670");
  });
  it("does not invent a correction when altitude or timestamps were not saved", () => {
    expect(reviewRecordedAltitude({ ...hike, trackPoints: points.map(({ lat, lon }) => ({ lat, lon })) }).available).toBe(false);
    expect(() => applyRecordedAltitudeReview({ ...hike, trackPoints: [] }, "now")).toThrow();
  });
  it("refuses poor vertical accuracy and incomplete coverage", () => {
    expect(reviewRecordedAltitude({ ...hike, trackPoints: points.map(p => ({ ...p, altAcc: 60 })) }).available).toBe(false);
    expect(reviewRecordedAltitude({ ...hike, timeTaken: 90 }).available).toBe(false);
  });
  it("labels older recordings without vertical-accuracy metadata as estimates", () => {
    const result = reviewRecordedAltitude({ ...hike, trackPoints: points.map(({ altAcc, ...p }) => p) });
    expect(result.available && result.accuracyMissing).toBe(true);
  });
  it("cannot repeatedly overwrite the original audit", () => {
    const once = applyRecordedAltitudeReview(hike, "2026-10-11T20:00:00.000Z");
    expect(() => applyRecordedAltitudeReview(once, "2026-10-12T20:00:00.000Z")).toThrow("already been reviewed");
  });
  it("backs up the original raw trace and correction audit, never a device's sync assertion", () => {
    const recording = { ...hike, syncState: "synced", backedUpRevision: "old" };
    const payload = privateRecordedHikeBackup(recording, "2026-10-11T20:00:00.000Z");
    expect(payload.snapshot.trackPoints).toBe(points);
    expect(payload.snapshot).not.toHaveProperty("syncState");
    expect(payload.snapshot).not.toHaveProperty("backedUpRevision");
    expect(payload.hikeId).toBe(hike.id);
  });
});
