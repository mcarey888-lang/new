import { describe, expect, it } from "vitest";
import {
  canonicalImageSubject,
  exactImageSubject,
  isRouteSpecificImageRequest,
  mountainImageCacheKey,
  scenicCandidateScore,
} from "../routes/mountain-image.js";

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

  it("preserves route identity for exact image searches", () => {
    expect(exactImageSubject("Tryfan North Ridge")).toBe("Tryfan North Ridge");
    expect(isRouteSpecificImageRequest("Tryfan North Ridge")).toBe(true);
    expect(isRouteSpecificImageRequest("Tryfan", "route:v1:tryfan-north-ridge")).toBe(true);
  });

  it("rejects nearby scenery that does not name the full route", () => {
    expect(scenicCandidateScore(
      "Llyn Ogwen reservoir panorama.jpg",
      "Tryfan North Ridge",
      4000,
      2000,
      true,
    )).toBe(-1000);
    expect(scenicCandidateScore(
      "Tryfan North Ridge from the Ogwen Valley.jpg",
      "Tryfan North Ridge",
      4000,
      2000,
      true,
    )).toBeGreaterThan(0);
    expect(scenicCandidateScore(
      "Crib Goch from Snowdon.jpg",
      "Crib Goch Traverse",
      4000,
      2000,
      true,
    )).toBeGreaterThan(0);
  });

  it("keys route images by stable identity rather than broad place name", () => {
    expect(mountainImageCacheKey({
      name: "Tryfan North Ridge",
      location: "Eryri",
      routeIdentityKey: "route:v1:osm:Tryfan:53.114,-3.998",
    })).toBe("route:route:v1:osm:tryfan:53.114,-3.998");
  });
});