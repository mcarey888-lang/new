import { describe, expect, it } from "vitest";
import { MEMBERSHIP, accessFromEntitlements, activeEntitlementIds, cachedEntitlementIds, canUseExpedition, tierForPackage } from "@workspace/membership";

describe("three-tier membership policy", () => {
  it("keeps anonymous and free users out of personalised training and paid expeditions", () => {
    const access = accessFromEntitlements([]);
    expect(access).toEqual({ tier: "explore", training: false, fullExpeditions: false, legacy: false });
    expect(canUseExpedition(access, "SIG001")).toBe(false);
  });
  it("gives the Expeditions tier no training privileges", () => {
    expect(accessFromEntitlements(["expeditions"])).toMatchObject({ tier: "expeditions", training: false, fullExpeditions: true });
  });
  it.each(["pro", "premium"])("preserves full access for %s", id => {
    const access = accessFromEntitlements([id]);
    expect(access.training).toBe(true);
    expect(canUseExpedition(access, "any")).toBe(true);
    expect(access.legacy).toBe(id === "premium");
  });
  it("retains middle-tier access after Pro actually expires", () => {
    expect(accessFromEntitlements(["expeditions"])).toMatchObject({ training: false, fullExpeditions: true });
  });
  it("never treats an arbitrary free flag or null identity as a starter entitlement", () => {
    expect(MEMBERSHIP.starterExpeditionId).toBe(null);
    expect(canUseExpedition(accessFromEntitlements([]), null)).toBe(false);
    expect(canUseExpedition(accessFromEntitlements([]), "free")).toBe(false);
  });
  it("a designated starter authorises only that complete expedition identity", () => {
    try {
      (MEMBERSHIP as { starterExpeditionId: string | null }).starterExpeditionId = "verified-starter-fixture";
      const access = accessFromEntitlements([]);
      expect(canUseExpedition(access, "verified-starter-fixture")).toBe(true);
      expect(canUseExpedition(access, "different-expedition")).toBe(false);
      expect(canUseExpedition(access, null)).toBe(false);
    } finally {
      (MEMBERSHIP as { starterExpeditionId: string | null }).starterExpeditionId = null;
    }
  });
  it("uses known verified expiry, not a client trial flag", () => {
    const info = { entitlements: { active: {
      pro: { isActive: true, expirationDate: "2026-10-26T10:00:00Z" },
      expeditions: { isActive: true, expirationDate: "2026-10-28T10:00:00Z" },
      premium: { isActive: false, expirationDate: null },
    } } };
    expect(activeEntitlementIds(info, Date.parse("2026-10-27T10:00:00Z"))).toEqual(["expeditions"]);
  });
  it("maps only explicit offering/package identities, never product positions", () => {
    expect(tierForPackage("$rc_annual", "default")).toBe("pro");
    expect(tierForPackage("$rc_monthly", "expeditions")).toBe("expeditions");
    expect(tierForPackage("first_product", "unknown")).toBe(null);
  });
});

describe("bounded mobile SDK evidence", () => {
  const start = Date.parse("2026-10-27T10:00:00Z");
  const info = (active: Record<string, { isActive: boolean; expirationDate: string | null }>) => ({
    requestDate: new Date(start).toISOString(), entitlements: { active },
  });
  it.each(["pro", "premium", "expeditions"])("retains valid %s evidence during an outage, but not past 24 hours", id => {
    const receipt = info({ [id]: { isActive: true, expirationDate: null } });
    expect(cachedEntitlementIds(receipt, start + MEMBERSHIP.maxCachedAccessMs - 1)).toEqual([id]);
    expect(cachedEntitlementIds(receipt, start + MEMBERSHIP.maxCachedAccessMs)).toEqual([]);
  });
  it("reading the same cached receipt repeatedly never renews the allowance", () => {
    const receipt = info({ pro: { isActive: true, expirationDate: null } });
    for (let hour = 0; hour < 24; hour++) expect(cachedEntitlementIds(receipt, start + hour * 3_600_000)).toEqual(["pro"]);
    expect(cachedEntitlementIds(receipt, start + 25 * 3_600_000)).toEqual([]);
    expect(receipt.requestDate).toBe(new Date(start).toISOString());
  });
  it("honours earlier Pro expiry without losing still-valid Expeditions access", () => {
    const receipt = info({
      pro: { isActive: true, expirationDate: new Date(start + 60_000).toISOString() },
      expeditions: { isActive: true, expirationDate: new Date(start + 3_600_000).toISOString() },
    });
    expect(accessFromEntitlements(cachedEntitlementIds(receipt, start + 60_000))).toMatchObject({
      tier: "expeditions", training: false, fullExpeditions: true,
    });
  });
  it("does not infer access from missing, malformed, or implausibly future response dates", () => {
    const receipt = info({ pro: { isActive: true, expirationDate: null } });
    for (const requestDate of [undefined, "", "not-a-date", new Date(start + 600_000).toISOString()]) {
      expect(cachedEntitlementIds({ ...receipt, requestDate }, start)).toEqual([]);
    }
  });
  it("a fresh verified response can renew access, but revoked entitlement cannot", () => {
    const receipt = info({ premium: { isActive: true, expirationDate: null } });
    const now = start + 25 * 3_600_000;
    expect(cachedEntitlementIds({ ...receipt, requestDate: new Date(now).toISOString() }, now)).toEqual(["premium"]);
    expect(cachedEntitlementIds({ ...receipt, requestDate: new Date(now).toISOString(), entitlements: { active: {} } }, now)).toEqual([]);
  });
});
