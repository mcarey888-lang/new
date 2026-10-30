import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SummitGoal } from "../context/AppContext";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
} }));
import { saveTrainingSetupDraft, loadTrainingSetupDraft, clearTrainingSetupDraft, parseTrainingSetupDraft, trainingSetupDraftKey } from "./trainingSetupDraft";
import { sanitisePaywallParams } from "./paywallAuthReturn";
import { promoteTrainingSetupDraft } from "./trainingSetupDraft";
import AsyncStorage from "@react-native-async-storage/async-storage";

const goal: SummitGoal = {
  mountainName: "Synthetic summit", summitDate: "2030-08-01", distance: 12,
  elevationGain: 900, highestAltitude: 1000, difficulty: "Moderate", fitnessLevel: "Average",
  location: "Synthetic location", maxRadius: 25, equipment: ["none"], trainingDaysPerWeek: 4, hillDaysPerWeek: 2,
};
beforeEach(() => storage.clear());
describe("free fitness setup, not a free personalised plan", () => {
  it("saves only the account-scoped draft and preserves existing plans and history", async () => {
    storage.set("existing_plan", "untouched"); storage.set("existing_activity", "untouched");
    await saveTrainingSetupDraft("synthetic_a", goal);
    expect(await loadTrainingSetupDraft("synthetic_a")).toEqual(goal);
    expect(await loadTrainingSetupDraft("synthetic_b")).toBeNull();
    expect(storage.size).toBe(3);
    expect(storage.get("existing_plan")).toBe("untouched");
    expect(storage.get("existing_activity")).toBe("untouched");
  });
  it("rejects anonymous and malformed drafts without fabricating results", () => {
    expect(() => trainingSetupDraftKey("")).toThrow(/Sign in/);
    expect(parseTrainingSetupDraft(null)).toBeNull();
    expect(() => parseTrainingSetupDraft("{broken")).toThrow();
    expect(() => parseTrainingSetupDraft('{"version":1,"goal":{}}')).toThrow(/could not be loaded/);
  });
  it("clears only the promoted draft and not a newer edited profile or another account", async () => {
    await saveTrainingSetupDraft("synthetic_a", goal);
    await saveTrainingSetupDraft("synthetic_b", goal);
    const newer = { ...goal, elevationGain: 1100 };
    await saveTrainingSetupDraft("synthetic_a", newer);
    await clearTrainingSetupDraft("synthetic_a", goal);
    expect(await loadTrainingSetupDraft("synthetic_a")).toEqual(newer);
    await clearTrainingSetupDraft("synthetic_a", newer);
    expect(await loadTrainingSetupDraft("synthetic_a")).toBeNull();
    expect(await loadTrainingSetupDraft("synthetic_b")).toEqual(goal);
  });
  it("retains the internal Basecamp return through purchase/auth sanitisation", () => {
    expect(sanitisePaywallParams({ tier: "pro", returnTo: "training_basecamp" })).toMatchObject({ tier: "pro", returnTo: "training_basecamp" });
    expect(sanitisePaywallParams({ returnTo: "https://example.com" }).returnTo).toBeUndefined();
  });
  it("keeps questionnaire/setup ungated and real training/readiness behind verified Pro", () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    expect(read("../app/questionnaire.tsx")).not.toContain("<MembershipGate>");
    expect(read("../app/setup.tsx")).not.toContain("<MembershipGate>");
    const hook = read("../hooks/useTrainingSetupDraft.ts");
    expect(hook).toContain("if (isLoading || !access.training");
    expect(read("./trainingSetupDraft.ts")).toContain("activated.current !== signature && !alreadyCurrent");
    const dashboard = read("../app/(tabs)/dashboard.tsx");
    expect(dashboard).toContain("!access.training");
    expect(read("../components/basecamp/TrainingBasecampPreview.tsx")).toContain("result={null}");
    expect(read("./trainingSetupDraft.ts")).not.toContain("generatePlan(");
    expect(read("./trainingSetupDraft.ts")).not.toContain("calculateReadiness(");
  });
  it("does not activate a Free or Expeditions profile, even when a draft exists", async () => {
    await saveTrainingSetupDraft("synthetic_a", goal);
    const createPlan = vi.fn(), changePlan = vi.fn();
    await expect(promoteTrainingSetupDraft({ userId: "synthetic_a", goal, canTrain: false,
      activeGoal: null, hasPlan: false, activated: { current: null }, createPlan, changePlan })).rejects.toThrow(/Pro is required/);
    expect(createPlan).not.toHaveBeenCalled(); expect(changePlan).not.toHaveBeenCalled();
    expect(await loadTrainingSetupDraft("synthetic_a")).toEqual(goal);
  });
  it("activates a new Pro/trial profile once and consumes the saved setup", async () => {
    await saveTrainingSetupDraft("synthetic_a", goal);
    const createPlan = vi.fn().mockResolvedValue(undefined), changePlan = vi.fn();
    const input = { userId: "synthetic_a", goal, canTrain: true,
      activeGoal: null, hasPlan: false, activated: { current: null }, createPlan, changePlan };
    expect(await promoteTrainingSetupDraft(input)).toBeNull();
    await promoteTrainingSetupDraft(input);
    expect(createPlan).toHaveBeenCalledTimes(1); expect(changePlan).not.toHaveBeenCalled();
  });
  it("preserves existing training sessions using the existing change path, and skips unchanged plans", async () => {
    const createPlan = vi.fn(), changePlan = vi.fn().mockResolvedValue(undefined);
    const input = { userId: "synthetic_a", goal, canTrain: true,
      activeGoal: { ...goal, elevationGain: 800 }, hasPlan: true, activated: { current: null }, createPlan, changePlan };
    await promoteTrainingSetupDraft(input);
    expect(createPlan).not.toHaveBeenCalled(); expect(changePlan).toHaveBeenCalledWith(goal);
    changePlan.mockClear();
    await promoteTrainingSetupDraft({ ...input, activeGoal: goal, activated: { current: null } });
    expect(changePlan).not.toHaveBeenCalled();
  });
  it("retains a profile after activation failure and does not activate twice after cleanup failure", async () => {
    await saveTrainingSetupDraft("synthetic_a", goal);
    const createPlan = vi.fn().mockRejectedValueOnce(new Error("Synthetic failure")).mockResolvedValue(undefined);
    const input = { userId: "synthetic_a", goal, canTrain: true,
      activeGoal: null, hasPlan: false, activated: { current: null }, createPlan, changePlan: vi.fn() };
    await expect(promoteTrainingSetupDraft(input)).rejects.toThrow("Synthetic failure");
    expect(await loadTrainingSetupDraft("synthetic_a")).toEqual(goal);
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("Synthetic storage failure"));
    await expect(promoteTrainingSetupDraft(input)).rejects.toThrow("Synthetic storage failure");
    expect(await promoteTrainingSetupDraft(input)).toBeNull();
    expect(createPlan).toHaveBeenCalledTimes(2); // failed attempt + one successful activation
  });
});
