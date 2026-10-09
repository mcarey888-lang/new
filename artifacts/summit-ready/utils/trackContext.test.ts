import { describe, expect, it } from "vitest";
import {
  contextDetail, contextFromStored, contextLabel, FREE_HIKE, isUsableIn,
  launchParamsFor, nextExpeditionStage, nextTrainingSession, resolveTrackContext,
  storedFromContext, trainingContextFor, type TrackContext,
} from "./trackContext";
import type { NearbyHill, PlanSession, TrainingWeek } from "@/context/AppContext";

const stage = (over: Partial<NearbyHill> = {}): NearbyHill => ({
  name: "Scafell Pike", elevation: 978, distance: 9, repeats: 1,
  totalElevation: 900, surface: "rock", grade: "hard", emoji: "⛰️", ...over,
});

const session = (over: Partial<PlanSession> = {}): PlanSession => ({
  id: "w1-s0", type: "hill", label: "Hill reps", description: "",
  targetElevation: 600, duration: "2 hrs", ...over,
});

const training: TrackContext = {
  kind: "training", sessionKey: "w1-s0", label: "Hill reps",
  targetElevationM: 600, weekNumber: 1, sessionIndex: 0,
};
const expedition: TrackContext = { kind: "expedition", expeditionId: "exp-1", stage: stage() };

describe("what Track opens on", () => {
  it("offers a free hike when opened from the tab bar", () => {
    /* Somebody opening Track directly is usually about to walk. Making them
       dismiss a training session they did not choose is how an app gets
       closed at a trailhead. */
    expect(resolveTrackContext({ shellMode: "training" })).toEqual(FREE_HIKE);
    expect(resolveTrackContext({ shellMode: "expedition" })).toEqual(FREE_HIKE);
  });

  it("takes the session a Training screen asked for", () => {
    expect(resolveTrackContext({ shellMode: "training", requested: training })).toEqual(training);
  });

  it("takes the stage an expedition asked for", () => {
    expect(resolveTrackContext({ shellMode: "expedition", requested: expedition })).toEqual(expedition);
  });
});

describe("keeping Training and Expeditions apart", () => {
  it("refuses a training context inside an expedition", () => {
    /* A recording credited to the wrong one cannot be moved afterwards. */
    expect(isUsableIn(training, "expedition")).toBe(false);
    expect(isUsableIn(training, "training")).toBe(true);
  });

  it("refuses an expedition context inside Training", () => {
    expect(isUsableIn(expedition, "training")).toBe(false);
    expect(isUsableIn(expedition, "expedition")).toBe(true);
  });

  it("lets a free hike run in either", () => {
    expect(isUsableIn(FREE_HIKE, "training")).toBe(true);
    expect(isUsableIn(FREE_HIKE, "expedition")).toBe(true);
  });

  it("drops a stored context belonging to the other shell", () => {
    const stored = storedFromContext(expedition, "user-1");
    /* The person switched to Training with an expedition stage still
       selected. Falling back to a free hike is the only safe answer. */
    expect(resolveTrackContext({ shellMode: "training", stored })).toEqual(FREE_HIKE);
  });

  it("ignores an explicit ask from the wrong shell rather than obeying it", () => {
    expect(resolveTrackContext({ shellMode: "training", requested: expedition })).toEqual(FREE_HIKE);
  });
});

describe("surviving a detour through search or the planner", () => {
  it("brings an expedition stage back intact", () => {
    const stored = storedFromContext(expedition, "user-1");
    const back = resolveTrackContext({ shellMode: "expedition", stored });
    expect(back.kind).toBe("expedition");
    if (back.kind !== "expedition") throw new Error("wrong kind");
    expect(back.expeditionId).toBe("exp-1");
    expect(back.stage.name).toBe("Scafell Pike");
    expect(back.stage.routeIdentityKey).toBe(expedition.kind === "expedition"
      ? expedition.stage.routeIdentityKey : undefined);
  });

  it("brings a training session back with its target", () => {
    const stored = storedFromContext(training, "user-1");
    expect(resolveTrackContext({ shellMode: "training", stored })).toEqual(training);
  });

  it("brings a free hike back as a free hike", () => {
    const stored = storedFromContext(FREE_HIKE, "user-1");
    expect(resolveTrackContext({ shellMode: "training", stored })).toEqual(FREE_HIKE);
  });

  it("keeps the identity keys an expedition stage is credited by", () => {
    const withKeys: TrackContext = {
      kind: "expedition", expeditionId: "exp-1",
      stage: stage({ routeIdentityKey: "r-key", summitIdentityKey: "s-key", objectiveType: "manual_summit" }),
    };
    const back = contextFromStored(storedFromContext(withKeys, "user-1"));
    if (back?.kind !== "expedition") throw new Error("wrong kind");
    /* Without these the ascent lands on no particular mountain. */
    expect(back.stage.routeIdentityKey).toBe("r-key");
    expect(back.stage.summitIdentityKey).toBe("s-key");
    expect(back.stage.objectiveType).toBe("manual_summit");
  });

  it("reads nothing out of an unrecognised stored selection", () => {
    expect(contextFromStored({
      userId: "u", routeName: "x", trackingMode: "something-else",
      expeditionId: null, savedAt: Date.now(),
    })).toBeNull();
  });
});

