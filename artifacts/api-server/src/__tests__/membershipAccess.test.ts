import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let givesAccess = true;
let fail = false;
let environment = "sandbox";
let store = "app_store";
let pendingPayment = false;
let subscriptionExpiry = Date.now() + 3_600_000;
let expiry = Date.now() + 3_600_000;

beforeEach(() => {
  vi.resetModules();
  givesAccess = true;
  fail = false;
  environment = "sandbox";
  store = "app_store";
  pendingPayment = false;
  subscriptionExpiry = Date.now() + 3_600_000;
  expiry = Date.now() + 3_600_000;
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("REVENUECAT_PROJECT_ID", "project_fixture");
  vi.stubEnv("REPLIT_CONNECTORS_HOSTNAME", "connector.example.test");
  vi.stubEnv("REPL_IDENTITY", "fixture_not_a_credential");
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (fail) throw new Error("Offline");
    const url = String(input);
    if (url.includes("connector.example.test")) return Response.json({
      items: [{ settings: { access_token: "fixture_not_a_credential" } }],
    });
    if (url.includes("/subscriptions?")) return Response.json({ items:
      new URL(url).searchParams.get("environment") === environment ? [{
        environment, store, pending_payment: pendingPayment, current_period_ends_at: subscriptionExpiry,
        gives_access: givesAccess, entitlements: { items: [{ id: "ent_pro" }], next_page: null },
      }] : [], next_page: null });
    if (url.includes("/active_entitlements")) return Response.json({
      items: [{ entitlement_id: "ent_pro", expires_at: expiry }], next_page: null,
    });
    return Response.json({ items: [{ id: "ent_pro", lookup_key: "premium" }], next_page: null });
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server-verified membership", () => {
  it("uses connector credentials privately and maps legacy entitlement to full Pro", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect(await verifiedMembership("owner")).toMatchObject({ tier: "pro", legacy: true });
  });
  it("does not grant unrelated sandbox stores in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
  });
  it("recognises server-verified Google Play license-test purchases in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    store = "play_store";
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).training).toBe(true);
  });
  it("keeps ordinary production subscriptions working", async () => {
    vi.stubEnv("NODE_ENV", "production");
    environment = "production";
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).training).toBe(true);
  });
  it("rejects already expired Play test subscriptions even with a later aggregate entitlement", async () => {
    vi.stubEnv("NODE_ENV", "production");
    store = "play_store";
    subscriptionExpiry = Date.now() - 1;
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
  });
  it.each(["test_store", "promotional", "unknown"])("never grants %s sandbox access in production", async (value) => {
    vi.stubEnv("NODE_ENV", "production");
    store = value;
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
  });
  it("rejects pending Play test purchases", async () => {
    vi.stubEnv("NODE_ENV", "production");
    store = "play_store";
    pendingPayment = true;
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
  });
  it("caps retained Play test access at its accelerated expiry", async () => {
    const start = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.stubEnv("NODE_ENV", "production");
    store = "play_store";
    subscriptionExpiry = start + 60_000;
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).training).toBe(true);
    fail = true;
    vi.setSystemTime(start + 60_000);
    await expect(verifiedMembership("owner", true)).rejects.toThrow();
  });
  it("retains access during cancelled-but-unexpired and store-supported grace subscriptions", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    // Store gives_access is authority; cancellation does not equal expiry.
    expect((await verifiedMembership("owner")).training).toBe(true);
  });
  it("a verified revocation replaces a cached entitlement", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    await verifiedMembership("owner");
    givesAccess = false;
    expect((await verifiedMembership("owner", true)).tier).toBe("explore");
  });
  it("does not convert transient network failure into a downgrade", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    await verifiedMembership("owner");
    fail = true;
    expect((await verifiedMembership("owner", true)).training).toBe(true);
  });
  it("never borrows another account's verified access", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    await verifiedMembership("owner");
    fail = true;
    await expect(verifiedMembership("different-owner")).rejects.toThrow();
  });
  it("expired store evidence does not grant new paid actions", async () => {
    expiry = Date.now() - 1;
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
  });
  it("retained access ends at the verified expiry", async () => {
    const { usableCachedAccess } = await import("../services/membershipAccess");
    expect(usableCachedAccess({ access: { tier: "pro", training: true, fullExpeditions: true, legacy: false }, validUntil: 100, refreshAt: 1 }, 101)).toBe(null);
  });
  it("does not extend the 24-hour cache deadline when verification retries fail", async () => {
    const start = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    expiry = start + 3 * 24 * 3_600_000;
    const { verifiedMembership } = await import("../services/membershipAccess");
    await verifiedMembership("owner");
    fail = true;
    vi.setSystemTime(start + 23 * 3_600_000);
    expect((await verifiedMembership("owner", true)).training).toBe(true);
    vi.setSystemTime(start + 24 * 3_600_000);
    await expect(verifiedMembership("owner", true)).rejects.toThrow();
  });
  it("stops offline access at an earlier known store expiry", async () => {
    const start = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    expiry = start + 60_000;
    const { verifiedMembership } = await import("../services/membershipAccess");
    await verifiedMembership("owner");
    fail = true;
    vi.setSystemTime(start + 59_999);
    expect((await verifiedMembership("owner", true)).training).toBe(true);
    vi.setSystemTime(start + 60_000);
    await expect(verifiedMembership("owner", true)).rejects.toThrow();
  });
});
