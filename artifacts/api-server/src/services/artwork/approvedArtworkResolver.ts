import type { ReviewBatchManifest, ReviewCandidate } from "./reviewBatchService.js";

/**
 * The only placements exposed by the approved Batch 01 contract.  In
 * particular, master is intentionally not a placement clients can request.
 */
export const APPROVED_ARTWORK_PLACEMENTS = ["hero", "card", "thumbnail"] as const;
export type ApprovedArtworkPlacement = typeof APPROVED_ARTWORK_PLACEMENTS[number];

export interface ApprovedArtworkReference {
  assetId: string;
  placement: ApprovedArtworkPlacement;
  url: string;
}

const placementPath: Record<ApprovedArtworkPlacement, keyof Pick<
  ReviewCandidate,
  "heroPath" | "cardPath" | "thumbnailPath"
>> = {
  hero: "heroPath",
  card: "cardPath",
  thumbnail: "thumbnailPath",
};

function isPlacement(value: string): value is ApprovedArtworkPlacement {
  return (APPROVED_ARTWORK_PLACEMENTS as readonly string[]).includes(value);
}

/**
 * Resolve an approved Batch 01 image without exposing review metadata.
 *
 * `versions` is the source of truth for currentness: an older approved
 * version must not become live again after a newer version is reviewed or
 * rejected.  The resolver is deliberately pure and performs no storage or
 * provider work.
 */
export function resolveApprovedBatch01Artwork(
  manifest: Pick<ReviewBatchManifest, "versions">,
  assetId: string,
  placement: string,
): ApprovedArtworkReference | null {
  if (!isPlacement(placement)) return null;

  const assetVersions = manifest.versions.filter((candidate) => candidate.assetId === assetId);
  const currentVersion = assetVersions.reduce<ReviewCandidate | null>(
    (current, candidate) => !current || candidate.version > current.version ? candidate : current,
    null,
  );
  if (!currentVersion || currentVersion.status !== "APPROVED" || currentVersion.approved !== true) {
    return null;
  }

  const storedCrop = currentVersion[placementPath[placement]];
  return typeof storedCrop === "string" && storedCrop.length > 0
    ? {
        assetId,
        placement,
        url: `/api/artwork/approved/${encodeURIComponent(assetId)}/${placement}`,
      }
    : null;
}