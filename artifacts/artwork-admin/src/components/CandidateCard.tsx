import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Sparkles, RotateCw } from "lucide-react";
import { UiAssetCandidate, useTransitionCandidate } from "@/hooks/useUiAssetWorkflow";
import { ImageBlob } from "./ImageBlob";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export function CandidateCard({
  candidate,
  onRefine,
  onRegenerate,
}: {
  candidate: UiAssetCandidate;
  onRefine: (candidate: UiAssetCandidate) => void;
  onRegenerate: (candidate: UiAssetCandidate) => void;
}) {
  const transMut = useTransitionCandidate();
  const [actionModal, setActionModal] = useState<{
    kind: "select" | "reject" | "approve-as-asset" | "approve-as-family-reference";
    reason?: string;
  } | null>(null);

  const statusColor =
    candidate.status === "APPROVED_ASSET" || candidate.status === "APPROVED_FAMILY_REFERENCE"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : candidate.status === "REJECTED"
        ? "border-red-500/30 bg-red-500/10 text-red-500"
        : candidate.status === "SELECTED"
          ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-500";

  const handleAction = async () => {
    if (!actionModal) return;
    await transMut.mutateAsync({
      candidateId: candidate.candidateId,
      action: actionModal.kind,
      reason: actionModal.reason,
    });
    setActionModal(null);
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card flex flex-col">
      <div className="relative group">
        <ImageBlob
          candidateId={candidate.candidateId}
          version={candidate.version}
          crop="master"
          className="aspect-[3/2] w-full"
          alt="Master"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-border bg-background/40 p-3">
        <figure>
          <ImageBlob
            candidateId={candidate.candidateId}
            version={candidate.version}
            crop="hero"
            className="aspect-video w-full rounded-md"
            alt="Hero"
          />
          <figcaption className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">16:9 hero</figcaption>
        </figure>
        <figure className="flex items-start gap-3">
          <ImageBlob
            candidateId={candidate.candidateId}
            version={candidate.version}
            crop="card"
            className="aspect-[4/5] w-24 rounded-md"
            alt="Card"
          />
          <figcaption className="text-[10px] uppercase tracking-wider text-muted-foreground">4:5 card</figcaption>
        </figure>
      </div>
      <div className="p-4 space-y-4 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-primary">{candidate.assetKey}</p>
            <p className="text-xs text-muted-foreground">{candidate.familyId}</p>
          </div>
          <Badge variant="outline" className={statusColor}>
            {candidate.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          v{candidate.version} · {candidate.model}
        </p>

        <details className="rounded-lg border border-border bg-background/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">Prompt details</summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {candidate.prompt}
          </p>
        </details>

        <div className="flex flex-wrap gap-2 pt-2">
          {candidate.status === "DRAFT" && (
            <Button size="sm" variant="outline" onClick={() => setActionModal({ kind: "select" })} disabled={transMut.isPending}>
              <CheckCircle className="mr-1.5 h-4 w-4" /> Select
            </Button>
          )}

          {candidate.status === "SELECTED" && (
            <>
              {candidate.assetKey.startsWith("FAMILY-MASTER") ? (
                <Button size="sm" onClick={() => setActionModal({ kind: "approve-as-family-reference" })} disabled={transMut.isPending}>
                  <CheckCircle className="mr-1.5 h-4 w-4" /> Approve as Family Reference
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => setActionModal({ kind: "approve-as-asset" })} disabled={transMut.isPending}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Approve as Asset
                  </Button>
                  {candidate.assetKey === "SR-SYM-ELEVATION-BANK-001" && (
                    <Button size="sm" variant="secondary" onClick={() => setActionModal({ kind: "approve-as-family-reference" })} disabled={transMut.isPending}>
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Approve as Family Reference
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {candidate.status !== "REJECTED" &&
            candidate.status !== "APPROVED_ASSET" &&
            candidate.status !== "APPROVED_FAMILY_REFERENCE" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300"
                onClick={() => setActionModal({ kind: "reject", reason: "UNUSABLE" })}
                disabled={transMut.isPending}
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            )}

          {candidate.status !== "REJECTED" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onRegenerate(candidate)}>
                <RotateCw className="mr-1.5 h-4 w-4" /> Regenerate
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onRefine(candidate)}>
                <Sparkles className="mr-1.5 h-4 w-4" /> Refine
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Apply {actionModal?.kind.replace(/-/g, " ")} to this candidate?
            </DialogDescription>
          </DialogHeader>
          {actionModal?.kind === "reject" && (
            <div className="space-y-2 py-4">
              <label className="text-sm font-medium">Reason</label>
              <select
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
              >
                <option value="UNUSABLE">Unusable</option>
                <option value="POOR_QUALITY">Poor Quality</option>
                <option value="NOT_ON_BRAND">Not on Brand</option>
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant={actionModal?.kind === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={transMut.isPending}
            >
              {transMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
