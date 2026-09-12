import { describe, expect, it } from "vitest";
import { canonicalImageSubject, scenicCandidateScore } from "../routes/mountain-image.js";

describe("mountain hero image selection", () => {
  it("uses the summit rather than a full approach title", () => {
    expect(canonicalImageSubject("Helvellyn via Striding Edge and Swirral Edge"))
      .toBe("Helvellyn");
    expect(canonicalImageSubject("Scafell Pike circular route")).toBe("Scafell Pike");
  });

  it("prefers wide scenic summit views over path close-ups", () => {
    const panorama = scenicCandidateScore(
      "Helvellyn panorama from the Eastern Fells.jpg",
      "Helvellyn",
      6000,
      3000,
    );
    const path = scenicCandidateScore(
      "Path on the slopes of Helvellyn.jpg",
      "Helvellyn",
      1200,
      900,
    );
    expect(panorama).toBeGreaterThan(path);
    expect(scenicCandidateScore("Unrelated fell.jpg", "Helvellyn", 6000, 3000)).toBe(-1000);
  });
});