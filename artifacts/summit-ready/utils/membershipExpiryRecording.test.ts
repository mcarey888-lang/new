import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessFromEntitlements, cachedEntitlementIds } from "@workspace/membership";
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
} }));
import { enqueueSyncPending, readOutbox, retrySyncOutbox } from "./syncOutbox";
import { privateRecordedHikeBackup } from "./recordedHikeRecovery";

describe("ordinary recorded-hike backup across membership states", () => {
  beforeEach(() => { storage.clear(); vi.unstubAllGlobals(); });
  it.each(["explore", "expeditions", "pro", "premium"])("%s can queue and sync a hike, including after paid expiry", async tier => {
    const owner = "recording-test-owner";
    const start = Date.parse("2026-10-27T10:00:00Z");
    const requestDate = new Date(start).toISOString();
    const receipt = { requestDate, entitlements: { active: tier === "explore" ? {} : {
      [tier]: { isActive: true, expirationDate: new Date(start + 60_000).toISOString() },
    } } };
    const before = accessFromEntitlements(cachedEntitlementIds(receipt, start));
    expect(before.tier).toBe(tier === "premium" ? "pro" : tier);
    // The recording/history pipeline receives no tier flag and remains usable
    // when access expires mid-recording. This is not a native GPS simulation.
    const after = accessFromEntitlements(cachedEntitlementIds(receipt, start + 120_000));
    expect(after.tier).toBe("explore");
    const historical = JSON.stringify({ plan: ["week 1"], completed: ["stage 1"], achievements: ["summit"] });
    storage.set("existing-history", historical);
    const hike = {
      id: "ordinary-hike", elevationGain: 20, distance: 2, timeTaken: 30,
      notes: "Recorded hike", trackPoints: [{ lat: 53, lon: -2, alt: 100, ts: start }],
    };
    const revision = new Date(start + 120_000).toISOString();
    const body = privateRecordedHikeBackup(hike, revision);
    expect(body.snapshot.trackPoints).toEqual(hike.trackPoints);
    await enqueueSyncPending(owner, {
      id: `private-hike:${hike.id}`, kind: "private-hike", method: "PUT", url: "/api/recorded-hikes", body,
    });
    expect(await readOutbox(owner)).toHaveLength(1);
    const token = `header.${btoa(JSON.stringify({ sub: owner }))}.signature`;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true, hikeId: hike.id, revision,
    }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await retrySyncOutbox(owner, async () => token);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await readOutbox(owner)).toHaveLength(0);
    expect(storage.get("existing-history")).toBe(historical);
    expect(hike.trackPoints).toHaveLength(1);
  });
});
