import { approvedMountainBatchAssetId, resolveApprovedBatch01Artwork } from "./approvedArtworkResolver.js";
import { getBatch01Manifest } from "./reviewBatchService.js";

/** Read shared App Storage approval metadata, never generate or mutate it. */
export async function approvedBatchHero(name: string) {
  const assetId = approvedMountainBatchAssetId(name);
  if (!assetId) return null;
  return resolveApprovedBatch01Artwork(await getBatch01Manifest(), assetId, "hero");
}
