import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import { useActivityReview, useUpdateActivityReview, type ActivitySuggestion, type ReviewStatus } from "../hooks/use-activity-review";

const STATUSES: ReviewStatus[] = ["pending", "in_review", "approved", "rejected"];
const label = (s: string) => s.replace("_", " ");

function Row({ s }: { s: ActivitySuggestion }) {
  const [notes, setNotes] = useState(s.reviewNotes ?? "");
  const m = useUpdateActivityReview();
  const changed = !!s.currentRevision && s.currentRevision !== s.evidenceRevision;
  const hasNotes = notes.trim().length > 0;
  const busy = m.isPending || changed || !hasNotes;
  const act = (status: "in_review" | "approved" | "rejected") =>
    m.mutate(
      { owner: s.owner, hikeId: s.hikeId, status, evidenceRevision: s.evidenceRevision, reviewNotes: notes.trim() },
      {
        onSuccess: () => toast.success(`Marked ${label(status)}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
      },
    );
  return (
    <li className="rounded-md border border-border bg-card p-4 space-y-3" data-testid={`row-review-${s.hikeId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{s.name || "Untitled recording"}</div>
        <Badge variant="secondary">{label(s.status)}</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        Member-recorded: {s.date ? new Date(s.date).toLocaleDateString() : "date unknown"} ·{" "}
        {s.distance != null ? `${s.distance} km` : "distance unknown"} ·{" "}
        {s.elevationGain != null ? `${s.elevationGain} m elevation gain` : "elevation gain unknown"}
        <br />Source: user_recording (not verified)
        <br />Owner {s.owner} · Hike {s.hikeId}
        {s.reviewedAt ? ` · reviewed ${new Date(s.reviewedAt).toLocaleString()}` : ""}
      </div>
      {changed && (
        <div role="alert" className="rounded border border-destructive/50 p-2 text-sm text-destructive">
          The evidence changed after it was suggested. All transitions are disabled until the owner re-suggests.
        </div>
      )}
      <Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Reviewer notes" />
      {!hasNotes && <p className="text-xs text-muted-foreground">Reviewer notes are required for every transition.</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy || s.status !== "pending"} onClick={() => act("in_review")}>Start review</Button>
        <Button size="sm" disabled={busy || s.status !== "in_review"} onClick={() => act("approved")}>Approve as candidate</Button>
        <Button size="sm" variant="destructive" disabled={busy || s.status !== "in_review"} onClick={() => act("rejected")}>Reject</Button>
      </div>
    </li>
  );
}

export default function ActivityReview() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [page, setPage] = useState(0);
  const q = useActivityReview(status, page);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ArtworkAdminHeader activeSection="activity-review" />
      <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Approval marks a reviewed candidate only. It does not create a canonical verified route and does not enter the Summit Data Engine.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={s === status ? "default" : "secondary"} onClick={() => { setStatus(s); setPage(0); }}>
              {label(s)}
            </Button>
          ))}
        </div>
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading suggestions...</div>
        ) : q.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Failed to load"}</p>
            <Button size="sm" onClick={() => q.refetch()}>Retry</Button>
          </div>
        ) : q.data && q.data.suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {label(status)} suggestions.</p>
        ) : (
          <ul className="space-y-3">{q.data?.suggestions.map((s) => <Row key={`${s.owner}/${s.hikeId}`} s={s} />)}</ul>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="secondary" disabled={!q.data?.hasMore || page >= 50} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </main>
    </div>
  );
}
