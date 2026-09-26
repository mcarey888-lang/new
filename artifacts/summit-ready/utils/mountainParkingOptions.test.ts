import { describe, expect, it } from "vitest";
import { sourcedParkingOptionsForMountain } from "./mountainParkingOptions";
import type { MountainLookupResponse } from "./mountainDetailPresentation";

const verifiedGable: MountainLookupResponse = {
  source: "canonical",
  mountainName: "Great Gable",
  canonicalIdentity: { id: "mountain-id", canonicalSourceKey: "dobih:2367" },
  trustedFacts: { verificationStatus: "verified" },
};

describe("sourced mountain parking", () => {
  it("offers distinct, sourced parking options for the matched canonical mountain", () => {
    const options = sourcedParkingOptionsForMountain(verifiedGable);
    expect(options.map(option => option.approach)).toEqual([
      "Wasdale approach", "Honister approach", "Borrowdale / Seathwaite approach",
    ]);
    expect(options.every(option =>
      /^NY\d{6}$/.test(option.osGridReference) &&
      option.sourceUrl.startsWith("https://www.nationaltrust.org.uk/"))).toBe(true);
  });

  it("does not inherit options from a matching display name or unverified catalogue row", () => {
    expect(sourcedParkingOptionsForMountain({
      ...verifiedGable, source: "ai", canonicalIdentity: undefined,
    })).toEqual([]);
    expect(sourcedParkingOptionsForMountain({
      ...verifiedGable, canonicalIdentity: { id: "other-id", canonicalSourceKey: "other-source" },
    })).toEqual([]);
    expect(sourcedParkingOptionsForMountain({
      ...verifiedGable, trustedFacts: { verificationStatus: "imported" },
    })).toEqual([]);
  });
});