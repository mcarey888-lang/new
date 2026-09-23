import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminKey } from "@/contexts/AdminKeyContext";
import { adminKeyHeader } from "@/lib/adminKey";
import { useUiAssetManifest } from "@/hooks/useUiAssetWorkflow";

type BulkJob = {
  id: string;
  status: "RUNNING" | "COMPLETE" | "FAILED" | "INTERRUPTED";
  assetKeys: string[];
  completedKeys: string[];
  currentAssetKey?: string;
  historyIds: Record<string, string>;
  startedAt: string;
  error?: string;
};

export function UiAssetBulkPanel({ onNavigate }: { onNavigate: (tab: "candidates" | "history") => void }) {
  const adminKey = useAdminKey();
  const manifest = useUiAssetManifest();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledgeMissingMaster, setAcknowledgeMissingMaster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const queryKey = ["ui-asset-bulk", adminKey];
  const bulk = useQuery({
    queryKey,
    enabled: Boolean(adminKey.trim()),
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/artwork/ui-assets/bulk", {
        headers: adminKeyHeader(adminKey),
        signal,
      });
      if (!response.ok) throw new Error(`Could not load bulk progress (${response.status})`);
      return response.json() as Promise<{ job: BulkJob | null }>;
    },
    retry: false,
    refetchInterval: (query) => query.state.data?.job?.status === "RUNNING" ? 5_000 : false,
  });

  const job = bulk.data?.job;
  const missingMasters = manifest.data?.families
    .filter((family) => (family.familyId === "RANKS" || family.familyId === "ACHIEVEMENTS") && !family.masterReferenceAsset)
    .map((family) => family.displayName) ?? [];
  const currentHistoryId = job?.currentAssetKey ? job.historyIds[job.currentAssetKey] : undefined;
  const currentCount = manifest.data?.history.find((entry) => entry.id === currentHistoryId)?.resultCandidateIds.length ?? 0;

  const start = async () => {
    if (!adminKey.trim() || !manifest.data || !confirmed || (missingMasters.length > 0 && !acknowledgeMissingMaster)) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/artwork/ui-assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminKeyHeader(adminKey) },
        body: JSON.stringify({ confirmed: true, overrideFamilyWarning: acknowledgeMissingMaster }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Could not start bulk generation (${response.status})`);
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({ queryKey: ["ui-asset-workflow"] });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Bulk generation could not start");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Bulk artwork generation" className="rounded-xl border border-primary/25 bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-lg font-semibold">Generate all Rank, Achievement &amp; Editorial artwork</h3>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        One batch: 7 Ranks + 6 Achievements + 21 Editorial images. Four new draft options per asset
        (136 images total). The server processes one asset at a time and saves progress as it goes.
        Estimated provider cost: about $5.44; actual charges may differ. Nothing is approved or published automatically.
      </p>

      {job ? (
        <div className="mt-4 space-y-3 text-sm" role="status" aria-live="polite">
          <p className="font-medium">
            {job.status === "RUNNING" ? "Generating" : job.status === "COMPLETE" ? "Batch complete" : "Batch stopped"}
            {" · "}{job.completedKeys.length} of {job.assetKeys.length} assets finished
            {job.status === "RUNNING" && currentCount > 0 ? ` · ${currentCount} of 4 on current asset` : ""}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${job.completedKeys.length / job.assetKeys.length * 100}%` }} />
          </div>
          {job.currentAssetKey && <p className="font-mono text-xs text-muted-foreground">Current: {job.currentAssetKey}</p>}
          {job.error && <p className="text-destructive" role="alert">{job.error} No automatic retry was made; review History before taking action.</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("candidates")}>View candidates</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("history")}>View history</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          {!adminKey.trim() && <p className="text-muted-foreground">Enter your admin key above to start or check a batch.</p>}
          {missingMasters.length > 0 && manifest.data && (
            <label className="flex items-start gap-2 text-amber-300">
              <Checkbox
                checked={acknowledgeMissingMaster}
                onCheckedChange={(value) => setAcknowledgeMissingMaster(value === true)}
                className="mt-0.5"
              />
              <span>No approved family master for {missingMasters.join(" and ")}. I understand these families may look less consistent and want to proceed.</span>
            </label>
          )}
          <label className="flex items-start gap-2">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
            <span>I authorise generation of 136 draft images and the associated provider charges.</span>
          </label>
          <Button type="button" onClick={() => void start()} disabled={!adminKey.trim() || !manifest.data || bulk.isPending || submitting || !confirmed || (missingMasters.length > 0 && !acknowledgeMissingMaster)}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate all 34 assets
          </Button>
          {submitError && <p className="text-destructive" role="alert">{submitError}</p>}
          {bulk.error && <p className="text-destructive" role="alert">{bulk.error.message}</p>}
        </div>
      )}
    </section>
  );
}