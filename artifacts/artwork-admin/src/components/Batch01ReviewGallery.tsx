import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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
  status: "REVIEW REQUIRED";
  masterPath: string;
  heroPath: string;
  cardPath: string;
};

type ReviewManifest = {
  batchId: string;
  status: "REVIEW REQUIRED";
  estimatedCost: number;
  candidates: ReviewCandidate[];
};

export function Batch01ReviewGallery() {
  const [manifest, setManifest] = useState<ReviewManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/artwork/batches/batch-01")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Review batch request failed (${response.status})`);
        return response.json();
      })
      .then(setManifest)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!manifest) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Batch 01 review candidates
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5" data-testid="section-batch-01">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-xl font-medium">Flagship Artwork — Batch 01</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {manifest.candidates.length}/12 independently stored candidates · review only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
            {manifest.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Estimated generation cost ${manifest.estimatedCost.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {manifest.candidates.map((candidate) => (
          <article key={candidate.assetId} className="overflow-hidden rounded-xl border border-border bg-card">
            <img
              src={candidate.masterPath}
              alt={`${candidate.title} master candidate`}
              className="aspect-[3/2] w-full object-cover"
            />
            <div className="grid grid-cols-2 gap-3 border-t border-border bg-background/40 p-3">
              <figure>
                <img src={candidate.heroPath} alt={`${candidate.title} 16:9 crop`} className="aspect-video w-full rounded-md object-cover" />
                <figcaption className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">16:9 hero</figcaption>
              </figure>
              <figure className="flex items-start gap-3">
                <img src={candidate.cardPath} alt={`${candidate.title} 4:5 crop`} className="aspect-[4/5] w-24 rounded-md object-cover" />
                <figcaption className="text-[10px] uppercase tracking-wider text-muted-foreground">4:5 card</figcaption>
              </figure>
            </div>
            <div className="space-y-3 border-t border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-primary">{candidate.assetId}</p>
                  <h4 className="mt-1 font-semibold">{candidate.title}</h4>
                  <p className="text-xs text-muted-foreground">{candidate.family}</p>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-300">{candidate.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{candidate.placement}</p>
              <p className="text-xs text-muted-foreground">{candidate.cropGuidance}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {candidate.provider} · {candidate.model} · {candidate.dimensions} · v{candidate.version} · ${candidate.generationCost.toFixed(2)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}