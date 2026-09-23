import { useUiAssetManifest, UiAssetCandidate, uiAssetLoadError } from "@/hooks/useUiAssetWorkflow";
import { CandidateCard } from "./CandidateCard";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { UiAssetGenerateModal } from "./UiAssetGenerateModal";
import rawCatalogue from "../../../../docs/summitready-master-asset-inventory.json";

function getCatalogueRecord(assetKey: string) {
  return rawCatalogue.records.find(r => r.asset_key === assetKey);
}

export function UiAssetCandidates() {
  const { data: manifest, isLoading, error } = useUiAssetManifest();
  const [actionCandidate, setActionCandidate] = useState<{ candidate: UiAssetCandidate, action: "refine" | "regenerate" } | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="p-8 text-center text-red-400">
        {uiAssetLoadError(error, "candidates")}
      </div>
    );
  }

  const sorted = [...manifest.candidates].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );

  const targetRecord = actionCandidate ? getCatalogueRecord(actionCandidate.candidate.assetKey) : undefined;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sorted.map((candidate) => (
          <CandidateCard
            key={candidate.candidateId}
            candidate={candidate}
            onRefine={(c) => setActionCandidate({ candidate: c, action: "refine" })}
            onRegenerate={(c) => setActionCandidate({ candidate: c, action: "regenerate" })}
          />
        ))}
        {sorted.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-background/50">
            No candidates generated yet.
          </div>
        )}
      </div>

      <UiAssetGenerateModal
        open={!!actionCandidate}
        onOpenChange={(o) => !o && setActionCandidate(null)}
        record={targetRecord}
        familyId={actionCandidate?.candidate.familyId}
        isFamilyMaster={actionCandidate?.candidate.assetKey.startsWith("FAMILY-MASTER")}
        refineCandidateId={actionCandidate?.action === "refine" ? actionCandidate.candidate.candidateId : undefined}
      />
    </div>
  );
}
