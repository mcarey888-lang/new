import { describe, expect, it } from "vitest";
import type { NearbyHill, Session } from "@/context/AppContext";
import { completedStageSessionDistance, manualStageDistance } from "./manualStageDistance";

const stage = { name: "Helvellyn", distance: 13, routeDistance: 13,
  routeIdentityKey: "helvellyn" } as NearbyHill;
const session = { type: "hill", completed: true, expeditionId: "expedition",
  hillName: "Helvellyn", notes: "Helvellyn — 1 rep", reps: 1,
  routeIdentityKey: "helvellyn", distance: 26 } as Session;

describe("manual expedition distance", () => {
  it("totals 12 and 13 km as 25, without doubling full routes", () => {
    expect(manualStageDistance({ distance: 12 }, 1) + manualStageDistance(stage, 1)).toBe(25);
  });
  it("prefers full walking distance over distance away and applies repeats once", () => {
    expect(manualStageDistance({ distance: 40, routeDistance: 12 }, 2)).toBe(24);
  });
  it("repairs only the exact old manual calculation for completion presentation", () => {
    expect(completedStageSessionDistance(session, [stage])).toBe(13);
    expect(session.distance).toBe(26);
    expect(completedStageSessionDistance({ ...session, distance: 13 }, [stage])).toBe(13);
  });
  it("keeps actual GPS and linked hike distances, even when equal to the old formula", () => {
    expect(completedStageSessionDistance({ ...session, activityId: "gps" }, [stage])).toBe(26);
    expect(completedStageSessionDistance({ ...session, sourceHikeId: "hike" }, [stage])).toBe(26);
    expect(completedStageSessionDistance({ ...session, activityId: "gps", distance: 14.7 }, [stage])).toBe(14.7);
  });
  it("preserves unrelated, ambiguous and independently entered records", () => {
    expect(completedStageSessionDistance(session, [])).toBe(26);
    expect(completedStageSessionDistance(session, [stage, stage])).toBe(26);
    expect(completedStageSessionDistance({ ...session, notes: "My own distance" }, [stage])).toBe(26);
    expect(completedStageSessionDistance({ ...session, distance: 16 }, [stage])).toBe(16);
  });
});
