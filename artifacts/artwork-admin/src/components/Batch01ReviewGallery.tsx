import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, RotateCw, CheckCircle, XCircle, ExternalLink, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

type CandidateStatus = "REVIEW REQUIRED" | "APPROVED" | "REJECTED";
type ObjectiveFailureReason =
  | "TEXT_OR_WATERMARK"
  | "COLLAGE_OR_MULTI_PANEL"
  | "SEVERE_ANATOMY_OR_EQUIPMENT"
  | "WRONG_MOUNTAIN_MORPHOLOGY"
  | "UNUSABLE_CROP"
  | "FANTASY_GEOGRAPHY";

type ReviewCandidate = {
  assetId: string;
  title: string;
  family: string;
  placement: string;
  cropGuidance: string;
  provider: string;
  model: string;
  dimensions: string;
  version: number;
  generationCost: number;
  status: CandidateStatus;
  approved: boolean;
  published: false;
  generatedAt: string;
  statusChangedAt?: string;
  rejectionReason?: string;
  masterPath: string;
  heroPath: string;
  cardPath: string;
};

type ReviewManifest = {
  batchId: string;
  status: "REVIEW REQUIRED";
  estimatedCost: number;
  candidates: ReviewCandidate[];
  versions: ReviewCandidate[];
};

const FAILURE_REASONS: Array<{ value: ObjectiveFailureReason; label: string }> = [
  { value: "TEXT_OR_WATERMARK", label: "Text or watermark" },
  { value: "COLLAGE_OR_MULTI_PANEL", label: "Collage or multi-panel image" },
  { value: "SEVERE_ANATOMY_OR_EQUIPMENT", label: "Severe anatomy or equipment error" },
  { value: "WRONG_MOUNTAIN_MORPHOLOGY", label: "Wrong mountain morphology" },
  { value: "UNUSABLE_CROP", label: "Unusable required crop" },
  { value: "FANTASY_GEOGRAPHY", label: "Fantasy or impossible geography" },
];

