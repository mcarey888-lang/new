import { useUiAssetManifest } from "@/hooks/useUiAssetWorkflow";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function UiAssetHistoryView() {
  const { data: manifest, isLoading, error } = useUiAssetManifest();

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
        Failed to load history. Verify admin key.
      </div>
    );
  }

  const sorted = [...manifest.history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-4">
      {sorted.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-primary">{entry.id}</p>
              <p className="font-semibold mt-1">
                {entry.assetKey}{" "}
                <span className="text-muted-foreground font-normal text-sm ml-2">({entry.familyId})</span>
              </p>
            </div>
            <Badge variant="outline">{entry.outcome}</Badge>
          </div>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Time:</strong> {new Date(entry.timestamp).toLocaleString()}
            </p>
            <p>
              <strong className="text-foreground">Candidates:</strong> {entry.candidateCount}
            </p>
            {entry.referenceDescriptors && entry.referenceDescriptors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <strong className="text-foreground">References:</strong>
                {entry.referenceDescriptors.map((desc) => (
                  <Badge key={`${desc.candidateId}-${desc.version}`} variant="secondary" className="text-[10px]">
                    {desc.assetKey} v{desc.version}
                  </Badge>
                ))}
              </div>
            )}
            <p>
              <strong className="text-foreground">Provider:</strong> {entry.provider || "N/A"}
            </p>
            {entry.error && (
              <p className="text-red-400">
                <strong className="text-red-500">Error:</strong> {entry.error}
              </p>
            )}
          </div>
        </div>
      ))}
      {sorted.length === 0 && (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-background/50">
          No generation history.
        </div>
      )}
    </div>
  );
}
