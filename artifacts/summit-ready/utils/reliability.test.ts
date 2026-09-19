import { describe, expect, it } from "vitest";
import {
  acknowledgeBatchKeys,
  checkpointElapsedSecs,
  flattenBatches,
  isPersistableHikeStatus,
  shouldRestoreCheckpoint,
  type HikeCheckpoint,
} from "./hikeReliability";
import { mergeActivityKinds, upsertByActivityId } from "./activityReliability";
import { authenticatedJsonHeaders, tokenBelongsToUser } from "./authRequest";
import { canMigrateFlatData, createGenerationGuard } from "./userHydration";
import { FLAT_MIGRATION_KEYS } from "./userHydration";
import {
  addUniqueCompletedRoute,
  isRouteCompleted,
  canonicalShellRoot,
  countCompletedPlanWeeks,
  creditExpeditionHike,
  ensurePlanSessionIds,
  expeditionRouteIdentityMatches,
  isExpeditionComplete,
  mergeExpeditionRoutes,
  migratePlanKeyedRecord,
  routeCompletionKey,
  selectShellGoal,
} from "./stateReliability";
import { syncOutboxKey } from "./syncOutbox";

describe("finished hike checkpoint persistence", () => {
  it("accepts finished as a durable save-state, not active tracking", () => {
    expect(isPersistableHikeStatus("finished")).toBe(true);
    expect(isPersistableHikeStatus("tracking")).toBe(true);
    expect(isPersistableHikeStatus("paused")).toBe(true);
    expect(isPersistableHikeStatus("idle")).toBe(false);
  });
});

describe("manual summit completion identity", () => {
  it("uses canonical summit identity while preserving legacy route fallback", () => {
    const objective = {
      name: "Helvellyn",
      routeIdentityKey: "route:striding-edge",
      summitIdentityKey: "summit:helvellyn",
      objectiveType: "manual_summit" as const,
    };
    expect(routeCompletionKey(objective)).toBe("summit:helvellyn");
    expect(isRouteCompleted(["summit:helvellyn"], objective)).toBe(true);
    expect(isRouteCompleted(["route:striding-edge"], objective)).toBe(false);
    expect(routeCompletionKey({ name: "Legacy", routeIdentityKey: "route:legacy" })).toBe("route:legacy");
  });

  it("matches a manual log to its canonical expedition objective", () => {
    const objective = {
      name: "Scafell Pike",
      routeIdentityKey: "route:scafell-corridor",
      summitIdentityKey: "summit:scafell-pike",
      objectiveType: "manual_summit" as const,
    };
    expect(expeditionRouteIdentityMatches(objective, {
      ...objective,
      routeIdentityKey: "route:scafell-lingmell",
    })).toBe(true);
    expect(routeCompletionKey(objective)).toBe("summit:scafell-pike");
  });

  it("preloads expedition hills without collapsing distinct same-name routes", () => {
    const west = { name: "Twin Peak", routeIdentityKey: "route:west" };
    const east = { name: "Twin Peak", routeIdentityKey: "route:east" };
    expect(mergeExpeditionRoutes([west], [west, east])).toEqual([west, east]);
  });
});

describe("GPS queue reliability", () => {
  it("acks only processed immutable batches", () => {
    expect(acknowledgeBatchKeys(["a", "b", "concurrent"], ["a", "b"])).toEqual(["concurrent"]);
  });
  it("merges only matching batches and orders points", () => {
    expect(flattenBatches([
      { id: "2", routeId: "r", points: [{ lat: 2, lon: 2, alt: null, ts: 2 }] },
      { id: "1", routeId: "r", points: [{ lat: 1, lon: 1, alt: null, ts: 1 }] },
      { id: "x", routeId: "other", points: [{ lat: 0, lon: 0, alt: null, ts: 0 }] },
    ], "r").map(point => point.ts)).toEqual([1, 2]);
  });
});

it("restores elapsed time without counting an active pause", () => {
  const checkpoint = {
    status: "paused", trackStartMs: 1_000, totalPausedMs: 2_000, pauseStartMs: 8_000,
  } as HikeCheckpoint;
  expect(checkpointElapsedSecs(checkpoint, 11_000)).toBe(5);
});

it("is idempotent by activity id across mirrored records", () => {
  const first = { id: "session", activityId: "outing" };
  expect(upsertByActivityId([first], { id: "retry", activityId: "outing" }).inserted).toBe(false);
  expect(mergeActivityKinds([first], [{ id: "hike", activityId: "outing" }])).toHaveLength(1);
});

it("constructs auth headers without mutating or logging tokens", () => {
  expect(authenticatedJsonHeaders("secret")).toEqual({
    "Content-Type": "application/json", Authorization: "Bearer secret",
  });
});

