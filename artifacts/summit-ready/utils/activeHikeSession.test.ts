import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const state = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  platform: { OS: "web" },
  failRemove: false,
  stopLocation: vi.fn(async () => {}),
  startedLocation: vi.fn(async () => true),
}));
vi.mock("react-native", () => ({ Platform: state.platform }));
vi.mock("expo-location", () => ({
  hasStartedLocationUpdatesAsync: state.startedLocation,
  stopLocationUpdatesAsync: state.stopLocation,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => state.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { state.storage.set(key, value); },
    removeItem: async (key: string) => { state.storage.delete(key); },
    multiSet: async (pairs: [string, string][]) => {
      pairs.forEach(([key, value]) => state.storage.set(key, value));
    },
    multiRemove: async (keys: string[]) => {
      if (state.failRemove) throw new Error("Device storage unavailable");
      keys.forEach(key => state.storage.delete(key));
    },
    getAllKeys: async () => [...state.storage.keys()],
  },
}));

import {
  ACTIVE_HIKE_KEY, HIKE_LOCATION_TASK, activeHikeKey,
  discardActiveHike, readActiveHike, readBackgroundActiveHike, writeActiveHike,
} from "./activeHikeSession";

beforeEach(() => {
  state.storage.clear();
  state.platform.OS = "web";
  state.failRemove = false;
  vi.clearAllMocks();
});

describe("discarding a recording", () => {
  const hike = { userId: "owner-one", routeId: "activity-one" };
  it("removes a finished recovery record and its GPS batches so it cannot reopen", async () => {
    await writeActiveHike({ ...hike, ...{ status: "finished" } });
    state.storage.set("hike_bg_batch_activity-one_100_a", "[]");
    state.storage.set("hike_bg_batch_activity-one_200_b", "[]");
    state.storage.set("hike_bg_batch_activity-two_100_a", "[]");
    state.storage.set("personal-route-handoff:owner-one:saved-plan", "planned geometry");
    await discardActiveHike(hike);
    expect(await readActiveHike(hike.userId)).toBeNull();
    expect(await readBackgroundActiveHike()).toBeNull();
    expect(state.storage.has("hike_bg_batch_activity-one_100_a")).toBe(false);
    expect(state.storage.has("hike_bg_batch_activity-one_200_b")).toBe(false);
    expect(state.storage.has("hike_bg_batch_activity-two_100_a")).toBe(true);
    expect(state.storage.get("personal-route-handoff:owner-one:saved-plan")).toBe("planned geometry");
  });
  it("also discards an older owned checkpoint safely", async () => {
    state.storage.set(ACTIVE_HIKE_KEY, JSON.stringify(hike));
    await discardActiveHike(hike);
    expect(state.storage.has(ACTIVE_HIKE_KEY)).toBe(false);
    expect(await readActiveHike(hike.userId)).toBeNull();
  });
  it("removes a signed-out legacy recording", async () => {
    state.storage.set(ACTIVE_HIKE_KEY, JSON.stringify({ routeId: "anonymous-activity" }));
    await discardActiveHike({ routeId: "anonymous-activity" });
    expect(state.storage.has(ACTIVE_HIKE_KEY)).toBe(false);
  });
  it("stops native background tracking for the discarded hike", async () => {
    state.platform.OS = "ios";
    await writeActiveHike(hike);
    await discardActiveHike(hike);
    expect(state.stopLocation).toHaveBeenCalledWith(HIKE_LOCATION_TASK);
  });
  it("preserves another account's active hike and native tracking", async () => {
    state.platform.OS = "ios";
    await writeActiveHike(hike);
    const other = { userId: "owner-two", routeId: "activity-two" };
    await writeActiveHike(other);
    await discardActiveHike(hike);
    expect(await readActiveHike(hike.userId)).toBeNull();
    expect(await readBackgroundActiveHike()).toEqual(other);
    expect(state.stopLocation).not.toHaveBeenCalled();
  });
  it("never deletes a different hike that became active on the same account", async () => {
    const other = { ...hike, routeId: "replacement-activity" };
    await writeActiveHike(other);
    await expect(discardActiveHike(hike)).rejects.toThrow("different hike");
    expect(await readActiveHike(hike.userId)).toEqual(other);
  });
  it("reports storage failure instead of pretending the recording was deleted", async () => {
    await writeActiveHike(hike);
    state.failRemove = true;
    await expect(discardActiveHike(hike)).rejects.toThrow("Device storage unavailable");
    expect(state.storage.has(activeHikeKey(hike.userId))).toBe(true);
  });
  it("is safe to retry after the record has already been removed", async () => {
    await writeActiveHike(hike);
    await discardActiveHike(hike);
    await expect(discardActiveHike(hike)).resolves.toBeUndefined();
  });
});

describe("discard button wiring", () => {
  const screen = readFileSync(join(__dirname, "../app/hike-tracking.tsx"), "utf8");
  const completion = readFileSync(join(__dirname, "../components/track/ActivityCompleteView.tsx"), "utf8");
  const handler = screen.slice(screen.indexOf("const handleDiscard"), screen.indexOf("// ── Save completed hike"));
  it("uses the same actual discard action on completion and short recordings", () => {
    expect(screen).toContain("onDiscard={handleDiscard}");
    expect(screen).toContain("onPress={handleDiscard}");
    expect(screen).not.toContain("onDiscard={() => router.back()}");
  });
  it("prevents checkpoint resurrection and uses a destination that needs no back stack", () => {
    expect(handler.indexOf('statusRef.current = "idle"')).toBeLessThan(handler.indexOf("await checkpointWriteRef.current"));
    expect(handler.indexOf("await checkpointWriteRef.current")).toBeLessThan(handler.indexOf("await discardActiveHike("));
    expect(handler.indexOf("await discardActiveHike(")).toBeLessThan(handler.indexOf("router.replace("));
    expect(handler).toContain("clearPendingHikeSelection(userId)");
    expect(handler).not.toContain("router.back()");
  });
  it("prevents simultaneous Save/Discard and exposes failure to the user", () => {
    expect(screen).toContain("if (saveInFlightRef.current || discardInFlightRef.current) return");
    expect(completion).toContain("disabled={saving || discarding}");
    expect(completion).toContain('testID="discard-hike"');
    expect(completion).toContain('discardError ? <Text');
    expect(handler).toContain("setDiscardError(");
  });
});