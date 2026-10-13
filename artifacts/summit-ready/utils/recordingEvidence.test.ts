import { describe, it, expect } from "vitest";
import { appendRawFix, type RawRecordingFix } from "./recordingEvidence";
describe("independent raw GPS evidence", () => {
  it("retains inaccurate and out-of-order fixes without changing a derived track", () => {
    const fixes: RawRecordingFix[] = [], seen = new Set<string>();
    const fix: RawRecordingFix = { lat: 53, lon: -2, alt: null, ts: 20, acc: 900,
      altAcc: null, source: "background", acceptedForTrace: false };
    expect(appendRawFix(fixes, seen, fix)).toBe(true);
    expect(appendRawFix(fixes, seen, { ...fix, ts: 10 })).toBe(true);
    expect(fixes.map(f => f.ts)).toEqual([20, 10]);
    expect(fixes[0].acc).toBe(900);
    expect(fixes[0].alt).toBeNull();
  });
  it("deduplicates the same foreground/background fix but retains distinct evidence", () => {
    const fixes: RawRecordingFix[] = [], seen = new Set<string>();
    const fix: RawRecordingFix = { lat: 53, lon: -2, alt: 300, ts: 20,
      acc: 10, altAcc: 5, source: "foreground", acceptedForTrace: true };
    appendRawFix(fixes, seen, fix);
    expect(appendRawFix(fixes, seen, { ...fix, source: "background" })).toBe(false);
    expect(appendRawFix(fixes, seen, { ...fix, alt: 301 })).toBe(true);
    expect(fixes).toHaveLength(2);
  });
});
