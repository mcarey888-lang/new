import { describe, expect, it } from "vitest";
import { calculateManualBankAscent } from "./manualBankAscent";

const now = new Date("2026-09-26T12:00:00Z");
const hike = {
  id: "hike-one", name: "Mam Tor", date: "2026-09-25",
  distance: 6, elevationGain: 410, notes: "",
};
const session = {
  id: "session-one", type: "bigDay", date: "2026-09-25",
  distance: 6, elevationGain: 410, completed: true, hillName: "Mam Tor",
};

describe("calculateManualBankAscent", () => {
  it("counts a manually entered hike and its linked training session once", () => {
    expect(calculateManualBankAscent(
      [{ ...session, sourceHikeId: hike.id }],
      [hike],
      now,
    )).toEqual({ status: "available", lifetimeM: 410, monthM: 410, activities: 1 });
  });

  it("deduplicates an old manual hike/session copy with no shared link", () => {
    expect(calculateManualBankAscent([session], [hike], now))
      .toEqual({ status: "available", lifetimeM: 410, monthM: 410, activities: 1 });
  });

  it("includes completed manually entered training, but not pending sessions or GPS copies", () => {
    const sessions = [
      { ...session, id: "manual-hill", date: "2026-08-31", elevationGain: 250, type: "hill" },
      { ...session, id: "indoor", elevationGain: 90, type: "cardio" },
      { ...session, id: "planned", elevationGain: 500, completed: false },
      { ...session, id: "gps-copy", activityId: "gps-123", elevationGain: 320 },
    ];
    expect(calculateManualBankAscent(sessions, [
      { ...hike, id: "gps-123", activityId: "gps-123", trackPoints: [{ lat: 1, lon: 2 }] },
    ], now)).toEqual({ status: "available", lifetimeM: 340, monthM: 90, activities: 2 });
  });

  it("recomputes edited and deleted records rather than keeping stale banked ascent", () => {
    expect(calculateManualBankAscent([{ ...session, elevationGain: 530 }], [], now))
      .toEqual({ status: "available", lifetimeM: 530, monthM: 530, activities: 1 });
    expect(calculateManualBankAscent([], [], now))
      .toEqual({ status: "available", lifetimeM: 0, monthM: 0, activities: 0 });
  });

  it("refuses a partial total when saved ascent is invalid", () => {
    expect(calculateManualBankAscent([{ ...session, elevationGain: Number.NaN }], [hike], now))
      .toEqual({ status: "unavailable" });
  });
});