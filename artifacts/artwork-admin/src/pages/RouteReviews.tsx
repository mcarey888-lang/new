import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import { RouteReviewMap } from "@/components/RouteReviewMap";
import { ExpeditionRouteQueue } from "@/components/ExpeditionRouteQueue";
import { RouteEditor } from "@/components/RouteEditor";
import { RouteReviewSummary } from "@/components/RouteReviewSummary";
import {
  useRouteReviews, useRouteReview, usePreviewRouteReview, useImportRouteReview,
  useValidateRouteReview, useDecideRouteReview, useSaveMapReview, type RouteMapReview, downloadRouteReviewFile,
  type RouteCandidateInput, type RouteReviewPreview, type RouteRevision, type RouteValidation, type RouteDecision,
} from "../hooks/use-route-reviews";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</span>{children}</label>;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const isAuth = (m: string) => /401|403|unauthori|forbidden|admin key|auth/i.test(m);

function AdminKeyBar() {
  const qc = useQueryClient();
  const [key, setKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [saved, setSaved] = useState(false);
  const apply = () => {
    if (key.trim()) sessionStorage.setItem("summitready-admin-key", key.trim()); else sessionStorage.removeItem("summitready-admin-key");
    setSaved(true); setTimeout(() => setSaved(false), 1500);
    void qc.cancelQueries({ queryKey: ["route-reviews"] }).then(() =>
      qc.resetQueries({ queryKey: ["route-reviews"] }));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3 text-sm">
      <span className="text-muted-foreground">Admin key (this browser session only)</span>
      <input data-testid="input-admin-key" type="password" autoComplete="off" className={`${field} max-w-xs`} value={key} onChange={(e) => setKey(e.target.value)} />
      <Button type="button" size="sm" variant="secondary" onClick={apply}>{saved ? "Saved" : "Use key"}</Button>
    </div>
  );
}

function ErrBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const m = msg(error);
  return (
    <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-error">
      {m}
      {isAuth(m) && <div className="mt-1 text-foreground">Authorisation failed. Enter the admin key above and retry.</div>}
      {onRetry && <div><Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>Retry</Button></div>}
    </div>
  );
}

function RoutePreviewSvg({ coords }: { coords: number[][] }) {
  const d = useMemo(() => {
    if (coords.length < 2) return null;
    const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.max(x1 - x0, y1 - y0) || 1;
    return coords.map((c, i) => `${i ? "L" : "M"}${(4 + ((c[0] - x0) / s) * 192).toFixed(1)} ${(196 - ((c[1] - y0) / s) * 192).toFixed(1)}`).join("");
  }, [coords]);
  if (!d) return null;
  return <svg viewBox="0 0 200 200" className="h-40 w-40 rounded border border-border bg-background" role="img" aria-label="Schematic route outline, not to scale"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" /></svg>;
}

const EXAMPLE = {
  candidateKey: "illustrative-line-001", revisionVersion: "1",
  geometryFile: JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [0.001, 0.0005], [0.002, 0.0012]] } }),
  sourceManifest: [{ name: "Illustrative example only", note: "Not a real route; replace with real provenance metadata." }],
};

function HashRow({ k, v }: { k: string; v: string | null }) {
  return <div className="flex flex-wrap gap-2 text-xs"><span className="w-40 text-muted-foreground">{k}</span><code className="break-all">{v ?? "none"}</code></div>;
}

