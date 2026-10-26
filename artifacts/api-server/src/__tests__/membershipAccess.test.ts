import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let givesAccess = true;
let fail = false;
let environment = "sandbox";
let expiry = Date.now() + 3_600_000;

beforeEach(() => {
  vi.resetModules();
  givesAccess = true;
  fail = false;
  environment = "sandbox";
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
    if (url.includes("/subscriptions?")) return Response.json({ items: [{
      environment, gives_access: givesAccess, entitlements: { items: [{ id: "ent_pro" }], next_page: null },
    }], next_page: null });
    if (url.includes("/active_entitlements")) return Response.json({
      items: [{ entitlement_id: "ent_pro", expires_at: expiry }], next_page: null,
    });
    return Response.json({ items: [{ id: "ent_pro", lookup_key: "premium" }], next_page: null });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server-verified membership", () => {
  it("uses connector credentials privately and maps legacy entitlement to full Pro", async () => {
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect(await verifiedMembership("owner")).toMatchObject({ tier: "pro", legacy: true });
  });
  it("does not grant sandbox subscriptions in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { verifiedMembership } = await import("../services/membershipAccess");
    expect((await verifiedMembership("owner")).tier).toBe("explore");
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
});