it("rejects a retry token issued for a different user", () => {
  const payload = globalThis.btoa(JSON.stringify({ sub: "user_b" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const token = `header.${payload}.signature`;
  expect(tokenBelongsToUser(token, "user_a")).toBe(false);
  expect(tokenBelongsToUser(token, "user_b")).toBe(true);
});

it("generation guards stale user loads and safe migration ownership", () => {
  const guard = createGenerationGuard();
  const old = guard.begin();
  const current = guard.begin();
  expect(old.isCurrent()).toBe(false);
  expect(current.isCurrent()).toBe(true);
  expect(canMigrateFlatData("u2", null, "u1")).toBe(false);
  expect(canMigrateFlatData("u1", null, "u1")).toBe(true);
});

it("resolves canonical isolated shell roots", () => {
  expect(canonicalShellRoot("training")).toBe("/(tabs)/dashboard");
  expect(canonicalShellRoot("expedition")).toBe("/(expedition)/base-camp");
});

it("switches the public goal snapshot without modifying either shell goal", () => {
  const training = { name: "Training", progress: 4 };
  const expedition = { name: "Expedition", progress: 8 };
  expect(selectShellGoal("training", training, expedition)).toBe(training);
  expect(selectShellGoal("expedition", training, expedition)).toBe(expedition);
  expect(training.progress).toBe(4);
  expect(expedition.progress).toBe(8);
});

it("keeps outbox storage isolated by Clerk user", () => {
  expect(syncOutboxKey("user_a")).not.toBe(syncOutboxKey("user_b"));
  expect(syncOutboxKey("user_a")).toContain("user_a");
});

it("includes all shell and session migration keys", () => {
  expect(FLAT_MIGRATION_KEYS).toContain("summitready_shell_mode");
  expect(FLAT_MIGRATION_KEYS).toContain("summitready_session_day_overrides");
  expect(FLAT_MIGRATION_KEYS).toContain("summitready_expeditions");
  expect(FLAT_MIGRATION_KEYS).toContain("summitready_active_expedition_id");
  expect(FLAT_MIGRATION_KEYS).toContain("summitready_questionnaire_data");
});

it("counts final route completion uniquely", () => {
  const completedRoutes = addUniqueCompletedRoute(["A", "A"], "B");
  expect(completedRoutes).toEqual(["A", "B"]);
  expect(isExpeditionComplete({
    completedRoutes,
    virtualHills: [{ name: "A" }, { name: "B" }],
  })).toBe(true);
});

it("credits manual expedition elevation once per saved session", () => {
  const first = creditExpeditionHike(undefined, "session-1", 903, 12);
  const duplicate = creditExpeditionHike(first, "session-1", 903, 12);
  const second = creditExpeditionHike(duplicate, "session-2", 760, 9);

  expect(duplicate).toEqual(first);
  expect(second).toMatchObject({
    elevationGained: 1663,
    distanceCovered: 21,
    hikesLogged: 2,
    creditedHikeIds: ["session-1", "session-2"],
  });
});

it("keeps distant same-name expedition completion identities distinct", () => {
  const west = { name: "Twin Peak", routeIdentityKey: "route:v1:osm_overpass:node:10" };
  const east = { name: "Twin Peak", routeIdentityKey: "route:v1:osm_overpass:node:20" };
  const completedRoutes = addUniqueCompletedRoute([], west.routeIdentityKey);

  expect(isRouteCompleted(completedRoutes, west)).toBe(true);
  expect(isRouteCompleted(completedRoutes, east)).toBe(false);
  expect(isExpeditionComplete({ completedRoutes, virtualHills: [west, east] })).toBe(false);
  expect(isRouteCompleted(["Twin Peak"], east)).toBe(true);
});

it("completes a legacy route with an empty identity by its display name", () => {
  const legacy = { name: "Legacy Fell", routeIdentityKey: "" };
  const completedRoutes = addUniqueCompletedRoute([], routeCompletionKey(legacy));

  expect(completedRoutes).toEqual(["Legacy Fell"]);
  expect(isRouteCompleted(completedRoutes, legacy)).toBe(true);
  expect(isExpeditionComplete({ completedRoutes, virtualHills: [legacy] })).toBe(true);
});

it("counts completed plan weeks rather than stable session IDs", () => {
  const plan = [
    { weekNumber: 1, sessions: [{ id: "ps_1_a" }, { id: "ps_1_b" }] },
    { weekNumber: 2, sessions: [{ id: "ps_2_a" }] },
  ];
  expect(countCompletedPlanWeeks(plan, {
    ps_1_a: true,
    ps_1_b: true,
    ps_2_a: false,
  })).toBe(1);
});

it("assigns stable plan session IDs and migrates positional completion keys", () => {
  const legacyPlan = [{
    weekNumber: 3,
    sessions: [
      { type: "hill", label: "Hill repeats" },
      { type: "cardio", label: "Easy run" },
    ],
  }];
  const identified = ensurePlanSessionIds(legacyPlan);
  expect(ensurePlanSessionIds(identified)).toEqual(identified);
  expect(migratePlanKeyedRecord({ "3-0": true, "3-1": false }, identified)).toEqual({
    [identified[0].sessions[0].id]: true,
    [identified[0].sessions[1].id]: false,
  });
});

it("restores only current or explicitly requested hike checkpoints", () => {
  const checkpoint = { routeId: "route-a", savedAt: 10_000 };
  expect(shouldRestoreCheckpoint(checkpoint, {
    now: 20_000,
    restoreRequested: false,
    requestedRouteId: "route-a",
  })).toBe(true);
  expect(shouldRestoreCheckpoint(checkpoint, {
    now: 20_000,
    restoreRequested: false,
    requestedRouteId: "route-b",
  })).toBe(false);
  expect(shouldRestoreCheckpoint(checkpoint, {
    now: 10_000 + 25 * 60 * 60 * 1000,
    restoreRequested: true,
  })).toBe(false);
});

it("dedupes mirrored activity attribution for one expedition", () => {
  const sessions = [{ id: "s1", activityId: "outing", expeditionId: "exp-a" }];
  const hikes = [
    { id: "h1", activityId: "outing", expeditionId: "exp-a" },
    { id: "h2", activityId: "other", expeditionId: "exp-b" },
  ];
  expect(mergeActivityKinds(
    sessions.filter(item => item.expeditionId === "exp-a"),
    hikes.filter(item => item.expeditionId === "exp-a"),
  )).toHaveLength(1);
});