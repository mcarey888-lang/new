import { describe, expect, it } from "vitest";
import { createExploreAiRequestGuard } from "./exploreRequestGuard";

describe("Explore AI request race guard", () => {
  it("invalidates an in-flight AI result when a fresh catalogue search starts", () => {
    const guard = createExploreAiRequestGuard();
    const pendingAiRequest = guard.begin();

    // A same-query submit or retry still begins a fresh catalogue request.
    guard.invalidate();

    expect(guard.isCurrent(pendingAiRequest)).toBe(false);
    const laterAiRequest = guard.begin();
    expect(guard.isCurrent(laterAiRequest)).toBe(true);
    expect(guard.isCurrent(pendingAiRequest)).toBe(false);
  });
});