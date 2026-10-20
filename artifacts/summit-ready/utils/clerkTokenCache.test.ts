import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clerkTokenStoragePrefix } from "./clerkTokenStorage";

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  platform: { OS: "android" },
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: storage.platform }));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: "after-first-unlock",
  getItemAsync: storage.getItemAsync,
  setItemAsync: storage.setItemAsync,
  deleteItemAsync: storage.deleteItemAsync,
}));

const LIVE = "pk_live_testFixture";
const DEVELOPMENT = "pk_test_testFixture";
const CLIENT_KEY = "__clerk_client_jwt";

async function cacheFor(key: string) {
  vi.stubEnv("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", key);
  vi.resetModules();
  return (await import("./clerkTokenCache")).clerkTokenCache;
}

beforeEach(() => {
  storage.values.clear();
  storage.platform.OS = "android";
  storage.getItemAsync.mockReset().mockImplementation(async key =>
    storage.values.get(key) ?? null);
  storage.setItemAsync.mockReset().mockImplementation(async (key, value) => {
    storage.values.set(key, value);
  });
  storage.deleteItemAsync.mockReset().mockImplementation(async key => {
    storage.values.delete(key);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("instance-scoped Clerk token storage", () => {
  it("uses supported storage characters and distinct, stable namespaces", () => {
    expect(clerkTokenStoragePrefix(LIVE)).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(clerkTokenStoragePrefix(LIVE)).toBe(clerkTokenStoragePrefix(LIVE));
    expect(clerkTokenStoragePrefix(LIVE)).not.toBe(clerkTokenStoragePrefix(DEVELOPMENT));
    expect(clerkTokenStoragePrefix("pk_live_a/b")).not.toBe(clerkTokenStoragePrefix("pk_live_a_b"));
  });

  it("never reads the legacy unscoped client credential after upgrading", async () => {
    storage.values.set(`summitready_clerk_v2_${CLIENT_KEY}`, "old-client-fixture");
    const cache = await cacheFor(LIVE);
    expect(await cache.getToken(CLIENT_KEY)).toBeNull();
    expect(storage.getItemAsync).not.toHaveBeenCalledWith(
      `summitready_clerk_v2_${CLIENT_KEY}`, expect.anything(),
    );
  });

  it("does not reuse a development client JWT in a live instance", async () => {
    const dev = await cacheFor(DEVELOPMENT);
    await dev.saveToken(CLIENT_KEY, "development-client-fixture");
    const live = await cacheFor(LIVE);
    expect(await live.getToken(CLIENT_KEY)).toBeNull();
    await live.saveToken(CLIENT_KEY, "live-client-fixture");
    const devReloaded = await cacheFor(DEVELOPMENT);
    expect(await devReloaded.getToken(CLIENT_KEY)).toBe("development-client-fixture");
  });

  it("preserves authentication across reloads of the same instance", async () => {
    const first = await cacheFor(LIVE);
    await first.saveToken(CLIENT_KEY, "live-client-fixture");
    const reloaded = await cacheFor(LIVE);
    expect(await reloaded.getToken(CLIENT_KEY)).toBe("live-client-fixture");
  });

  it("clears only tracked credentials in the current instance", async () => {
    const dev = await cacheFor(DEVELOPMENT);
    await dev.saveToken(CLIENT_KEY, "development-client-fixture");
    storage.values.set("recorded-hike-fixture", "private-hike-fixture");
    const live = await cacheFor(LIVE);
    await live.saveToken(CLIENT_KEY, "live-client-fixture");
    await live.clearAll();
    expect(storage.values.get(`${clerkTokenStoragePrefix(DEVELOPMENT)}${CLIENT_KEY}`))
      .toBe("development-client-fixture");
    expect(storage.values.get("recorded-hike-fixture")).toBe("private-hike-fixture");
    expect(await live.getToken(CLIENT_KEY)).toBeNull();
  });

  it("still bounds a stalled native token read", async () => {
    vi.useFakeTimers();
    storage.getItemAsync.mockImplementation(() => new Promise(() => {}));
    const cache = await cacheFor(LIVE);
    const token = cache.getToken(CLIENT_KEY);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await token).toBeNull();
  });

  it("keeps web credentials in memory without calling native storage", async () => {
    storage.platform.OS = "web";
    const cache = await cacheFor(LIVE);
    await cache.saveToken(CLIENT_KEY, "web-client-fixture");
    expect(await cache.getToken(CLIENT_KEY)).toBe("web-client-fixture");
    await cache.clearAll();
    expect(await cache.getToken(CLIENT_KEY)).toBeNull();
    expect(storage.getItemAsync).not.toHaveBeenCalled();
    expect(storage.setItemAsync).not.toHaveBeenCalled();
    expect(storage.deleteItemAsync).not.toHaveBeenCalled();
  });
});
