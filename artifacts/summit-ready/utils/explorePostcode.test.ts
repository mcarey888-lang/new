import { describe, expect, it } from "vitest";
import { looksLikeUkPostcode, normalizeUkPostcode } from "./explorePostcode";

describe("Explore postcode search", () => {
  it("normalises a pasted or typed UK postcode before nearby-hill lookup", () => {
    expect(normalizeUkPostcode("Bb44bh")).toBe("BB4 4BH");
    expect(normalizeUkPostcode("bb4 4bh")).toBe("BB4 4BH");
    expect(normalizeUkPostcode("SW1A 1AA")).toBe("SW1A 1AA");
    expect(normalizeUkPostcode("W1A 1HQ")).toBe("W1A 1HQ");
  });

  it("keeps incomplete postcodes out of mountain-name and AI search", () => {
    expect(looksLikeUkPostcode("BB4")).toBe(true);
    expect(looksLikeUkPostcode("BB4 4B")).toBe(true);
    expect(normalizeUkPostcode("BB4 4B")).toBeNull();
    expect(looksLikeUkPostcode("Ben Nevis")).toBe(false);
    expect(normalizeUkPostcode("Snowdonia")).toBeNull();
  });
});