function statusClass(status: CandidateStatus) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function Batch01ReviewGallery() {
  const [manifest, setManifest] = useState<ReviewManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [action, setAction] = useState<{ kind: "approve" | "reject" | "regenerate"; candidate: ReviewCandidate } | null>(null);
  const [reason, setReason] = useState<ObjectiveFailureReason>("UNUSABLE_CROP");

  const loadManifest = async () => {
    const response = await fetch("/api/artwork/batches/batch-01", { cache: "no-store" });
    if (!response.ok) throw new Error(`Review batch request failed (${response.status})`);
    setManifest(await response.json());
  };

  useEffect(() => {
    loadManifest().catch((failure) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, []);

  const versionsByAsset = useMemo(() => {
    const grouped = new Map<string, ReviewCandidate[]>();
    for (const version of manifest?.versions ?? []) {
      grouped.set(version.assetId, [...(grouped.get(version.assetId) ?? []), version]);
    }
    for (const versions of grouped.values()) versions.sort((a, b) => b.version - a.version);
    return grouped;
  }, [manifest]);

  const headers = () => ({
    "Content-Type": "application/json",
    "x-vx-admin-key": adminKey,
  });

  const persistAdminKey = (value: string) => {
    setAdminKey(value);
    if (value) sessionStorage.setItem("summitready-admin-key", value);
    else sessionStorage.removeItem("summitready-admin-key");
  };

  const mutate = async (candidate: ReviewCandidate, kind: "approve" | "reject" | "regenerate") => {
    if (!adminKey) {
      toast.error("Enter the admin key before changing artwork");
      return;
    }
    setBusy(`${candidate.assetId}:${kind}`);
    try {
      const path = kind === "regenerate"
        ? "/api/artwork/batches/batch-01/generate"
        : `/api/artwork/batches/batch-01/${candidate.assetId}/v${candidate.version}/${kind}`;
      const body = kind === "regenerate"
        ? { assetId: candidate.assetId, objectiveFailureReason: reason, confirmed: true }
        : kind === "reject"
          ? { reason }
          : {};
      const response = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? `${kind} failed (${response.status})`);
      setManifest(kind === "regenerate" ? await (await fetch("/api/artwork/batches/batch-01", { cache: "no-store" })).json() : result);
      toast.success(kind === "approve" ? "Exact version approved" : kind === "reject" ? "Version rejected and retained" : "New review version generated");
      setAction(null);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!manifest) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Batch 01 review candidates</div>;
  }

  return (
    <section className="flex flex-col gap-5" data-testid="section-batch-01">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-medium">Flagship Artwork — Batch 01</h3>
          <p className="mt-1 text-sm text-muted-foreground">{manifest.candidates.length}/12 candidates · persistent versioned curation</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form className="relative" onSubmit={(event) => event.preventDefault()}>
            <LockKeyhole className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              autoComplete="current-password"
              aria-label="Admin API key"
              placeholder="Admin key for review actions"
              value={adminKey}
              onChange={(event) => persistAdminKey(event.target.value)}
              className="w-64 pl-9"
            />
          </form>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">{manifest.status}</Badge>
          <span className="text-xs text-muted-foreground">Spend ${manifest.estimatedCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Publication boundary:</strong> approval records visual sign-off only. Publish is unavailable until the persistent Media catalogue is implemented.
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {manifest.candidates.map((candidate) => {
          const history = versionsByAsset.get(candidate.assetId) ?? [candidate];
          const isBusy = busy?.startsWith(candidate.assetId);
          return (
            <article key={candidate.assetId} className="overflow-hidden rounded-xl border border-border bg-card">
              <a href={candidate.masterPath} target="_blank" rel="noreferrer" className="group relative block">
                <img src={candidate.masterPath} alt={`${candidate.title} master candidate`} className="aspect-[3/2] w-full object-cover" />
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"><ExternalLink className="h-3 w-3" /> View master</span>
              </a>
              <div className="grid grid-cols-2 gap-3 border-t border-border bg-background/40 p-3">
                <figure><img src={candidate.heroPath} alt={`${candidate.title} 16:9 crop`} className="aspect-video w-full rounded-md object-cover" /><figcaption className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Master derivative · 16:9 hero</figcaption></figure>
                <figure className="flex items-start gap-3"><img src={candidate.cardPath} alt={`${candidate.title} 4:5 crop`} className="aspect-[4/5] w-24 rounded-md object-cover" /><figcaption className="text-[10px] uppercase tracking-wider text-muted-foreground">Placement derivative · 4:5 card</figcaption></figure>
              </div>
              <div className="space-y-4 border-t border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-mono text-xs text-primary">{candidate.assetId}</p><h4 className="mt-1 font-semibold">{candidate.title}</h4><p className="text-xs text-muted-foreground">{candidate.family}</p></div>
                  <Badge variant="outline" className={statusClass(candidate.status)}>{candidate.status}</Badge>
                </div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-foreground">Intended app use</p><p className="mt-1 text-sm text-muted-foreground">{candidate.placement}</p></div>
                <p className="text-xs text-muted-foreground">{candidate.cropGuidance}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{candidate.provider} · {candidate.model} · {candidate.dimensions} · v{candidate.version} · ${candidate.generationCost.toFixed(2)}</p>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setAction({ kind: "approve", candidate })} disabled={isBusy || candidate.status === "APPROVED"}><CheckCircle className="mr-1.5 h-4 w-4" /> Approve v{candidate.version}</Button>
                  <Button size="sm" variant="destructive" onClick={() => { setReason("UNUSABLE_CROP"); setAction({ kind: "reject", candidate }); }} disabled={isBusy || candidate.status === "REJECTED"}><XCircle className="mr-1.5 h-4 w-4" /> Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReason("UNUSABLE_CROP"); setAction({ kind: "regenerate", candidate }); }} disabled={isBusy || history.length >= 3}><RotateCw className="mr-1.5 h-4 w-4" /> Regenerate</Button>
                  <Button size="sm" variant="outline" disabled title="Requires persistent Media catalogue">Publish unavailable</Button>
                </div>

                <details className="rounded-lg border border-border bg-background/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Version history ({history.length})</summary>
                  <div className="mt-3 space-y-2">
                    {history.map((version) => (
                      <div key={version.version} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-xs">
                        <span className="font-mono">v{version.version} · {new Date(version.generatedAt).toLocaleString()}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={statusClass(version.status)}>{version.status}</Badge>
                          <a className="text-primary hover:underline" href={version.masterPath} target="_blank" rel="noreferrer">Inspect master</a>
                          <Button size="sm" variant="outline" className="h-7" disabled={Boolean(isBusy) || version.status === "APPROVED"} onClick={() => setAction({ kind: "approve", candidate: version })}>Approve</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-red-300" disabled={Boolean(isBusy) || version.status === "REJECTED"} onClick={() => { setReason("UNUSABLE_CROP"); setAction({ kind: "reject", candidate: version }); }}>Reject</Button>
                        </div>
                        {version.rejectionReason && <p className="w-full text-muted-foreground">Reason: {version.rejectionReason.replaceAll("_", " ")}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.kind === "approve" ? "Approve this exact version?" : action?.kind === "reject" ? "Reject this exact version?" : "Regenerate this asset?"}</DialogTitle>
            <DialogDescription>
              {action?.candidate.title} · {action?.candidate.provider}/{action?.candidate.model}
              {action?.kind === "regenerate" && " · estimated cost $0.04"}
            </DialogDescription>
          </DialogHeader>
          {action?.kind !== "approve" && (
            <label className="space-y-2 text-sm">
              <span className="font-medium">Objective failure reason</span>
              <select value={reason} onChange={(event) => setReason(event.target.value as ObjectiveFailureReason)} className="h-10 w-full rounded-md border border-input bg-background px-3">
                {FAILURE_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            {action?.kind === "approve" ? `Only ${action.candidate.assetId} v${action.candidate.version} will be approved. It will not be published.` : action?.kind === "reject" ? "The image, prompt and version remain in history." : "Only this asset will be generated. The current version remains in history and the new version returns to REVIEW REQUIRED."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant={action?.kind === "reject" ? "destructive" : "default"} disabled={!action || Boolean(busy)} onClick={() => action && mutate(action.candidate, action.kind)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {action?.kind}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}