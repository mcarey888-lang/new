import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUiAssetManifest, useGenerateUiAsset, FamilyId } from "@/hooks/useUiAssetWorkflow";
import { Loader2, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface UiAssetRecordMinimal {
  asset_key: string;
  display_name: string;
  category: string;
  generation_prompt: string | null;
  negative_prompt: string | null;
  aspect_ratio: string | null;
  transparent_background: boolean | null;
}

export function UiAssetGenerateModal({
  open,
  onOpenChange,
  record,
  familyId,
  isFamilyMaster,
  refineCandidateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: UiAssetRecordMinimal;
  familyId?: FamilyId;
  isFamilyMaster?: boolean;
  refineCandidateId?: string;
}) {
  const manifestQuery = useUiAssetManifest();
  const manifest = manifestQuery.data;
  const generateMut = useGenerateUiAsset();

  const [promptOverride, setPromptOverride] = useState("");
  const [candidateCount, setCandidateCount] = useState<1 | 2 | 4>(4);
  const [overrideWarning, setOverrideWarning] = useState(false);
  const [costConfirmed, setCostConfirmed] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<{ candidateId: string; version: number }[]>([]);

  useEffect(() => {
    if (open) {
      setPromptOverride(record?.generation_prompt || "");
      setCandidateCount(4);
      setOverrideWarning(false);
      setCostConfirmed(false);
    }
  }, [open, record, isFamilyMaster, refineCandidateId]);

  useEffect(() => {
    if (open && (record?.asset_key || isFamilyMaster)) {
      setSelectedReferences([]);
    }
  }, [record?.asset_key, isFamilyMaster, refineCandidateId]);

  if (!manifest) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Candidate</DialogTitle>
            <DialogDescription>
              {manifestQuery.isPending
                ? "Loading the generation workflow…"
                : "The generation workflow could not be loaded. Enter the current admin key at the top of the page, then try again."}
            </DialogDescription>
          </DialogHeader>
          {!manifestQuery.isPending && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p>The saved admin key was rejected or the workflow API is unavailable.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const targetFamilyId = familyId || (record ? familyFor(record) : null);
  const family = targetFamilyId ? manifest.families.find(f => f.familyId === targetFamilyId) : null;

  const requiresMaster = targetFamilyId === "RANKS" || targetFamilyId === "ACHIEVEMENTS";
  const hasMaster = family?.masterReferenceAsset || manifest.candidates.some(c => c.familyId === targetFamilyId && c.status === "APPROVED_FAMILY_REFERENCE");
  const showWarning = !isFamilyMaster && requiresMaster && !hasMaster;

  const hasMasterRef = !!family?.masterReferenceAsset;
  const hasRefineRef = !!refineCandidateId;
  const reservedSlots = (hasMasterRef ? 1 : 0) + (hasRefineRef ? 1 : 0);
  const availableSlots = Math.max(0, 3 - reservedSlots);
  const isOverCapacity = selectedReferences.length > availableSlots;

  const estimatedCost = candidateCount * 0.04;

  const availableReferences = manifest.candidates.filter(c =>
    c.familyId === targetFamilyId &&
    c.status === "APPROVED_ASSET" &&
    c.assetKey !== record?.asset_key
  );

  const latestRefsMap = new Map<string, typeof availableReferences[0]>();
  for (const ref of availableReferences) {
    const existing = latestRefsMap.get(ref.assetKey);
    if (!existing || ref.version > existing.version) {
      latestRefsMap.set(ref.assetKey, ref);
    }
  }
  const uniqueReferences = Array.from(latestRefsMap.values());

  const handleGenerate = async () => {
    if (showWarning && !overrideWarning) {
      toast.error("You must acknowledge the missing family master warning.");
      return;
    }
    if (!costConfirmed) {
      toast.error("You must confirm the estimated generation cost.");
      return;
    }

    try {
      await generateMut.mutateAsync({
        assetKey: isFamilyMaster ? undefined : record?.asset_key,
        familyId: targetFamilyId || undefined,
        mode: isFamilyMaster ? "family-master" : undefined,
        prompt: promptOverride !== record?.generation_prompt ? promptOverride : undefined,
        candidateCount,
        referenceCandidates: selectedReferences.length > 0 ? selectedReferences : undefined,
        confirmed: true,
        overrideFamilyWarning: overrideWarning,
        refineCandidateId,
        model: "gpt-image-1"
      });
      toast.success("Generation completed successfully.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed", {
        description: "If partial generation occurred, check the Candidates or History tabs."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFamilyMaster ? `Create ${targetFamilyId} Master Candidates` : "Create Candidate"}</DialogTitle>
          <DialogDescription>
            {isFamilyMaster ? "Establish the visual language for the family." : `Generate artwork for ${record?.display_name || record?.asset_key}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 text-sm">
          {isFamilyMaster && (
            <div className="mb-4">
              <Badge variant="secondary" className="mb-2">Family Master</Badge>
              <p className="text-xs text-muted-foreground">Generating the base art direction reference for this family.</p>
            </div>
          )}

          {record && !isFamilyMaster && (
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-xs">Asset</p>
                <p>{record.asset_key}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-xs">Family</p>
                <p>{targetFamilyId || "None"}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 border-b border-border pb-4">
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-xs">Global Style Reference</p>
              <p className="text-xs mt-1 text-muted-foreground">{family?.familyArtDirection || "None"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-xs">Family Reference</p>
                {family?.masterReferenceAsset ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                      {family.masterReferenceAsset}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">(Reserves 1 slot)</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-xs mt-1">No family master locked.</p>
                )}
              </div>
              {refineCandidateId && (
                <div>
                  <p className="font-semibold text-muted-foreground uppercase text-xs">Refinement Candidate</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="border-blue-500/50 text-blue-500 bg-blue-500/10">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      {refineCandidateId.split('-').slice(0, -1).join('-')}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">(Reserves 1 slot)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isFamilyMaster && uniqueReferences.length > 0 && (
            <div className="border-b border-border pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-muted-foreground uppercase text-xs">Related References</p>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {selectedReferences.length} of {availableSlots} slots used
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {uniqueReferences.map(ref => {
                  const isSelected = selectedReferences.some(sr => sr.candidateId === ref.candidateId && sr.version === ref.version);
                  return (
                    <Badge
                      key={ref.candidateId}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer ${isSelected ? "" : "text-muted-foreground"}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedReferences(prev => prev.filter(sr => sr.candidateId !== ref.candidateId));
                        } else {
                          if (selectedReferences.length >= availableSlots) {
                            toast.error(`Maximum capacity reached. You have ${availableSlots} available slot(s) for related references.`);
                            return;
                          }
                          setSelectedReferences(prev => [...prev, { candidateId: ref.candidateId, version: ref.version }]);
                        }
                      }}
                    >
                      {ref.assetKey} v{ref.version}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Maximum 3 total references. {reservedSlots > 0 ? `${reservedSlots} slot(s) reserved for family master and/or refinement candidate.` : "All 3 slots available for related references."}
              </p>
            </div>
          )}

          <div>
            <p className="font-semibold text-muted-foreground uppercase text-xs mb-1">Prompt (Editable for this run)</p>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-xs">Negative Prompt</p>
              <p className="text-xs mt-1">{record?.negative_prompt || "text, logos, unrelated visual systems"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-xs">Aspect Ratio</p>
              <p className="text-xs mt-1">{record?.aspect_ratio || "1:1"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-xs">Transparency</p>
              <p className="text-xs mt-1">{record?.transparent_background ? "Required" : "Not Required"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-xs">Model</p>
              <p className="text-xs mt-1">gpt-image-1</p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="font-semibold text-muted-foreground uppercase text-xs mb-2">Number of Candidates</p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 4].map(num => (
                <Button
                  key={num}
                  type="button"
                  variant={candidateCount === num ? "default" : "outline"}
                  onClick={() => setCandidateCount(num as 1 | 2 | 4)}
                  className="h-8 w-12"
                >
                  {num}
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-2 p-3 border border-border rounded-lg bg-secondary/50">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={costConfirmed} onCheckedChange={(c) => setCostConfirmed(c === true)} />
                <span className="text-sm font-medium">I confirm this run of {candidateCount} candidates using gpt-image-1</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">Estimated cost: ${estimatedCost.toFixed(2)}. This is an estimate based on provider averages, not a guaranteed billing quote.</p>
            </div>
          </div>

          {isOverCapacity && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-red-500 mt-4">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                Reference capacity exceeded. Please deselect {selectedReferences.length - availableSlots} related reference(s) to continue.
              </p>
            </div>
          )}

          {showWarning && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-500 mt-4">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Missing Family Master</p>
                <p className="text-xs text-amber-500/80">Create or approve a family reference first for the most consistent results.</p>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <Checkbox checked={overrideWarning} onCheckedChange={(c) => setOverrideWarning(c === true)} />
                  <span className="text-xs">I understand the risk and want to proceed anyway</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generateMut.isPending || (showWarning && !overrideWarning) || !costConfirmed || isOverCapacity}>
            {generateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Generation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function familyFor(record: any): FamilyId | null {
  if (record.category === "SUMMITREADY_SYMBOL") return "SIGNATURE_SYMBOLS";
  if (record.category === "RANK_ARTWORK") return "RANKS";
  if (record.category === "ACHIEVEMENT_ARTWORK") return "ACHIEVEMENTS";
  if (record.category === "EDITORIAL_IMAGE") return "EDITORIAL";
  return null;
}
