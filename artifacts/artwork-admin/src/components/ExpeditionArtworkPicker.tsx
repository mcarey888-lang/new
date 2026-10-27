import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetExpeditionArtworkLibrary200ItemsItem as LibItem } from "@workspace/api-client-react";
import { useArtworkLibrary, useAssignExpeditionArtwork, type ExpeditionSummary } from "../hooks/use-expeditions";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function Img({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (broken) return <div className={`${className} flex items-center justify-center border border-dashed border-destructive/50 bg-destructive/5 p-2 text-center text-xs text-destructive`}>Image failed to load</div>;
  return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setBroken(true)} />;
}

export function ExpeditionArtworkPicker({ source, isNew, dirty, onAssigned, onPending }: {
  source: ExpeditionSummary | null; isNew: boolean; dirty: boolean; onAssigned: (id: string) => void;
  onPending: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<LibItem | null>(null);
  const [replace, setReplace] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saved = !isNew && !!source;
  const lib = useArtworkLibrary(open && saved && !dirty);
  const assign = useAssignExpeditionArtwork();
  useEffect(() => { onPending(assign.isPending); }, [assign.isPending, onPending]);
  useEffect(() => () => onPending(false), [onPending]);

  const currentVersion = source?.imageVersion ?? 0;
  const hasExisting = currentVersion > 0;
  const showCurrent = saved && hasExisting && source?.approved === true;
  const items = (lib.data?.items ?? []).filter((x) => x.challengeId !== source?.challengeId);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((x) => !needle || x.challengeName.toLowerCase().includes(needle) || x.targetMountainName.toLowerCase().includes(needle) || x.challengeId.toLowerCase().includes(needle));
  const canAssign = saved && !dirty && !!pick && (!hasExisting || replace) && !assign.isPending;

  const doAssign = () => {
    if (!canAssign || !source || !pick) return;
    setErr(null);
    assign.mutate({ id: source.challengeId, body: { sourceChallengeId: pick.challengeId, sourceImageVersion: pick.imageVersion, expectedUpdatedAt: source.updatedAt, ...(hasExisting ? { replaceExisting: true } : {}) } }, {
      onSuccess: (r) => { toast.success(`Artwork assigned (version ${r.imageVersion})`); setOpen(false); setPick(null); setConfirm(false); onAssigned(source.challengeId); },
      onError: (e) => {
        setConfirm(false);
        const status = (e as { status?: number }).status;
        const m = e instanceof Error ? e.message : "Assignment failed";
        setErr(status === 409 ? `${m} The expedition or its artwork changed elsewhere. Reload this expedition, then try again.` : m);
      },
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="expedition-artwork">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Artwork</h3>
        <Button type="button" size="sm" variant="secondary" data-testid="button-choose-artwork" disabled={!saved || dirty} onClick={() => { setOpen((o) => !o); setErr(null); }}>{open ? "Close artwork picker" : "Choose artwork"}</Button>
      </div>
      {!saved && <p className="text-sm text-muted-foreground">Create draft first. Artwork can be assigned once this expedition is saved.</p>}
      {saved && dirty && <p className="text-sm text-amber-600">Save changes first. Assigning artwork refreshes this record and would discard unsaved edits.</p>}
      {saved && (showCurrent
        ? <div className="flex flex-wrap gap-3" data-testid="artwork-current">
            <Img src={`/api/artwork/image/${source!.challengeId}/hero?approved=1&v=${currentVersion}`} alt="Current hero" className="h-24 w-40 rounded" />
            <Img src={`/api/artwork/image/${source!.challengeId}/card?approved=1&v=${currentVersion}`} alt="Current card" className="h-24 w-20 rounded" />
            <Img src={`/api/artwork/image/${source!.challengeId}/thumbnail?approved=1&v=${currentVersion}`} alt="Current thumbnail" className="h-16 w-16 rounded" />
            <span className="self-end text-xs text-muted-foreground">Current approved artwork, version {currentVersion}</span>
          </div>
        : <p className="text-sm text-muted-foreground">{hasExisting ? `Artwork version ${currentVersion} exists but is not approved, so it is not previewed.` : "No artwork assigned yet."}</p>)}

      {open && saved && !dirty && (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Approved Signatures artwork only. The server copies the pinned approved files: no AI cost, the original stays unchanged, and this expedition's availability does not change. Approving an image does not approve any route.</p>
          <input className={field} placeholder="Search by challenge or mountain" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-artwork-search" />
          {lib.isLoading && <div className="grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}
          {lib.error && <div role="alert" className="text-sm text-destructive">{(lib.error as Error).message} <button type="button" className="underline" onClick={() => lib.refetch()}>Retry</button></div>}
          {lib.data && shown.length === 0 && <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No approved artwork matches.</div>}
          {shown.length > 0 && (
            <ul className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((x) => (
                <li key={`${x.challengeId}-${x.imageVersion}`}>
                  <button type="button" data-testid={`button-artwork-${x.challengeId}`} onClick={() => { setPick(x); setConfirm(false); setErr(null); }}
                    className={`flex w-full gap-2 rounded border p-2 text-left text-sm ${pick?.challengeId === x.challengeId ? "border-primary bg-secondary" : "border-border hover:bg-secondary"}`}>
                    <Img src={x.thumbnailUrl} alt={x.challengeName} className="h-12 w-12 shrink-0 rounded" />
                    <span className="min-w-0"><span className="block truncate font-medium">{x.challengeName}</span><span className="block truncate text-xs text-muted-foreground">{x.targetMountainName} · v{x.imageVersion}</span></span>
                  </button>
                </li>))}
            </ul>)}
          {pick && (
            <div className="space-y-3 rounded-md border border-border p-3" data-testid="artwork-selected">
              <div className="flex flex-wrap gap-3">
                <Img src={pick.heroUrl} alt="Selected hero" className="h-28 w-48 rounded" />
                <Img src={pick.cardUrl} alt="Selected card" className="h-28 w-20 rounded" />
                <Img src={pick.thumbnailUrl} alt="Selected thumbnail" className="h-16 w-16 rounded" />
              </div>
              <div className="text-xs text-muted-foreground">Source {pick.challengeId}, approved version {pick.imageVersion}</div>
              {hasExisting && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} data-testid="checkbox-replace-artwork" /><span>Replace the existing artwork (version {currentVersion}) on this expedition.</span></label>}
              {!confirm
                ? <Button type="button" disabled={!canAssign} onClick={() => setConfirm(true)} data-testid="button-assign-artwork">Assign to this expedition</Button>
                : <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Copy this artwork to {source!.challengeId}?</span>
                    <Button type="button" disabled={!canAssign} onClick={doAssign} data-testid="button-confirm-assign">{assign.isPending ? "Assigning..." : "Confirm assign"}</Button>
                    <Button type="button" variant="ghost" disabled={assign.isPending} onClick={() => setConfirm(false)}>Cancel</Button></div>}
            </div>)}
        </div>)}
      {err && <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}
    </div>
  );
}
