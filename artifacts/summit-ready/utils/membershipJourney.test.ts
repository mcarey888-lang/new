import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIP, accessFromEntitlements, canUseExpedition } from "@workspace/membership";

const app = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
describe("tier journeys stay separate", () => {
  it("checks the complete tier matrix, without any arbitrary usage cap", () => {
    const free = accessFromEntitlements([]);
    const expeditions = accessFromEntitlements(["expeditions"]);
    const pro = accessFromEntitlements(["pro"]);
    expect(free).toMatchObject({ tier: "explore", fullExpeditions: false, training: false });
    expect(expeditions).toMatchObject({ tier: "expeditions", fullExpeditions: true, training: false });
    expect(pro).toMatchObject({ tier: "pro", fullExpeditions: true, training: true });
    for (let i = 0; i < 300; i++) {
      expect(canUseExpedition(expeditions, `catalogue-${i}`)).toBe(true);
      expect(canUseExpedition(pro, `catalogue-${i}`)).toBe(true);
      expect(canUseExpedition(free, `catalogue-${i}`)).toBe(false);
    }
    expect(MEMBERSHIP.starterExpeditionId).toBe(null);
  });
  it("saves ordinary hikes without needing a paid tier or changing training/expedition progress", () => {
    const tracker = app("app/hike-tracking.tsx");
    const context = app("context/AppContext.tsx");
    const track = app("components/SharedTrackScreen.tsx");
    expect(tracker).toContain("useState(false)");
    expect(tracker).toContain("countsTowardTraining: false");
    expect(context).toContain("countsTowardTraining: hike.countsTowardTraining === true");
    expect(tracker).toContain("if (access.training && addToPlan && trainingPlan");
    expect(track).toContain('"Recording only"');
    expect(track).toContain('"Add to this expedition"');
    expect(track).toContain("canUseExpedition(access, activeExpedition?.challengeId)");
  });
  it("keeps free hiking achievements free and expiry history available", () => {
    const challenges = app("app/challenge-detail.tsx");
    const gate = app("components/MembershipGate.tsx");
    expect(challenges).toContain("General hiking challenges remain free");
    expect(gate).toContain("Historical training plan · read only");
    expect(gate).toContain("Historical readiness:");
  });
  it("keeps real store prices and eligible trials separate from target figures", () => {
    const paywall = app("app/paywall.tsx");
    expect(paywall).toContain("annualPkg.product?.priceString");
    expect(paywall).toContain("monthlyPkg.product?.priceString");
    expect(paywall).toContain("trialDaysForPackage(activePkg) === 14");
    expect(paywall).not.toContain("£34.99");
    expect(paywall).not.toContain("£69.99");
  });
});
