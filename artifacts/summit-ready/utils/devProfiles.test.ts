import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
const getItem = vi.fn(async (key: string) => storage.get(key) ?? null);
const setItem = vi.fn(async (key: string, value: string) => { storage.set(key, value); });
const multiRemove = vi.fn(async (keys: string[]) => {
  keys.forEach((key) => storage.delete(key));
});
const multiSet = vi.fn(async (pairs: Array<[string, string]>) => {
  pairs.forEach(([key, value]) => storage.set(key, value));
});
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem, multiRemove, multiSet },
}));

describe("development profile fixtures", () => {
  beforeEach(() => {
    vi.stubGlobal("__DEV__", true);
    storage.clear();
    multiRemove.mockClear();
    multiSet.mockClear();
    getItem.mockClear();
    setItem.mockClear();
  });

  it("exposes exactly five deterministic named personas", async () => {
    const { DEV_PROFILES, DEV_FIXTURE_CLOCK, readDevRankEvidence } = await import("./devProfiles");
    const { evaluateRank } = await import("./rankEvaluator");
    expect(DEV_PROFILES).toHaveLength(5);
    expect(DEV_PROFILES.map((profile) => profile.label)).toEqual([
      "Beginner", "Active Hillwalker", "Experienced Summiteer",
      "Expedition-focused", "Advanced all-round",
    ]);
    expect(DEV_FIXTURE_CLOCK).toBe("2026-09-20T12:00:00.000Z");
    expect(readDevRankEvidence("advanced_all_round"))
      .toEqual(readDevRankEvidence("advanced_all_round"));
    const hillwalker = DEV_PROFILES.find((profile) => profile.id === "active_hillwalker")!;
    expect(JSON.parse(new Map(hillwalker.storageData).get("summitready_explore_hikes")!)).toHaveLength(6);
    expect(new Map(hillwalker.storageData).get("baseline_popup_seen")).toBe("1");
    expect(readDevRankEvidence("experienced_summiteer").some((item) => item.summitCompleted)).toBe(true);
    const availability = {
      eligibleActivities: "available",
      eligibleElevation: "available",
      distinctMountains: "available",
      summitCompletions: "available",
      activeWeeks: "available",
      expeditionMilestones: "available",
    } as const;
    expect([
      "active_hillwalker",
      "experienced_summiteer",
      "expedition_focused",
      "advanced_all_round",
    ].map((profileId) => evaluateRank({
      ownerUserId: "dev-fixture-owner",
      evidence: readDevRankEvidence(profileId),
      signalAvailability: availability,
    }).currentRank)).toEqual(["Hillwalker", "Summiteer", "Mountaineer", "Alpinist"]);
  });

  it("never exposes rank fixtures outside development", async () => {
    const {
      DEV_PROFILES,
      loadDevProfile,
      markDevProfileMigrationOwner,
      purgePersistedDevProfileForProduction,
      readDevRankEvidence,
    } = await import("./devProfiles");
    await loadDevProfile(DEV_PROFILES[4]);
    await expect(markDevProfileMigrationOwner("fixture-owner")).resolves.toBe(true);
    await expect(markDevProfileMigrationOwner("second-user")).resolves.toBe(false);
    expect(storage.get("summitready_dev_profile_owner_id")).toBe("fixture-owner");
    await multiSet([
      ["summitready_goal_fixture-owner", storage.get("summitready_goal")!],
      ["summitready_training_goal_fixture-owner", storage.get("summitready_goal")!],
      ["summitready_explore_hikes_fixture-owner", storage.get("summitready_explore_hikes")!],
      ["summitready_completed_goals_fixture-owner", storage.get("summitready_completed_goals")!],
      ["summitready_expeditions_fixture-owner", storage.get("summitready_expeditions")!],
    ]);
    await loadDevProfile(DEV_PROFILES[1]);
    expect(storage.has("summitready_goal_fixture-owner")).toBe(false);
    expect(storage.has("summitready_training_goal_fixture-owner")).toBe(false);
    await expect(markDevProfileMigrationOwner("second-user")).resolves.toBe(true);
    await multiSet([
      ["summitready_goal_second-user", storage.get("summitready_goal")!],
      ["summitready_training_goal_second-user", storage.get("summitready_goal")!],
      ["summitready_explore_hikes_second-user", storage.get("summitready_explore_hikes")!],
    ]);

    vi.stubGlobal("__DEV__", false);
    expect(readDevRankEvidence("advanced_all_round")).toEqual([]);
    await expect(loadDevProfile(DEV_PROFILES[0])).rejects.toThrow(
      "Development profiles are unavailable outside development builds",
    );
    await expect(purgePersistedDevProfileForProduction()).resolves.toBe(true);
    expect(multiRemove.mock.calls.some(([keys]) => [
      "summitready_goal_fixture-owner",
      "summitready_training_goal_fixture-owner",
      "summitready_explore_hikes_fixture-owner",
      "summitready_completed_goals_fixture-owner",
      "summitready_expeditions_fixture-owner",
    ].every((key) => keys.includes(key)))).toBe(true);
    expect(multiRemove.mock.calls.some(([keys]) => [
      "summitready_dev_profile_id",
      "summitready_goal",
      "summitready_expeditions",
      "summitready_challenges",
      "summitready_goal_second-user",
      "summitready_training_goal_second-user",
      "summitready_explore_hikes_second-user",
    ].every((key) => keys.includes(key)))).toBe(true);
    expect(storage.has("summitready_goal_fixture-owner")).toBe(false);
    expect(storage.has("summitready_training_goal_fixture-owner")).toBe(false);
    expect(storage.has("summitready_explore_hikes_fixture-owner")).toBe(false);
    expect(storage.has("summitready_goal_second-user")).toBe(false);
    expect(storage.has("summitready_training_goal_second-user")).toBe(false);
    expect(storage.has("summitready_dev_profile_id")).toBe(false);
  });

  it("rejects profile storage writes outside development", async () => {
    const { DEV_PROFILES, loadDevProfile } = await import("./devProfiles");
    vi.stubGlobal("__DEV__", false);
    await expect(loadDevProfile(DEV_PROFILES[0])).rejects.toThrow(
      "Development profiles are unavailable",
    );
    expect(multiRemove).not.toHaveBeenCalled();
    expect(multiSet).not.toHaveBeenCalled();
  });
});