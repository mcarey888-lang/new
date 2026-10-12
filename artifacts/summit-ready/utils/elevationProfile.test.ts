import { describe, expect, it } from "vitest";
import {
  MIN_PROFILE_SAMPLES,
  MIN_SPAN_M,
  PROFILE_COLUMNS,
  buildRecordingProfile,
  profileAreaPath,
  profileLabel,
  profileLinePath,
  type ProfileSample,
} from "./elevationProfile";

const at = (alt: number | null, i: number): ProfileSample => ({ alt, ts: 1_000 + i * 1_000 });

const climb = (from: number, to: number, count: number): ProfileSample[] =>
  Array.from({ length: count }, (_, i) => at(from + ((to - from) * i) / (count - 1), i));

describe("buildRecordingProfile", () => {
  it("draws nothing until there are enough readings to show a shape", () => {
    expect(buildRecordingProfile([])).toBeNull();
    expect(buildRecordingProfile(climb(100, 400, MIN_PROFILE_SAMPLES - 1))).toBeNull();
    expect(buildRecordingProfile(climb(100, 400, MIN_PROFILE_SAMPLES))).not.toBeNull();
  });

  it("ignores fixes that arrived without an altitude rather than guessing one", () => {
    const withGaps: ProfileSample[] = [
      at(100, 0), at(null, 1), at(200, 2), at(null, 3), at(300, 4), at(400, 5),
    ];
    const profile = buildRecordingProfile(withGaps);
    expect(profile).not.toBeNull();
    // Four real readings, so four columns — the two blanks contribute nothing.
    expect(profile!.points).toHaveLength(4);
    expect(profile!.lowM).toBe(100);
    expect(profile!.highM).toBe(400);
  });

  it("puts a climb at the bottom left and the top right", () => {
    const profile = buildRecordingProfile(climb(200, 900, 40))!;
    const first = profile.points[0];
    const last = profile.points[profile.points.length - 1];
    expect(first.x).toBe(0);
    expect(last.x).toBe(1);
    // y is SVG's direction: 1 is the floor of the box, 0 the ceiling.
    expect(first.y).toBeGreaterThan(last.y);
    expect(last.y).toBeCloseTo(0, 5);
  });

  it("keeps every point inside the box", () => {
    const rolling = Array.from({ length: 200 }, (_, i) =>
      at(300 + Math.sin(i / 7) * 180 + (i % 5) * 4, i));
    const profile = buildRecordingProfile(rolling)!;
    for (const p of profile.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("does not let GPS noise on flat ground draw a mountain", () => {
    // A level walk, wandering by a couple of metres the way GPS altitude does.
    const flat = Array.from({ length: 60 }, (_, i) => at(42 + (i % 3) - 1, i));
    const profile = buildRecordingProfile(flat)!;
    expect(profile.damped).toBe(true);

    const highest = Math.min(...profile.points.map(p => p.y));
    const lowest = Math.max(...profile.points.map(p => p.y));
    // A 2 m wander against a 25 m floor must stay a thin band near the middle.
    expect(lowest - highest).toBeLessThan(0.2);
    expect(highest).toBeGreaterThan(0.3);
  });

  it("stops damping once the ground really does rise", () => {
    const profile = buildRecordingProfile(climb(100, 100 + MIN_SPAN_M * 4, 60))!;
    expect(profile.damped).toBe(false);
  });

  it("caps the number of columns however long the walk gets", () => {
    const long = Array.from({ length: 5_000 }, (_, i) => at(100 + i / 10, i));
    const profile = buildRecordingProfile(long)!;
    expect(profile.points).toHaveLength(PROFILE_COLUMNS);
  });

  it("reports the readings that were recorded, not the averaged line", () => {
    const spiky = climb(500, 560, 300);
    spiky[150] = at(980, 150);   // one freak altitude reading mid-walk
    const profile = buildRecordingProfile(spiky)!;

    // The figure quoted to the user is the reading that actually arrived.
    expect(profile.highM).toBe(980);

    // But it is averaged in with its neighbours before being drawn, so one
    // bad fix cannot squash the real hillside into a line along the floor.
    const usingTheBox = profile.points.filter(p => p.y > 0.4).length;
    expect(usingTheBox).toBeGreaterThan(profile.points.length / 3);
  });
});

describe("profileLinePath / profileAreaPath", () => {
  it("scales the normalised line into the box it is given", () => {
    const profile = buildRecordingProfile(climb(0, 100, 5))!;
    const line = profileLinePath(profile.points, 200, 40);
    expect(line.startsWith("M0.0 40.0")).toBe(true);
    expect(line.endsWith("L200.0 0.0")).toBe(true);
  });

  it("closes the area down to the baseline so the fill has a floor", () => {
    const profile = buildRecordingProfile(climb(0, 100, 5))!;
    const area = profileAreaPath(profile.points, 200, 40);
    expect(area.endsWith("L0.0 40.0 Z")).toBe(true);
    expect(area).toContain("L200.0 40.0");
  });

  it("returns an empty string rather than a broken path when there is nothing", () => {
    expect(profileLinePath([], 200, 40)).toBe("");
    expect(profileAreaPath([], 200, 40)).toBe("");
  });
});

describe("profileLabel", () => {
  it("calls level ground level instead of quoting a two metre range", () => {
    const flat = buildRecordingProfile(
      Array.from({ length: 40 }, (_, i) => at(42 + (i % 3) - 1, i)))!;
    expect(profileLabel(flat)).toContain("level");
  });

  it("quotes the real low and high once the ground moves", () => {
    const profile = buildRecordingProfile(climb(210, 940, 50))!;
    const label = profileLabel(profile);
    expect(label).toContain("210");
    expect(label).toContain("940");
  });
});
