import { describe, expect, it } from "vitest";
import {
  earliestEvidenceAt, evidenceRows, formatDuration, formatPace,
} from "./readinessEvidencePresentation";

const sessions = [
  { id: "s1", date: "2031-03-04T09:00:00Z", type: "hill", hillName: "  Hollow Rise  ", distance: 14.04, elevationGain: 950, duration: 272, completed: true },
  { id: "s2", date: "2031-03-02T09:00:00Z", type: "cardio", distance: 0, elevationGain: 0, duration: 45, completed: true },
  { id: "s3", date: "2031-02-27T09:00:00Z", type: "bigDay", distance: 22, elevationGain: 1400, duration: 400, completed: true },
];
const hikes = [
  { id: "h1", name: "Longbarrow Fell", date: "2031-03-03T09:00:00Z", distance: 7, elevationGain: 451, timeTaken: 138 },
  { id: "h2", name: "   ", date: "2031-03-01T09:00:00Z", distance: 3, elevationGain: 100, timeTaken: 50 },
];

describe("formatDuration", () => {
  it("returns null for a missing or non-positive value", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
  it("reads minutes under an hour as minutes", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(59.4)).toBe("59 min");
  });
  it("carries the minute when rounding reaches the hour", () => {
    /* 59.6 must not print as "60 min" — it rounds to a whole hour first. */
    expect(formatDuration(59.6)).toBe("1h");
  });
  it("reads longer sessions as hours and minutes", () => {
    expect(formatDuration(272)).toBe("4h 32m");
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("evidenceRows", () => {
  it("lists only what the engine included", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "h1"] });
    expect(rows.map(r => r.id)).toEqual(["s1", "h1"]);
  });

  it("includes nothing when the engine included nothing", () => {
    expect(evidenceRows({ sessions, hikes, includedEvidenceIds: [] })).toEqual([]);
  });

  it("silently drops an id that no longer resolves to a record", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "gone"] });
    expect(rows).toHaveLength(1);
    expect(rows.every(r => r.name !== "Unknown activity")).toBe(true);
  });

  it("orders newest first", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "s2", "s3", "h1", "h2"] });
    expect(rows.map(r => r.id)).toEqual(["s1", "h1", "s2", "h2", "s3"]);
  });

  it("uses the user's own names and trims them", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "h1"] });
    expect(rows.find(r => r.id === "s1")?.name).toBe("Hollow Rise");
    expect(rows.find(r => r.id === "h1")?.name).toBe("Longbarrow Fell");
  });

  it("falls back to a plain type label rather than inventing a place", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s2", "s3", "h2"] });
    expect(rows.find(r => r.id === "s2")?.name).toBe("Cardio session");
    expect(rows.find(r => r.id === "s3")?.name).toBe("Big day");
    expect(rows.find(r => r.id === "h2")?.name).toBe("Recorded hike");
  });

  it("omits a stat the record does not carry rather than showing zero", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s2"] });
    expect(rows[0].stats.map(s => s.kind)).toEqual(["duration"]);
  });

  it("formats the stats it does have", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1"] });
    expect(rows[0].stats.map(s => s.text)).toEqual(["950 m", "14 km", "4h 32m"]);
  });

  it("formats the date and marks where the row came from", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "h1"] });
    expect(rows.find(r => r.id === "s1")).toMatchObject({ date: "4 Mar 2031", origin: "session" });
    expect(rows.find(r => r.id === "h1")).toMatchObject({ origin: "hike" });
  });

  it("survives an unreadable date without dropping the row", () => {
    const rows = evidenceRows({
      sessions: [{ id: "x", date: "nope", type: "hill", elevationGain: 100 }],
      hikes: [], includedEvidenceIds: ["x"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBeNull();
  });

  it("honours a limit", () => {
    const rows = evidenceRows({ sessions, hikes, includedEvidenceIds: ["s1", "s2", "s3", "h1", "h2"], limit: 3 });
    expect(rows).toHaveLength(3);
  });
});

describe("earliestEvidenceAt", () => {
  it("is null with nothing logged", () => {
    expect(earliestEvidenceAt([], [])).toBeNull();
  });
  it("finds the oldest record across both sources", () => {
    expect(earliestEvidenceAt(sessions, hikes)).toBe("2031-02-27T09:00:00Z");
  });
  it("ignores an unparseable date", () => {
    expect(earliestEvidenceAt([{ id: "a", date: "nope" }], hikes)).toBe("2031-03-01T09:00:00Z");
  });
  it("ignores an incomplete session", () => {
    const out = earliestEvidenceAt(
      [{ id: "a", date: "2020-01-01T00:00:00Z", completed: false }, ...sessions], hikes,
    );
    expect(out).toBe("2031-02-27T09:00:00Z");
  });
});

describe("formatPace", () => {
  it("returns null when a pace cannot be derived", () => {
    expect(formatPace(null, 10)).toBeNull();
    expect(formatPace(60, null)).toBeNull();
    expect(formatPace(0, 10)).toBeNull();
    expect(formatPace(60, 0)).toBeNull();
    expect(formatPace(Number.NaN, 10)).toBeNull();
    expect(formatPace(60, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats a whole pace", () => {
    expect(formatPace(60, 10)).toBe("6:00/km");
    expect(formatPace(138, 7)).toBe("19:43/km");
  });

  it("carries the minute instead of printing sixty seconds", () => {
    /* 5.999 min/km must not print "5:60/km". */
    expect(formatPace(59.99, 10)).toBe("6:00/km");
  });

  it("pads the seconds", () => {
    expect(formatPace(60.5, 10)).toBe("6:03/km");
  });
});
