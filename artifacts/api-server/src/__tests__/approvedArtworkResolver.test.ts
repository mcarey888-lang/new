import { describe, expect, it } from "vitest";
import { resolveApprovedBatch01Artwork } from "../services/artwork/approvedArtworkResolver.js";

function candidate(version: number, status: "APPROVED" | "REVIEW REQUIRED" | "REJECTED", approved: boolean) {
  return {
    assetId: "SR-MTN-MONTBLANC-001",
    version,
    status,
    approved,
    heroPath: `/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v${version}/hero`,
    cardPath: `/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v${version}/card`,
    thumbnailPath: `/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v${version}/thumbnail`,
  } as any;
}

describe("approved Batch 01 artwork resolver", () => {
  it("resolves an approved current crop by stable asset ID and typed placement", () => {
    const result = resolveApprovedBatch01Artwork(
      { versions: [candidate(1, "APPROVED", true)] },
      "SR-MTN-MONTBLANC-001",
      "hero",
    );
    expect(result).toEqual({
      assetId: "SR-MTN-MONTBLANC-001",
      version: 1,
      placement: "hero",
      derivativePath: "/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero",
      url: "/api/artwork/approved/SR-MTN-MONTBLANC-001/hero",
    });
    expect(result).not.toHaveProperty("status");
    expect(result?.url).not.toContain("/v1/");
    expect(result?.derivativePath).toContain("/v1/hero");
  });

  it("does not resolve review or rejected candidates", () => {
    expect(resolveApprovedBatch01Artwork(
      { versions: [candidate(1, "REVIEW REQUIRED", false)] },
      "SR-MTN-MONTBLANC-001",
      "card",
    )).toBeNull();
    expect(resolveApprovedBatch01Artwork(
      { versions: [candidate(1, "REJECTED", false)] },
      "SR-MTN-MONTBLANC-001",
      "card",
    )).toBeNull();
  });

  it("never falls back to an older approved version", () => {
    expect(resolveApprovedBatch01Artwork(
      {
        versions: [
          candidate(1, "APPROVED", true),
          candidate(2, "REVIEW REQUIRED", false),
        ],
      },
      "SR-MTN-MONTBLANC-001",
      "thumbnail",
    )).toBeNull();
  });

  it("returns null for unknown assets, placements, and missing paths", () => {
    expect(resolveApprovedBatch01Artwork({ versions: [] }, "missing", "hero")).toBeNull();
    expect(resolveApprovedBatch01Artwork(
      { versions: [candidate(1, "APPROVED", true)] },
      "SR-MTN-MONTBLANC-001",
      "master",
    )).toBeNull();
  });
});