import { useUiAssetManifest, useLockFamily, FamilyId, uiAssetLoadError } from "@/hooks/useUiAssetWorkflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Unlock, Plus } from "lucide-react";
import { UiAssetGenerateModal } from "./UiAssetGenerateModal";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export function UiAssetFamilies() {
  const { data: manifest, isLoading, error } = useUiAssetManifest();
  const lockMut = useLockFamily();
  const [masterFamily, setMasterFamily] = useState<FamilyId | null>(null);
  const [lockAction, setLockAction] = useState<{ familyId: FamilyId, locked: boolean } | null>(null);

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
        {uiAssetLoadError(error, "families")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {manifest.families.map((family) => (
        <div key={family.familyId} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h3 className="text-xl font-semibold">{family.displayName}</h3>
              <p className="text-sm text-muted-foreground mt-1">{family.familyId}</p>
            </div>
            <Badge
              variant="outline"
              className={
                family.status === "LOCKED"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : family.status === "UNLOCKED"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-500"
              }
            >
              {family.status === "LOCKED"
                ? "FAMILY STYLE LOCKED"
                : family.status === "UNLOCKED"
                  ? "FAMILY REFERENCE DRAFT"
                  : "NO FAMILY REFERENCE"}
            </Badge>
          </div>

          <div className="mt-4 text-sm space-y-3">
            <div>
              <span className="font-semibold uppercase text-xs text-muted-foreground">Art Direction</span>
              <p className="mt-1">{family.familyArtDirection}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <span className="font-semibold uppercase text-xs text-muted-foreground">Master Reference</span>
                <p className="mt-1 font-mono text-xs">{family.masterReferenceAsset || "None"}</p>
              </div>
              <div>
                <span className="font-semibold uppercase text-xs text-muted-foreground">Additional References</span>
                <p className="mt-1 font-mono text-xs">{family.additionalReferenceAssets.join(", ") || "None"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => setMasterFamily(family.familyId)}>
              <Plus className="mr-2 h-4 w-4" />
              {family.familyId === "ACHIEVEMENTS" ? "Create Achievement Master" : "Create Family Master"}
            </Button>

            {family.status === "LOCKED" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLockAction({ familyId: family.familyId, locked: false })}
                disabled={lockMut.isPending}
              >
                <Unlock className="mr-2 h-4 w-4" /> Unlock Family Style
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLockAction({ familyId: family.familyId, locked: true })}
                disabled={lockMut.isPending || !family.masterReferenceAsset}
              >
                <Lock className="mr-2 h-4 w-4" /> Lock Family Style
              </Button>
            )}
          </div>
        </div>
      ))}

      <UiAssetGenerateModal
        open={!!masterFamily}
        onOpenChange={(o) => !o && setMasterFamily(null)}
        familyId={masterFamily || undefined}
        isFamilyMaster={true}
      />

      <Dialog open={!!lockAction} onOpenChange={o => !o && setLockAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lockAction?.locked ? "Lock Family Style" : "Unlock Family Style"}</DialogTitle>
            <DialogDescription>
              {lockAction?.locked
                ? "Locking means all future runs inherit the approved reference. It does not approve members."
                : "Unlocking means future generations may diverge. It does not regenerate approved assets."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockAction(null)}>Cancel</Button>
            <Button
              variant={lockAction?.locked ? "default" : "destructive"}
              disabled={lockMut.isPending}
              onClick={async () => {
                if (!lockAction) return;
                try {
                  await lockMut.mutateAsync({ familyId: lockAction.familyId, locked: lockAction.locked });
                  toast.success(lockAction.locked ? "Family style locked" : "Family style unlocked");
                  setLockAction(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Lock action failed");
                }
              }}
            >
              {lockMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {lockAction?.locked ? "Lock" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
