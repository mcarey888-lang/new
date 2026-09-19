import { describe, expect, it } from "vitest";
import {
  advanceSummitTransition,
  selectSummitTransition,
} from "./expeditionSummitTransition";

describe("expedition summit transition", () => {
  it("moves from not ready to ready only at canonical eligibility", () => {
    expect(selectSummitTransition({ eligible: false })).toBe("not_ready");
    expect(selectSummitTransition({ eligible: true })).toBe("ready");
    expect(advanceSummitTransition("not_ready", "eligibility")).toBe("ready");
  });

  it("starts the visual handoff once and reaches completed once", () => {
    expect(advanceSummitTransition("ready", "cinematic_ready")).toBe("started");
    expect(advanceSummitTransition("started", "cinematic_ready")).toBe("started");
    expect(advanceSummitTransition("started", "complete")).toBe("completed");
    expect(advanceSummitTransition("completed", "complete")).toBe("completed");
  });

  it("treats replay and reopen as visual-only", () => {
    expect(advanceSummitTransition("started", "reopen")).toBe("started");
    expect(advanceSummitTransition("completed", "reopen")).toBe("completed");
    expect(selectSummitTransition({
      eligible: true,
      expeditionStatus: "active",
      visualStarted: true,
    })).toBe("started");
  });

  it("recovers completed state from persisted status after restart or deep link", () => {
    expect(selectSummitTransition({ eligible: true, expeditionStatus: "complete" })).toBe("completed");
    expect(selectSummitTransition({ eligible: false, completionAwarded: true })).toBe("completed");
  });

  it("keeps fallback completion on the same idempotent path", () => {
    expect(advanceSummitTransition("ready", "complete")).toBe("completed");
    expect(advanceSummitTransition("not_ready", "complete")).toBe("not_ready");
  });
});