describe("finding the next thing to do", () => {
  it("skips expedition stages already done, by name", () => {
    const stages = [stage({ name: "Helvellyn" }), stage({ name: "Scafell Pike" })];
    expect(nextExpeditionStage(stages, ["helvellyn"])?.name).toBe("Scafell Pike");
  });

  it("returns nothing when every stage is done", () => {
    expect(nextExpeditionStage([stage({ name: "A" })], ["a"])).toBeNull();
    expect(nextExpeditionStage([], [])).toBeNull();
    expect(nextExpeditionStage(undefined, [])).toBeNull();
  });

  it("finds the first unfinished session in the week", () => {
    const week = { weekNumber: 1, sessions: [session({ id: "a" }), session({ id: "b" })] } as TrainingWeek;
    expect(nextTrainingSession(week, { a: true })?.session.id).toBe("b");
    expect(nextTrainingSession(week, { a: true, b: true })).toBeNull();
    expect(nextTrainingSession(null, {})).toBeNull();
  });

  it("falls back to a positional key when a session has no id", () => {
    const week = { weekNumber: 3, sessions: [session({ id: undefined })] } as TrainingWeek;
    expect(nextTrainingSession(week, { "3-0": true })).toBeNull();
  });
});

describe("handing the recorder its params", () => {
  it("sends an expedition stage with its identity keys", () => {
    const params = launchParamsFor(
      { kind: "expedition", expeditionId: "exp-1", stage: stage({ routeIdentityKey: "r", summitIdentityKey: "s" }) },
      "expedition", "exp-1",
    );
    expect(params["trackingMode"]).toBe("expedition-route");
    expect(params["expeditionId"]).toBe("exp-1");
    expect(params["routeIdentityKey"]).toBe("r");
    expect(params["summitIdentityKey"]).toBe("s");
    expect(params["hillName"]).toBe("Scafell Pike");
  });

  it("sends a training session with the key the plan is closed by", () => {
    const params = launchParamsFor(training, "training");
    expect(params["hillSessionKey"]).toBe("w1-s0");
    expect(params["estimatedTotalGain"]).toBe("600");
  });

  it("sends a free hike with no session or stage attached", () => {
    const params = launchParamsFor(FREE_HIKE, "training");
    expect(params["trackingMode"]).toBe("freehike");
    /* A free hike must not quietly close a training session. */
    expect(params["hillSessionKey"]).toBeUndefined();
    expect(params["expeditionId"]).toBeUndefined();
  });

  it("carries the expedition id on a free hike inside an expedition", () => {
    const params = launchParamsFor(FREE_HIKE, "expedition", "exp-1");
    expect(params["trackingMode"]).toBe("freehike");
    expect(params["expeditionId"]).toBe("exp-1");
  });
});

describe("what the sheet says", () => {
  it("names each kind", () => {
    expect(contextLabel(FREE_HIKE)).toBe("Free hike");
    expect(contextLabel(training)).toBe("Hill reps");
    expect(contextLabel(expedition)).toBe("Scafell Pike");
  });

  it("says what a free hike does count towards, rather than nothing", () => {
    expect(contextDetail(FREE_HIKE)).toMatch(/elevation/i);
  });

  it("leaves out a training target it does not have", () => {
    expect(contextDetail({ ...training, targetElevationM: null })).toBe("Training session");
    expect(contextDetail(training)).toContain("600 m");
  });

  it("builds a training context off a plan session", () => {
    expect(trainingContextFor(session(), 1, 0)).toEqual(training);
  });
});
