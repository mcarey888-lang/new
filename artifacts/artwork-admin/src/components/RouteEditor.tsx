import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditRouteReview } from "../hooks/use-route-reviews";

const SRC = "/api/route-map?chrome=full&adminReview=1";
const MAX_POINTS = 20000;
type LL = { lat: number; lng: number };
const finite = (p: unknown): p is LL => !!p && typeof p === "object" && Number.isFinite((p as LL).lat) && Number.isFinite((p as LL).lng);

export function RouteEditor({ revisionId, latestRevisionId, coordinates, onSaved, onCancel, onDirtyChange }: {
  revisionId: string; latestRevisionId: string; coordinates: number[][];
  onSaved: (id: string) => void; onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [frameAttempt, setFrameAttempt] = useState(0);
  const [frameError, setFrameError] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setFrameError(true), 20000);
    return () => window.clearTimeout(timer);
  }, [ready, frameAttempt]);
  const [reversed, setReversed] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [current, setCurrent] = useState<LL[] | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [straightLegs, setStraightLegs] = useState(0);
  const m = useEditRouteReview();
  const busy = useRef(false);
  const alive = useRef(true);
  const onSavedRef = useRef(onSaved); onSavedRef.current = onSaved;
  // Polling refreshes object identities; never reload an unsaved editor for it.
  const original = useRef(coordinates);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const base = useMemo(() => {
    const clean = original.current.map((c) => [c[0], c[1]]);
    const a = Math.max(0, Math.min(trimStart, clean.length));
    const b = Math.max(0, Math.min(trimEnd, clean.length - a));
    const cut = clean.slice(a, clean.length - b);
    return reversed ? cut.slice().reverse() : cut;
  }, [reversed, trimStart, trimEnd]);
  const tooBig = base.length > MAX_POINTS;
  const baseRef = useRef(base); baseRef.current = base;

  const send = useCallback((o: unknown) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(o), window.location.origin);
  }, []);

  const load = useCallback(() => {
    const pts = baseRef.current.map((c) => ({ lat: c[1], lng: c[0] }));
    if (pts.length < 2 || pts.length > MAX_POINTS) return;
    setCurrent(null);
    // Explicit indices preserve every point, including repeated out-and-back
    // coordinates, without creating thousands of draggable markers.
    const step = Math.max(1, Math.ceil((pts.length - 1) / 149));
    const anchorIndices = Array.from({ length: Math.floor((pts.length - 1) / step) + 1 }, (_, i) => i * step);
    if (anchorIndices.at(-1) !== pts.length - 1) anchorIndices.push(pts.length - 1);
    send({ type: "loadReviewDraft", points: pts, anchorIndices });
  }, [send]);

  useEffect(() => {
    const h = (ev: MessageEvent) => {
      if (ev.source !== frame.current?.contentWindow || ev.origin !== window.location.origin) return;
      let d: { type?: string; points?: unknown; legs?: { kind?: string }[]; route?: { geometry?: unknown } };
      try { d = JSON.parse(String(ev.data)); } catch { return; }
      if (d.type === "ready") { setReady(true); setFrameError(false); }
      else if (d.type === "routeChanged" && Array.isArray(d.points)) {
        setCurrent(d.points.filter(finite).length === d.points.length ? (d.points as LL[]) : null);
        const ls = Array.isArray(d.legs) ? d.legs : [];
        setPending(ls.some((l) => l.kind === "pending" || l.kind === "loading"));
        setStraightLegs(ls.filter((l) => l.kind === "straight").length);
      } else if (d.type === "saveRequested") saveRef.current();
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, base, load]);

  const dirty = useMemo(() => {
    if (!current) return false;
    if (current.length !== base.length) return true;
    return current.some((p, i) => p.lat !== base[i][1] || p.lng !== base[i][0]);
  }, [current, base]);
  const editedGeometry = trimStart > 0 || trimEnd > 0;
  const changed = dirty || (editedGeometry && base.length >= 2);
  const dirtyChange = useRef(onDirtyChange); dirtyChange.current = onDirtyChange;
  useEffect(() => {
    dirtyChange.current(changed);
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    if (changed) window.addEventListener("beforeunload", prevent);
    return () => { window.removeEventListener("beforeunload", prevent); dirtyChange.current(false); };
  }, [changed]);
  const canSave = ready && !!current && current.length >= 2 && !pending && changed && !m.isPending && !tooBig;

  const doSave = () => {
    if (!canSave || busy.current || !current) return;
    busy.current = true; setErr(null);
    const out = current.map((p) => [p.lng, p.lat]);
    const coords = reversed ? out.reverse() : out;
    m.mutate({ id: revisionId, coordinates: coords, note: note.trim() || undefined, expectedLatestRevisionId: latestRevisionId }, {
      onSuccess: (r) => { if (alive.current) { dirtyChange.current(false); onSavedRef.current(r.id); } },
      onError: (e) => { if (alive.current) setErr(e instanceof Error ? e.message : "Save failed"); },
      onSettled: () => { busy.current = false; },
    });
  };
  const saveRef = useRef(doSave); saveRef.current = doSave;

  const cancel = () => { if (changed && !confirmCancel) { setConfirmCancel(true); return; } onCancel(); };
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="route-editor">
      <h4 className="font-semibold">Edit draft route</h4>
      <div role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        Saving creates a new draft revision and keeps the original. Manual edits and straight legs are drafts, not approved. Map reviews, validations, decisions and profile are cleared on the new revision.
      </div>
      {tooBig && <div role="alert" className="text-sm text-destructive" data-testid="text-editor-toobig">This line has {base.length} points; editing is limited to {MAX_POINTS} points.</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm"><span className="text-xs uppercase text-muted-foreground">Trim first points</span>
          <input data-testid="input-trim-start" type="number" min={0} max={original.current.length - trimEnd - 2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled={dirty || m.isPending} value={trimStart} onChange={(e) => setTrimStart(Math.min(num(e.target.value), original.current.length - trimEnd - 2))} /></label>
        <label className="space-y-1 text-sm"><span className="text-xs uppercase text-muted-foreground">Trim last points</span>
          <input data-testid="input-trim-end" type="number" min={0} max={original.current.length - trimStart - 2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" disabled={dirty || m.isPending} value={trimEnd} onChange={(e) => setTrimEnd(Math.min(num(e.target.value), original.current.length - trimStart - 2))} /></label>
        <div className="flex items-end"><Button type="button" variant={reversed ? "default" : "secondary"} disabled={dirty || m.isPending} onClick={() => setReversed(!reversed)} aria-pressed={reversed} data-testid="button-reverse-line">{reversed ? "Extending start (reversed)" : "Extend start (reverse line)"}</Button></div>
      </div>
      <div className="text-xs text-muted-foreground">Use Draw route in the map to add points or drag existing points. Trim and reverse are locked while map edits are unsaved; undo them first. When reversed, the line is turned back to its original direction on save.</div>
      <iframe key={frameAttempt} ref={frame} src={SRC} title="Route editor" data-testid="iframe-route-editor" className="h-[28rem] w-full rounded-md border border-border" style={{pointerEvents:m.isPending?"none":undefined}} />
      {!ready && <div role={frameError ? "alert" : undefined} className="text-xs text-muted-foreground">{frameError ? "The map editor has not finished loading. Your saved route has not changed." : "Loading map editor..."}{frameError && <Button size="sm" variant="outline" className="ml-2" onClick={() => { setFrameError(false); setFrameAttempt(n=>n+1); }}>Retry map</Button>}</div>}
      {straightLegs > 0 && <div className="text-xs text-amber-600" data-testid="text-straight-legs">{straightLegs} straight leg{straightLegs === 1 ? "" : "s"}: not following mapped paths.</div>}
      <label className="block space-y-1"><span className="text-xs font-medium uppercase text-muted-foreground">Note (optional)</span>
        <Textarea data-testid="input-edit-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {err && <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-edit-error">{err}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={!canSave} onClick={doSave} data-testid="button-save-edit">{m.isPending ? "Saving..." : "Save as new draft"}</Button>
        {confirmCancel
          ? <><span className="text-sm">Discard unsaved edits?</span><Button type="button" variant="destructive" onClick={onCancel} data-testid="button-confirm-cancel-edit">Discard</Button><Button type="button" variant="ghost" onClick={() => setConfirmCancel(false)}>Keep editing</Button></>
          : <Button type="button" variant="ghost" onClick={cancel} data-testid="button-cancel-edit">Cancel</Button>}
      </div>
    </div>
  );
}
