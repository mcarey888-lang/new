import {
  getUiAssetBulkJob,
  startUiAssetBulkJob,
} from "../services/artwork/uiAssetBulkService.js";
import {
  getUiAssetManifest,
  listUiAssetBulkTargets,
} from "../services/artwork/uiAssetWorkflowService.js";

async function main() {
  const mode = process.argv[2];
  const overrideMissingMasters = process.argv.includes("--override-missing-masters");
  if (mode !== "inspect" && mode !== "start") {
    throw new Error("Usage: uiAssetBulk <inspect|start> [--override-missing-masters]");
  }
  const keys = await listUiAssetBulkTargets();
  const manifest = await getUiAssetManifest();
  const families = manifest.families
    .filter((item) => item.familyId === "RANKS" || item.familyId === "ACHIEVEMENTS")
    .map((item) => ({ family: item.familyId, hasApprovedMaster: Boolean(item.masterReferenceAsset) }));
  const existing = await getUiAssetBulkJob();
  console.info(JSON.stringify({ targetCount: keys.length, families, existingStatus: existing?.status ?? null }));
  if (mode === "inspect") return;
  if (families.some((item) => !item.hasApprovedMaster) && !overrideMissingMasters) {
    throw new Error("A family master is missing. Start from Artwork Admin after explicitly acknowledging the warning.");
  }
  const job = await startUiAssetBulkJob(true, overrideMissingMasters);
  console.info(`Bulk job started: ${job.id}`);
  let lastCompleted = -1;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const current = await getUiAssetBulkJob();
    if (!current) throw new Error("Bulk job disappeared");
    if (current.completedKeys.length !== lastCompleted) {
      lastCompleted = current.completedKeys.length;
      console.info(`Bulk artwork: ${lastCompleted}/${current.assetKeys.length}; status=${current.status}`);
    }
    if (current.status !== "RUNNING") {
      if (current.status !== "COMPLETE") throw new Error(current.error ?? `Bulk job stopped: ${current.status}`);
      break;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Bulk operation failed");
  process.exitCode = 1;
});