function ImportPanel() {
  const [f, setF] = useState({ candidateKey: "", revisionVersion: "", geometryFile: "", sourceManifest: "[]", canonicalGeometryId: "", profileFile: "", terrainManifestFile: "" });
  const [preview, setPreview] = useState<RouteReviewPreview | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const pv = usePreviewRouteReview();
  const imp = useImportRouteReview();
  const rev = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<typeof f>) => { rev.current++; setPreview(null); setErr(null); setLocalErr(null); setF((x) => ({ ...x, ...p })); };

  const build = (): RouteCandidateInput | null => {
    let sm: unknown;
    try { sm = JSON.parse(f.sourceManifest); } catch { setLocalErr("Source manifest is not valid JSON."); return null; }
    if (!Array.isArray(sm) || sm.some((x) => !x || typeof x !== "object" || Array.isArray(x))) { setLocalErr("Source manifest must be an array of objects."); return null; }
    if (!f.candidateKey.trim() || !f.revisionVersion.trim() || !f.geometryFile.trim()) { setLocalErr("Candidate key, revision version and geometry are required."); return null; }
    if (f.canonicalGeometryId.trim() && !UUID.test(f.canonicalGeometryId.trim())) { setLocalErr("Canonical geometry ID must be a UUID."); return null; }
    if (!!f.profileFile.trim() !== !!f.terrainManifestFile.trim()) { setLocalErr("Profile and terrain manifest must be supplied together."); return null; }
    const o: RouteCandidateInput = { candidateKey: f.candidateKey.trim(), revisionVersion: f.revisionVersion.trim(), geometryFile: f.geometryFile, sourceManifest: sm as Record<string, unknown>[] };
    if (f.canonicalGeometryId.trim()) o.canonicalGeometryId = f.canonicalGeometryId.trim();
    if (f.profileFile.trim()) { o.profileFile = f.profileFile; o.terrainManifestFile = f.terrainManifestFile; }
    return o;
  };
  const snap = useRef<RouteCandidateInput | null>(null);
  const runPreview = () => {
    const input = build(); if (!input) return;
    snap.current = input; const mine = ++rev.current; setPreview(null); setErr(null);
    pv.mutate(input, { onSuccess: (r) => { if (rev.current === mine) setPreview(r); }, onError: (e) => { if (rev.current === mine) setErr(e); } });
  };
  const save = () => {
    if (!snap.current || !preview?.valid) return;
    imp.mutate(snap.current, {
      onSuccess: () => { toast.success("Candidate saved to quarantine"); setPreview(null); },
      onError: setErr,
    });
  };
  const onFile = async (file: File | undefined, key: "geometryFile" | "profileFile" | "terrainManifestFile" | "all") => {
    if (!file) return;
    if (file.size > 5_000_000) { setLocalErr("File is too large."); return; }
    const text = await file.text();
    if (key !== "all") { set({ [key]: text }); return; }
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));
      set({ candidateKey: str(j.candidateKey), revisionVersion: str(j.revisionVersion), geometryFile: str(j.geometryFile), sourceManifest: JSON.stringify(j.sourceManifest ?? [], null, 2), canonicalGeometryId: str(j.canonicalGeometryId), profileFile: str(j.profileFile), terrainManifestFile: str(j.terrainManifestFile) });
    } catch { setLocalErr("File is not valid JSON."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(EXAMPLE, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "route-candidate-illustrative.json"; a.click(); URL.revokeObjectURL(url);
  };
  const busy = pv.isPending || imp.isPending;
  return (
    <div className="space-y-4" data-testid="route-import">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={download} data-testid="button-download-example">Download illustrative example</Button>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} data-testid="button-choose-candidate">Load candidate JSON file</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0], "all"); e.target.value = ""; }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Lbl t="Candidate key"><input data-testid="input-candidate-key" className={field} value={f.candidateKey} onChange={(e) => set({ candidateKey: e.target.value })} /></Lbl>
        <Lbl t="Revision version"><input data-testid="input-revision" className={field} value={f.revisionVersion} onChange={(e) => set({ revisionVersion: e.target.value })} /></Lbl>
        <Lbl t="Canonical geometry ID (optional UUID)"><input data-testid="input-canonical-id" className={field} value={f.canonicalGeometryId} onChange={(e) => set({ canonicalGeometryId: e.target.value })} /></Lbl>
      </div>
      <Lbl t="Geometry (raw GeoJSON text)"><Textarea data-testid="input-geometry" rows={6} className="font-mono text-xs" value={f.geometryFile} onChange={(e) => set({ geometryFile: e.target.value })} /></Lbl>
      <Lbl t="Source manifest (JSON array of provenance metadata)"><Textarea data-testid="input-manifest" rows={5} className="font-mono text-xs" value={f.sourceManifest} onChange={(e) => set({ sourceManifest: e.target.value })} /></Lbl>
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl t="Profile file (optional raw JSON)"><Textarea data-testid="input-profile" rows={4} className="font-mono text-xs" value={f.profileFile} onChange={(e) => set({ profileFile: e.target.value })} /></Lbl>
        <Lbl t="Terrain manifest file (optional raw JSON)"><Textarea data-testid="input-terrain" rows={4} className="font-mono text-xs" value={f.terrainManifestFile} onChange={(e) => set({ terrainManifestFile: e.target.value })} /></Lbl>
      </div>
      <div className="text-xs text-muted-foreground">Terrain licence note (read-only): the six saved Watkin pilot tiles match their original bytes and identify EU-DEM as their contributing source. See the <a className="underline" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">official attribution document</a> and <a className="underline" href="https://sdi.eea.europa.eu/catalogue/srv/api/records/19cff95e-61ac-45ed-8ee3-c43220d709cf" target="_blank" rel="noreferrer">EU-DEM reuse conditions</a>. Attribution, modification notices and explicit review are still required. This evidence does not clear other routes or approve this candidate.</div>
      {localErr && <div role="alert" className="text-sm text-destructive" data-testid="text-local-error">{localErr}</div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={runPreview} data-testid="button-preview">{pv.isPending ? "Checking..." : "Preview"}</Button>
        <Button type="button" disabled={!preview?.valid || busy} onClick={save} data-testid="button-save-candidate">{imp.isPending ? "Saving..." : "Save to quarantine"}</Button>
      </div>
      {!!err && <ErrBox error={err} />}
      {preview && (
        <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm" data-testid="preview-result">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={preview.valid ? "secondary" : "destructive"}>{preview.valid ? "Structurally valid" : "Not valid"}</Badge>
            <span>{preview.pointCount} points</span>
            <Badge variant="outline">{preview.bindingCurrent ? "Canonical binding current" : "Unbound"}</Badge>
            <Badge variant="outline">{preview.profileIncluded ? "Profile included" : "No profile"}</Badge>
            {preview.profileIncluded && <Badge variant="outline">{preview.elevationCoverageComplete ? "Elevation coverage complete" : "Elevation coverage incomplete"}</Badge>}
          </div>
          {preview.errors.length > 0 && <ul className="list-disc pl-5 text-destructive">{preview.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {preview.warnings.length > 0 && <ul className="list-disc pl-5 text-amber-500">{preview.warnings.map((x, i) => <li key={i}>Warning: {x}</li>)}</ul>}
          {preview.blockers.length > 0 && <ul className="list-disc pl-5">{preview.blockers.map((x, i) => <li key={i}>Blocking: {x}</li>)}</ul>}
          <div className="space-y-1">{preview.files.map((x) => <div key={x.name} className="text-xs"><strong>{x.name}</strong> ({x.bytes} bytes) <code className="break-all">{x.sha256}</code></div>)}</div>
          <div className="text-xs text-muted-foreground">Preview is not saved. Editing any field discards it.</div>
        </div>
      )}
    </div>
  );
}

function ValidationForm({ r }: { r: RouteRevision }) {
  const hasProfile = !!r.profileSha256;
  const [outcome, setOutcome] = useState<"needs_review" | "rejected" | "accepted">("needs_review");
  const [a, setA] = useState({ sourceRightsReviewed: false, routeAccessReviewed: false, terrainRightsReviewed: false, profileReviewed: false });
  const [authority, setAuthority] = useState(""); const [reason, setReason] = useState(""); const [until, setUntil] = useState("");
  const m = useValidateRouteReview();
  const [err, setErr] = useState<unknown>(null);
  const acc = outcome === "accepted";
  const attOk = a.sourceRightsReviewed && a.routeAccessReviewed && (!hasProfile || (a.terrainRightsReviewed && a.profileReviewed));
  const untilOk = !!until && new Date(until).getTime() > Date.now();
  const can = authority.trim() && reason.trim() && (!acc || (r.bindingCurrent && attOk && untilOk));
  const submit = () => {
    setErr(null);
    m.mutate({ id: r.id, outcome, ...a, authority: authority.trim(), reason: reason.trim(), ...(acc ? { validUntil: new Date(until).toISOString() } : {}) },
      { onSuccess: () => { toast.success("Validation recorded"); setReason(""); setA({ sourceRightsReviewed: false, routeAccessReviewed: false, terrainRightsReviewed: false, profileReviewed: false }); }, onError: setErr });
  };
  const chk = (k: keyof typeof a, label: string) => (
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" data-testid={`check-${k}`} checked={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.checked })} /><span>{label}</span></label>
  );
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="validation-form">
      <h4 className="font-semibold">Record validation</h4>
      <Lbl t="Outcome"><select data-testid="select-outcome" className={field} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
        <option value="needs_review">Needs review</option><option value="rejected">Rejected</option><option value="accepted">Accepted</option></select></Lbl>
      {acc && !r.bindingCurrent && <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="text-unbound">Acceptance is disabled: {r.canonicalGeometryId ? "a draft geometry is linked, but catalogue verification and reusable-rights binding have not passed." : "no canonical geometry is linked to this revision."} Needs review and rejected remain available.</div>}
      {acc && <div className="space-y-2">
        {chk("sourceRightsReviewed", "I have personally reviewed the source rights for this route.")}
        {chk("routeAccessReviewed", "I have personally reviewed route access and legal restrictions.")}
        {hasProfile && chk("terrainRightsReviewed", "I have personally reviewed the terrain data rights.")}
        {hasProfile && chk("profileReviewed", "I have personally reviewed the elevation profile.")}
        <Lbl t="Valid until"><input data-testid="input-valid-until" type="datetime-local" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></Lbl>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl t="Review authority"><input data-testid="input-authority" className={field} value={authority} onChange={(e) => setAuthority(e.target.value)} /></Lbl>
        <Lbl t="Reason"><input data-testid="input-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></Lbl>
      </div>
      {!!err && <ErrBox error={err} />}
      <Button type="button" disabled={!can || m.isPending} onClick={submit} data-testid="button-validate">{m.isPending ? "Saving..." : "Record validation"}</Button>
    </div>
  );
}

function DecisionForm({ r, validations, decisions }: { r: RouteRevision; validations: RouteValidation[]; decisions: RouteDecision[] }) {
  const [decision, setDecision] = useState<"approved" | "revoked">("approved");
  const currentDecision = decisions.find(d => d.id === r.latestDecisionId);
  const accepted = validations.filter((v) => v.outcome === "accepted" &&
    (decision === "revoked" ? v.id === currentDecision?.validationId : !!v.validUntil && new Date(v.validUntil) > new Date()));
  const [vid, setVid] = useState(""); const [authority, setAuthority] = useState(""); const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null); // expectedDecisionId snapshot
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const m = useDecideRouteReview();
  const validationId = decision === "revoked" ? currentDecision?.validationId ?? "" :
    accepted.some(v => v.id === vid) ? vid : accepted[0]?.id || "";
  const unbound = decision === "approved" && !r.bindingCurrent;
  const can = !!validationId && authority.trim() && reason.trim() && !unbound &&
    (decision !== "revoked" || r.latestDecision === "approved");
  const open = () => { setStale(false); setErr(null); setConfirm(r.latestDecisionId ?? "__none__"); };
  const stalePending = confirm !== null && (r.latestDecisionId ?? "__none__") !== confirm;
  const go = () => {
    if (confirm === null) return;
    if (stalePending) { setStale(true); return; }
    m.mutate({ id: r.id, decision, validationId, expectedDecisionId: r.latestDecisionId, authority: authority.trim(), reason: reason.trim() },
      { onSuccess: () => { toast.success(`Decision recorded: ${decision}`); setConfirm(null); setReason(""); }, onError: (e) => { setErr(e); setConfirm(null); } });
  };
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="decision-form">
      <h4 className="font-semibold">Record decision</h4>
      <div className="text-xs text-muted-foreground">Current decision: {r.latestDecision ?? "none"}. Decisions are append-only; revocation is retained, nothing is deleted. This never publishes a route.</div>
      {accepted.length === 0 && <div className="text-sm text-muted-foreground" data-testid="text-no-accepted">{decision === "revoked" ? "A current approval is required to revoke. Expired approvals may still be revoked." : "An unexpired accepted validation is required before approval."}</div>}
      {unbound && <div role="alert" className="text-sm text-amber-500" data-testid="text-unbound-approve">Approval is disabled: {r.canonicalGeometryId ? "the draft link still needs verified catalogue and source-rights evidence." : "no canonical geometry is linked to this revision."}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl t="Decision"><select data-testid="select-decision" className={field} value={decision} onChange={(e) => { setDecision(e.target.value as typeof decision); setConfirm(null); }}><option value="approved">Approved</option><option value="revoked">Revoked</option></select></Lbl>
        <Lbl t="Accepted validation"><select data-testid="select-validation" disabled={decision === "revoked"} className={field} value={validationId} onChange={(e) => setVid(e.target.value)}>{accepted.map((v) => <option key={v.id} value={v.id}>{v.id.slice(0, 8)} by {v.reviewAuthority}</option>)}</select></Lbl>
        <Lbl t="Review authority"><input data-testid="input-decision-authority" className={field} value={authority} onChange={(e) => setAuthority(e.target.value)} /></Lbl>
        <Lbl t="Reason"><input data-testid="input-decision-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></Lbl>
      </div>
      {!!err && <ErrBox error={err} />}
      {(stale || stalePending) && <div role="alert" className="text-sm text-destructive" data-testid="text-stale">The latest decision changed since you opened this. Review the history and start again.</div>}
      {confirm === null ? <Button type="button" disabled={!can} onClick={open} data-testid="button-decide">Review decision</Button> : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span>Confirm: record {decision} for this revision as {authority.trim()}?</span>
          <Button type="button" disabled={m.isPending || stalePending} onClick={go} data-testid="button-confirm-decision">{m.isPending ? "Saving..." : "Confirm"}</Button>
          <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

const MAP_CHOICES: { v: RouteMapReview["outcome"]; l: string }[] = [
  { v: "looks_correct", l: "Route looks correct" }, { v: "needs_changes", l: "Needs changes" }, { v: "rejected", l: "Reject" },
];
const outcomeLabel = (o: string) => MAP_CHOICES.find((c) => c.v === o)?.l ?? o;

function MapReviewPanel({ revisionId, reviews }: { revisionId: string; reviews: RouteMapReview[] }) {
  const qc = useQueryClient();
  const m = useSaveMapReview();
  const [outcome, setOutcome] = useState<RouteMapReview["outcome"] | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [stale, setStale] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const latest = reviews[0] ?? null;
  const save = () => {
    if (!outcome || lock.current) return;
    lock.current = true; setErr(null); setStale(false);
    m.mutate({ id: revisionId, outcome, note: note.trim() || undefined, expectedReviewId: latest?.id ?? null }, {
      onSuccess: () => { if (!alive.current) return; toast.success("Map review saved"); setOutcome(null); setNote(""); },
      onError: (e) => {
        if (/409|stale/i.test(msg(e))) { void qc.invalidateQueries({ queryKey: ["route-reviews"] }); if (alive.current) setStale(true); }
        else if (alive.current) setErr(e);
      },
      onSettled: () => { lock.current = false; },
    });
  };
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="map-review">
      <h4 className="font-semibold">Map review</h4>
      <p className="text-xs text-muted-foreground">Map and intended itinerary review only. This does not publish the route or certify safety, access, elevation or reuse rights.</p>
      <div className="text-sm" data-testid="text-map-review-status">
        {latest ? <>Saved: <strong>{outcomeLabel(latest.outcome)}</strong> on {new Date(latest.createdAt).toLocaleString()}{latest.note && <div className="text-xs text-muted-foreground">{latest.note}</div>}</> : <span className="text-muted-foreground">Not reviewed yet.</span>}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Map review outcome">
        {MAP_CHOICES.map((c) => (
          <Button key={c.v} type="button" role="radio" aria-checked={outcome === c.v} variant={outcome === c.v ? "default" : "secondary"} disabled={m.isPending} onClick={() => setOutcome(c.v)} data-testid={`button-map-${c.v}`}>{c.l}</Button>
        ))}
      </div>
      <Lbl t="Note (optional)"><Textarea data-testid="input-map-note" rows={3} maxLength={2000} value={note} disabled={m.isPending} onChange={(e) => setNote(e.target.value)} /></Lbl>
      {stale && <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="text-map-stale">This review changed since you opened it. The latest has been reloaded; check it and save again if still needed.</div>}
      {!!err && <ErrBox error={err} />}
      <Button type="button" disabled={!outcome || m.isPending} onClick={save} data-testid="button-save-map-review">{m.isPending ? "Saving..." : "Save map review"}</Button>
      {reviews.length > 1 && (
        <details data-testid="map-review-history"><summary className="cursor-pointer text-sm font-medium">Earlier map reviews ({reviews.length - 1})</summary>
          <ul className="mt-2 space-y-2">{reviews.slice(1).map((x) => <li key={x.id} className="rounded border border-border p-2 text-xs"><strong>{outcomeLabel(x.outcome)}</strong>, {new Date(x.createdAt).toLocaleString()}{x.note && <div>{x.note}</div>}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

function Detail({ id, latestId, onSaved, onDirtyChange }: { id: string; latestId: string; onSaved: (id: string) => void; onDirtyChange: (dirty: boolean) => void }) {
  const q = useRouteReview(id);
  const [editing, setEditing] = useState(false);
  const [dlErr, setDlErr] = useState<unknown>(null);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.error && !q.data) return <ErrBox error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const { revision: r, validations, decisions } = q.data;
  if (r.sourceStatus === "withdrawn_constructed") return (
    <div role="alert" className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4" data-testid="text-withdrawn-source">
      <h3 className="font-semibold">Constructed route withdrawn</h3>
      <p>This track was generated through approximate waypoints, not downloaded as a published named itinerary. It cannot be edited or approved as a replacement source.</p>
      <p>The record and earlier feedback remain in history for audit. A matching published track with permission to reuse it is still required.</p>
    </div>
  );
  const files = Object.entries(r.reviewFileHashes?.files ?? {});
  return (
    <div className="space-y-4" data-testid="route-detail">
      {q.error && <ErrBox error={q.error} onRetry={() => q.refetch()} />}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{r.candidateKey} <span className="font-normal text-muted-foreground">v{r.revisionVersion}</span></h3>
      </div>
      {r.geometry && (editing
        ? <RouteEditor key={`editor-${r.id}`} revisionId={r.id} latestRevisionId={latestId} coordinates={r.geometry.coordinates} onSaved={onSaved} onCancel={() => setEditing(false)} onDirtyChange={onDirtyChange} />
        : <div className="space-y-2">
            {latestId !== r.id && <div className="text-sm text-amber-600" data-testid="text-older-revision">This is an older revision. Editing is only available on the latest revision of this candidate.</div>}
            <Button type="button" size="sm" variant="secondary" disabled={latestId !== r.id} onClick={() => setEditing(true)} data-testid="button-edit-draft">Edit draft route</Button>
          </div>)}
      {r.geometry && !editing && <RouteReviewMap identity={`${r.id}:${r.geometrySha256}`} coordinates={r.geometry.coordinates} sourceManifest={r.sourceManifest} fallback={<RoutePreviewSvg coords={r.geometry.coordinates} />} />}
      <MapReviewPanel key={r.id} revisionId={r.id} reviews={q.data.mapReviews ?? []} />
      <RouteReviewSummary revision={r} validations={validations} />
      <details className="rounded-md border border-border p-3" data-testid="details-advanced">
      <summary className="cursor-pointer text-sm font-medium">Advanced: evidence and publication checks</summary>
      <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{r.bindingCurrent ? "Binding checks passed" : r.canonicalGeometryId ? "Draft linked — needs checks" : "Unbound"}</Badge>
        <Badge variant={r.eligible ? "secondary" : "outline"}>{r.eligible ? "Eligible" : "Not eligible"}</Badge>
        <Badge variant="secondary">{r.latestDecision ?? "no decision"}</Badge>
      </div>
      <details className="rounded-md border border-border p-3" open={technicalOpen} onToggle={e => setTechnicalOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">Technical evidence and source metadata</summary>
      {technicalOpen && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <HashRow k="Canonical geometry" v={r.canonicalGeometryId} />
          <HashRow k={`Geometry (${r.geometryDigestAlgorithm})`} v={r.geometrySha256} />
          <HashRow k={`Source manifest (${r.manifestDigestAlgorithm})`} v={r.sourceManifestSha256} />
          <HashRow k="Profile" v={r.profileSha256} />
          <HashRow k="Terrain manifest" v={r.terrainManifestSha256} />
          <HashRow k="Created" v={new Date(r.createdAt).toLocaleString()} />
        </div>
      </div>
      <div className="space-y-1"><h4 className="font-semibold">Source metadata</h4>
        {r.sourceManifest.length === 0 && <div className="text-sm text-muted-foreground">No source entries.</div>}
        {r.sourceManifest.map((s, i) => <pre key={i} className="overflow-auto rounded border border-border bg-card p-2 text-xs">{JSON.stringify(s, null, 2)}</pre>)}
      </div>
      </div>}
      </details>
      <div className="space-y-1"><h4 className="font-semibold">Review files (protected download)</h4>
        <div className="flex flex-wrap gap-2">{files.map(([n, h]) => <Button key={n} type="button" size="sm" variant="secondary" data-testid={`button-download-${n}`} onClick={() => downloadRouteReviewFile(r.id, n).catch(setDlErr)}>{n} ({h.bytes} B)</Button>)}
          {files.length === 0 && <span className="text-sm text-muted-foreground">No files recorded.</span>}</div>
        {!!dlErr && <ErrBox error={dlErr} />}
      </div>
      <ValidationForm key={`validation-${r.id}`} r={r} />
      <DecisionForm key={`decision-${r.id}`} r={r} validations={validations} decisions={decisions} />
      <div className="space-y-2"><h4 className="font-semibold">Validations</h4>
        {validations.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
        {validations.map((v) => <div key={v.id} className="rounded-md border border-border bg-card p-3 text-xs" data-testid={`row-validation-${v.id}`}>
          <div><Badge variant="secondary">{v.outcome}</Badge> {v.reviewAuthority} at {new Date(v.createdAt).toLocaleString()}{v.validUntil ? `, valid until ${new Date(v.validUntil).toLocaleString()}` : ""}</div>
          <div>Reviewed: source rights {String(v.sourceRightsReviewed)}, access {String(v.routeAccessReviewed)}, terrain rights {String(v.terrainRightsReviewed)}, profile {String(v.profileReviewed)}</div>
          <div>Evaluator {v.evaluatorVersion} <code className="break-all">{v.evaluatorSha256}</code></div>
          {v.diagnostics.map((d, i) => <div key={i}>{d}</div>)}
        </div>)}
      </div>
      <div className="space-y-2"><h4 className="font-semibold">Decision history</h4>
        {decisions.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
        {decisions.map((d) => <div key={d.id} className="rounded-md border border-border bg-card p-3 text-xs" data-testid={`row-decision-${d.id}`}><Badge variant="secondary">{d.decision}</Badge> {d.reviewAuthority}, {new Date(d.createdAt).toLocaleString()}: {d.reason}</div>)}
      </div>
      </div>
      </details>
    </div>
  );
}

export default function RouteReviews() {
  const dirtyEditor = useRef(false);
  const [history, setHistory] = useState(false);
  const list = useRouteReviews(history);
  const [sel, setSel] = useState<string | null>(() => {
    const requested = new URLSearchParams(window.location.search).get("candidate");
    return requested && UUID.test(requested) ? requested : null;
  });
  const choose = (id: string | null) => {
    if (dirtyEditor.current && !window.confirm("Discard unsaved route edits and open another route?")) return;
    dirtyEditor.current = false;
    setSel(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("candidate", id); else url.searchParams.delete("candidate");
    window.history.replaceState(null, "", url);
  };
  const all = list.data?.items ?? [];
  const family = (r: RouteRevision) => String(r.sourceManifest.find(s => s.expeditionRouteKey)?.expeditionRouteKey
    ?? (r.candidateKey === "Snowdon via Watkin Path — pilot" ? "watkin" : r.candidateKey));
  const latestByKey = useMemo(() => { const m = new Map<string, string>(); all.forEach((r) => { const key = family(r); if (!m.has(key)) m.set(key, r.id); }); return m; }, [all]);
  const items = history ? all : all.filter((r) => latestByKey.get(family(r)) === r.id);
  const selItem = all.find((r) => r.id === sel);
  const selOlder = !!selItem && latestByKey.get(family(selItem)) !== sel;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <ArtworkAdminHeader activeSection="route-reviews" actions={<Button size="sm" variant="secondary" onClick={() => choose(null)} data-testid="button-new-candidate">Import candidate</Button>} />
      <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2 lg:col-span-2">
          <AdminKeyBar />
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="text-dev-banner">
            Published source tracks only. Constructed waypoint/network itineraries have been withdrawn and are available only in history. Remaining source tracks may be partial: none is automatically a complete expedition route. Nothing here publishes routes or changes user progress.
          </div>
        </div>
        <div className="lg:col-span-2"><ExpeditionRouteQueue onSelectReview={choose} /></div>
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Candidates</h2>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" data-testid="check-history" checked={history} onChange={(e) => setHistory(e.target.checked)} />Show older and withdrawn revisions (history)</label>
          {selOlder && !history && <div className="rounded border border-border p-2 text-xs" data-testid="text-selected-older">Viewing an older revision, not shown in the latest-only list.</div>}
          {list.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          {list.error && <ErrBox error={list.error} onRetry={() => list.refetch()} />}
          {list.data && items.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="text-empty">No saved candidates. Import one by pasting or loading JSON.</div>}
          <ul className="space-y-2">{items.map((r) => (
            <li key={r.id}><button type="button" data-testid={`row-route-${r.id}`} onClick={() => choose(r.id)} className={`w-full rounded-md border p-3 text-left transition-colors ${sel === r.id ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{r.candidateKey}</span><Badge variant="secondary">{r.latestMapReview ? outcomeLabel(r.latestMapReview) : "Map not reviewed"}</Badge></div>
              <div className="text-xs text-muted-foreground">v{r.revisionVersion} · {r.bindingCurrent ? "binding checks passed" : r.canonicalGeometryId ? "draft linked" : "unbound"} · {new Date(r.createdAt).toLocaleDateString()}</div>
            </button></li>))}</ul>
        </aside>
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-semibold">{sel ? "Candidate review" : "Import candidate"}</h2>
          {sel ? <Detail key={sel} id={sel} latestId={selItem ? latestByKey.get(family(selItem)) ?? sel : sel} onDirtyChange={dirty => { dirtyEditor.current = dirty; }} onSaved={(nid) => { toast.success("Draft revision saved"); choose(nid); }} /> : <ImportPanel />}
        </section>
      </main>
    </div>
  );
}
