import { describe, expect, it } from "vitest";
import { verifiedTrialDays } from "./membershipTrial";
import { accessFromEntitlements, cachedEntitlementIds } from "@workspace/membership";

const pkg = (offering: string, product: unknown) => ({
  identifier: "$rc_annual", presentedOfferingContext: { offeringIdentifier: offering }, product,
});
const ios = { introPrice: { price: 0, cycles: 1, periodUnit: "DAY", periodNumberOfUnits: 14 } };
const android = { defaultOption: { freePhase: { billingPeriod: { iso8601: "P2W" } } } };

describe("verified Pro trials", () => {
  it("requires both the iOS eligibility response and the configured free fortnight", () => {
    expect(verifiedTrialDays("ios", pkg("pro", ios), true)).toBe(14);
    expect(verifiedTrialDays("ios", pkg("pro", ios), false)).toBe(null);
    expect(verifiedTrialDays("ios", pkg("pro", { introPrice: { ...ios.introPrice, price: 1 } }), true)).toBe(null);
    expect(verifiedTrialDays("ios", pkg("pro", { introPrice: { ...ios.introPrice, periodNumberOfUnits: 7 } }), true)).toBe(null);
  });
  it.each(["P2W", "P14D"])("uses the actual eligible Play default option %s", iso8601 => {
    expect(verifiedTrialDays("android", pkg("pro", { defaultOption: { freePhase: { billingPeriod: { iso8601 } } } }))).toBe(14);
  });
  it("does not advertise an unavailable, web, or Expeditions trial", () => {
    expect(verifiedTrialDays("android", pkg("pro", {}))).toBe(null);
    expect(verifiedTrialDays("web", pkg("pro", android))).toBe(null);
    expect(verifiedTrialDays("android", pkg("expeditions", android))).toBe(null);
    expect(verifiedTrialDays("ios", pkg("expeditions", ios), true)).toBe(null);
  });
  it("gives a verified Pro trial Pro access only until its known expiry", () => {
    const now = Date.now();
    const info = { requestDate: new Date(now).toISOString(), entitlements: { active: {
      pro: { isActive: true, periodType: "TRIAL", expirationDate: new Date(now + 1000).toISOString() },
    } } };
    expect(accessFromEntitlements(cachedEntitlementIds(info, now)).tier).toBe("pro");
    expect(accessFromEntitlements(cachedEntitlementIds(info, now + 1000)).tier).toBe("explore");
  });
});
