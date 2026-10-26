import { describe, expect, it } from "vitest";
import { MEMBERSHIP, accessFromEntitlements, activeEntitlementIds, canUseExpedition, tierForPackage } from "@workspace/membership";

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
