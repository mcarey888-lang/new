import { describe, expect, it } from "vitest";
import { validateExpeditionResultContract } from "./expeditionResultContract";

describe("custom expedition result contract", () => {
  it("accepts a resolved target without recommending hills prematurely", () => {
    expect(() => validateExpeditionResultContract(
      { resolutionOnly: true, targetProfile: { name: "Great Gable" } },
      { resolveOnly: true, mode: "manual" },
    )).not.toThrow();
  });

  it("rejects a full-plan response with no hill list before rendering", () => {
    expect(() => validateExpeditionResultContract(
      { targetProfile: { name: "Great Gable" } },
      { resolveOnly: false, mode: "automatic" },
    )).toThrow("missing its recommended hills");
  });

  it("requires the builder for a manual request and accepts a complete result", () => {
    const result = { targetProfile: { name: "Great Gable" }, recommendedHills: [] };
    expect(() => validateExpeditionResultContract(result, {
      resolveOnly: false, mode: "manual",
    })).toThrow("custom expedition builder");
    expect(() => validateExpeditionResultContract(
      { ...result, manualBuilder: { eligibleSummitPool: [] } },
      { resolveOnly: false, mode: "manual" },
    )).not.toThrow();
  });
});