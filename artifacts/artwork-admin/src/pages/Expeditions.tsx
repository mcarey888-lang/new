import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";
import {
  useExpeditionList, useExpedition, useCatalogueSearch, usePreviewExpeditions, useImportExpeditions,
  useUpdateExpedition, useDeleteExpedition,
  type ExpeditionSummary, type ExpeditionInput, type CatalogueMountain, type PreviewResult,
} from "../hooks/use-expeditions";

type StageForm = {
  routeName: string; region: string; distanceKm: string; ascentM: string; estimatedHours: string;
  difficulty: string; dnaContribution: string; whySelected: string; routeKey: string;
  mountainId: string; mountainName: string;
};
type Form = {
  challengeId: string; challengeName: string; targetMountainName: string; targetRoute: string; summary: string;
  regions: string; difficulty: string; recommendedDays: string; status: string; reviewed: boolean;
  limitations: string; stages: StageForm[];
};

const blankStage = (): StageForm => ({ routeName: "", region: "", distanceKm: "", ascentM: "", estimatedHours: "", difficulty: "", dnaContribution: "", whySelected: "", routeKey: "", mountainId: "", mountainName: "" });
const blankForm = (): Form => ({ challengeId: "", challengeName: "", targetMountainName: "", targetRoute: "", summary: "", regions: "", difficulty: "", recommendedDays: "", status: "draft", reviewed: false, limitations: "", stages: [blankStage()] });

function toForm(e: ExpeditionSummary): Form {
  const regions = Array.isArray(e.regions) ? e.regions.join(", ") : e.regions ?? "";
  return {
    challengeId: e.challengeId, challengeName: e.challengeName, targetMountainName: e.targetMountainName,
    targetRoute: e.targetRoute ?? "", summary: e.summary ?? "", regions, difficulty: e.difficulty ?? "",
    recommendedDays: e.recommendedDays != null ? String(e.recommendedDays) : "", status: e.status, reviewed: false,
    limitations: (e.limitations ?? []).join("\n"),
    stages: (e.stages ?? []).map((s) => ({
      routeName: s.routeName, region: s.region ?? "", distanceKm: String(s.distanceKm ?? ""), ascentM: String(s.ascentM ?? ""),
      estimatedHours: s.estimatedHours != null ? String(s.estimatedHours) : "", difficulty: s.difficulty ?? "",
      dnaContribution: s.dnaContribution ?? "", whySelected: s.whySelected ?? "", routeKey: s.routeKey ?? "",
      mountainId: s.mountainId ?? s.catalogueMountain?.id ?? "", mountainName: s.catalogueMountain?.name ?? "",
    })),
  };
}

function toInput(f: Form): ExpeditionInput {
  const out: Record<string, unknown> = {
    challengeId: f.challengeId.trim(), challengeName: f.challengeName.trim(), targetMountainName: f.targetMountainName.trim(),
    status: f.status, reviewed: f.reviewed,
    stages: f.stages.map((s) => {
      const st: Record<string, unknown> = { routeName: s.routeName.trim(), distanceKm: Number(s.distanceKm), ascentM: Number(s.ascentM) };
      if (s.region.trim()) st.region = s.region.trim();
      if (s.estimatedHours.trim()) st.estimatedHours = Number(s.estimatedHours);
      if (s.difficulty.trim()) st.difficulty = s.difficulty.trim();
      if (s.dnaContribution.trim()) st.dnaContribution = s.dnaContribution.trim();
      if (s.whySelected.trim()) st.whySelected = s.whySelected.trim();
      if (s.routeKey) st.routeKey = s.routeKey;
      if (s.mountainId) st.mountainId = s.mountainId;
      return st;
    }),
  };
  if (f.targetRoute.trim()) out.targetRoute = f.targetRoute.trim();
  if (f.summary.trim()) out.summary = f.summary.trim();
  const regions = f.regions.split(",").map((x) => x.trim()).filter(Boolean).join(", ");
  if (regions) out.regions = regions;
  if (f.difficulty.trim()) out.difficulty = f.difficulty.trim();
  if (f.recommendedDays.trim()) out.recommendedDays = Number(f.recommendedDays);
  const lim = f.limitations.split("\n").map((x) => x.trim()).filter(Boolean);
  if (lim.length) out.limitations = lim;
  return out;
}

function localErrors(f: Form): string[] {
  const e: string[] = [];
  if (!/^[A-Z0-9_-]{3,40}$/.test(f.challengeId.trim())) e.push("Challenge ID: 3-40 characters, uppercase letters, numbers, underscore or hyphen.");
  if (!f.challengeName.trim()) e.push("Challenge name is required.");
  if (!f.targetMountainName.trim()) e.push("Target mountain name is required.");
  if (f.stages.length === 0) e.push("At least one stage is required.");
  if (f.stages.length > 30) e.push("Maximum 30 stages.");
  f.stages.forEach((s, i) => {
    if (!s.routeName.trim()) e.push(`Stage ${i + 1}: route name required.`);
    if (!(Number(s.distanceKm) > 0)) e.push(`Stage ${i + 1}: full-route distance must be above 0 km.`);
    if (s.ascentM.trim() === "" || !(Number(s.ascentM) >= 0)) e.push(`Stage ${i + 1}: total ascent (m) required, 0 or more.`);
  });
  return e;
}

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</span>{children}</label>;
}

function MountainPicker({ stage, onPick }: { stage: StageForm; onPick: (m: CatalogueMountain | null) => void }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const { data, isFetching, error, refetch } = useCatalogueSearch(dq);
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Catalogue mountain: {stage.mountainId ? <strong>{stage.mountainName || stage.mountainId}</strong> : <em className="text-muted-foreground">not linked</em>}</span>
        {stage.mountainId && <Button type="button" size="sm" variant="ghost" onClick={() => onPick(null)}>Unlink</Button>}
      </div>
      <Input placeholder="Search catalogue by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {isFetching && <Skeleton className="h-8 w-full" />}
      {error && <div className="text-sm text-destructive">{(error as Error).message} <button className="underline" type="button" onClick={() => refetch()}>Retry</button></div>}
      {data && data.items.length === 0 && <div className="text-sm text-muted-foreground">No catalogue matches.</div>}
      {data && data.items.length > 0 && (
        <ul className="max-h-44 divide-y divide-border overflow-auto rounded border border-border">
          {data.items.map((m) => (
            <li key={m.id}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { onPick(m); setQ(""); }}>
                <span>{m.name} <span className="text-muted-foreground">{[m.region, m.country].filter(Boolean).join(", ")}</span></span>
                <span className="text-xs text-muted-foreground">summit {m.elevationM ?? "?"} m (not ascent)</span>
              </button>
            </li>
          ))}
          {data.hasMore && <li className="px-3 py-2 text-xs text-muted-foreground">More results exist. Refine the search.</li>}
        </ul>
      )}
    </div>
  );
}

function Editor({ source, isNew, onDirty, onDone }: { source: ExpeditionSummary | null; isNew: boolean; onDirty: (d: boolean) => void; onDone: (id: string | null) => void }) {
  const [form, setForm] = useState<Form>(() => (source ? toForm(source) : blankForm()));
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const update = useUpdateExpedition();
  const imp = useImportExpeditions();
  const del = useDeleteExpedition();
  const set = (patch: Partial<Form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); onDirty(true); setServerErr(null); };
  const setStage = (i: number, patch: Partial<StageForm>) => set({ stages: form.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= form.stages.length) return; const a = [...form.stages]; [a[i], a[j]] = [a[j], a[i]]; set({ stages: a }); };
  const errs = useMemo(() => localErrors(form), [form]);
  const wantsActive = form.status === "active";
  const blocked = errs.length > 0 || (wantsActive && !form.reviewed);
  const totals = form.stages.reduce((a, s) => ({ km: a.km + (Number(s.distanceKm) || 0), up: a.up + (Number(s.ascentM) || 0) }), { km: 0, up: 0 });
  const canDelete = !isNew && source?.status === "draft";

  const save = () => {
    setServerErr(null);
    const input = toInput(form);
    const ok = (id: string) => { toast.success(isNew ? "Draft created" : "Expedition saved"); setDirty(false); onDirty(false); onDone(id); };
    const fail = (e: unknown) => setServerErr(e instanceof Error ? e.message : "Save failed");
    if (isNew) { input.status = "draft"; imp.mutate([input], { onSuccess: (r) => ok(r.created[0] ?? form.challengeId.trim()), onError: fail }); }
    else update.mutate({ id: source!.challengeId, expedition: input, expectedUpdatedAt: source!.updatedAt }, { onSuccess: (r) => ok(r.expedition.challengeId), onError: fail });
  };
  const remove = () => del.mutate({ id: source!.challengeId, expectedUpdatedAt: source!.updatedAt }, {
    onSuccess: () => { toast.success("Draft deleted"); onDirty(false); onDone(null); },
    onError: (e) => { setConfirmDelete(false); setServerErr(e instanceof Error ? e.message : "Delete failed"); },
  });
  const busy = update.isPending || imp.isPending || del.isPending;

  return (
    <div className="space-y-5" data-testid="expedition-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl t="Challenge ID"><input className={field} disabled={!isNew} value={form.challengeId} onChange={(e) => set({ challengeId: e.target.value.toUpperCase() })} /></Lbl>
        <Lbl t="Challenge name"><input className={field} value={form.challengeName} onChange={(e) => set({ challengeName: e.target.value })} /></Lbl>
        <Lbl t="Target mountain name"><input className={field} value={form.targetMountainName} onChange={(e) => set({ targetMountainName: e.target.value })} /></Lbl>
        <Lbl t="Target route"><input className={field} value={form.targetRoute} onChange={(e) => set({ targetRoute: e.target.value })} /></Lbl>
        <Lbl t="Regions (comma separated)"><input className={field} value={form.regions} onChange={(e) => set({ regions: e.target.value })} /></Lbl>
        <Lbl t="Difficulty"><input className={field} value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} /></Lbl>
        <Lbl t="Recommended days"><input className={field} type="number" min="0" value={form.recommendedDays} onChange={(e) => set({ recommendedDays: e.target.value })} /></Lbl>
        <Lbl t="Status">
          <select className={field} value={form.status} disabled={isNew} onChange={(e) => set({ status: e.target.value, reviewed: false })}>
            <option value="draft">Draft</option><option value="active">Make available</option><option value="hidden">Hidden</option>
          </select>
        </Lbl>
      </div>
      <Lbl t="Summary"><Textarea value={form.summary} onChange={(e) => set({ summary: e.target.value })} /></Lbl>
      <Lbl t="Limitations (one per line)"><Textarea value={form.limitations} onChange={(e) => set({ limitations: e.target.value })} placeholder="Evidence gaps, unverified sections, seasonal caveats" /></Lbl>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Stages ({form.stages.length}/30)</h3>
          <Button type="button" size="sm" variant="secondary" disabled={form.stages.length >= 30} onClick={() => set({ stages: [...form.stages, blankStage()] })}>Add stage</Button>
        </div>
        {form.stages.map((s, i) => (
          <div key={i} className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Stage {i + 1}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>Move up</Button>
                <Button type="button" size="sm" variant="ghost" disabled={i === form.stages.length - 1} onClick={() => move(i, 1)}>Move down</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => set({ stages: form.stages.filter((_, j) => j !== i) })}>Remove</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Lbl t="Route name"><input className={field} value={s.routeName} onChange={(e) => setStage(i, { routeName: e.target.value })} /></Lbl>
              <Lbl t="Region"><input className={field} value={s.region} onChange={(e) => setStage(i, { region: e.target.value })} /></Lbl>
              <Lbl t="Difficulty"><input className={field} value={s.difficulty} onChange={(e) => setStage(i, { difficulty: e.target.value })} /></Lbl>
              <Lbl t="Full-route distance (km)"><input className={field} type="number" min="0" step="any" value={s.distanceKm} onChange={(e) => setStage(i, { distanceKm: e.target.value })} /></Lbl>
              <Lbl t="Total ascent (m), not summit altitude"><input className={field} type="number" min="0" step="any" value={s.ascentM} onChange={(e) => setStage(i, { ascentM: e.target.value })} /></Lbl>
              <Lbl t="Estimated hours"><input className={field} type="number" min="0" step="any" value={s.estimatedHours} onChange={(e) => setStage(i, { estimatedHours: e.target.value })} /></Lbl>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Lbl t="DNA contribution"><input className={field} value={s.dnaContribution} onChange={(e) => setStage(i, { dnaContribution: e.target.value })} /></Lbl>
              <Lbl t="Why selected"><input className={field} value={s.whySelected} onChange={(e) => setStage(i, { whySelected: e.target.value })} /></Lbl>
            </div>
            {s.routeKey && <div className="text-xs text-muted-foreground">Route key preserved: {s.routeKey}</div>}
            <MountainPicker stage={s} onPick={(m) => setStage(i, { mountainId: m?.id ?? "", mountainName: m?.name ?? "" })} />
          </div>
        ))}
        <div className="text-sm text-muted-foreground">Preview of totals: {totals.km.toFixed(1)} km, {totals.up.toFixed(0)} m ascent. The server derives the stored totals.</div>
      </div>

      {wantsActive && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p>Human factual and safety review is required before an expedition is made available. Saving does not verify any route, distance or ascent.</p>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.reviewed} onChange={(e) => set({ reviewed: e.target.checked })} />
            <span>I have personally reviewed the route facts, distances, ascent and safety limitations above.</span></label>
        </div>
      )}
      {errs.length > 0 && dirty && <ul className="list-disc pl-5 text-sm text-destructive">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      {serverErr && <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{serverErr}{!isNew && /409|changed|stale|updated/i.test(serverErr) ? " Reload the expedition to get the latest version." : ""}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy || blocked || (!isNew && !dirty)} onClick={save}>{busy ? "Working..." : isNew ? "Create draft" : "Save changes"}</Button>
        {canDelete && !confirmDelete && <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete draft</Button>}
        {confirmDelete && <>
          <span className="text-sm">Permanently delete this draft?</span>
          <Button type="button" variant="destructive" disabled={busy} onClick={remove}>Confirm delete</Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        </>}
        {!isNew && !canDelete && <span className="text-xs text-muted-foreground">Only drafts can be deleted. Set status to Hidden to withdraw an expedition.</span>}
      </div>
    </div>
  );
}

const PROMPT = `You are preparing draft hiking expedition data for SummitReady. Output ONLY JSON: {"expeditions":[ ... ]} (max 100 expeditions, 30 stages each).
Each expedition: challengeId (3-40 chars, uppercase letters, numbers, underscore, hyphen), challengeName, targetMountainName, optional targetRoute, summary, regions (a single comma-separated string, e.g. "Lake District, Snowdonia"), difficulty, recommendedDays (number), limitations (array of strings), stages (ordered array).
Each stage: routeName, distanceKm (number above 0, FULL route length, not a partial leg), ascentM (number 0 or more, total cumulative ascent along the route; NEVER the summit altitude), optional region, estimatedHours, difficulty, dnaContribution, whySelected.
Rules: Do not guess mountain UUIDs and do not include mountainId; an admin links catalogue mountains later. Do not invent route facts. If you cannot find a route or its figures, omit that stage and add a limitation noting that a human must supply evidence. Do not set status or reviewed. Everything imports as a draft needing human review.`;

const TEMPLATE = { expeditions: [{ challengeId: "EXAMPLE-RIDGE-3", challengeName: "Example Ridge Challenge", targetMountainName: "Example Peak", targetRoute: "Example Ridge Route", summary: "Replace with a reviewed summary.", regions: "Example Region, Another Region", difficulty: "Moderate", recommendedDays: 3, limitations: ["Figures are placeholders and must be replaced with evidence-based values."], stages: [{ routeName: "Example Warm-up Route", region: "Example Region", distanceKm: 8.5, ascentM: 520, estimatedHours: 3.5 }, { routeName: "Example Ridge Route", distanceKm: 14.2, ascentM: 960 }] }] };

function parseJson(text: string): ExpeditionInput[] {
  let t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (m) t = m[1];
  const v = JSON.parse(t);
  const arr = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray((v as { expeditions?: unknown }).expeditions) ? (v as { expeditions: unknown[] }).expeditions : null;
  if (!arr) throw new Error("Expected an array or an object with an expeditions array.");
  return arr as ExpeditionInput[];
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpeditionInput[] | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [impErr, setImpErr] = useState<string | null>(null);
  const preview = usePreviewExpeditions();
  const imp = useImportExpeditions();
  const fileRef = useRef<HTMLInputElement>(null);
  const rev = useRef(0);
  const reset = () => { rev.current++; setResult(null); setRows(null); setImpErr(null); };

  const runPreview = () => {
    reset(); setParseErr(null);
    let parsed: ExpeditionInput[];
    try { parsed = parseJson(text); } catch (e) { setParseErr(e instanceof Error ? e.message : "Invalid JSON"); return; }
    if (parsed.length === 0 || parsed.length > 100) { setParseErr("Provide between 1 and 100 expeditions."); return; }
    const mine = rev.current;
    preview.mutate(parsed, {
      onSuccess: (r) => { if (rev.current === mine) { setRows(parsed); setResult(r); } },
      onError: (e) => { if (rev.current === mine) setParseErr(e instanceof Error ? e.message : "Preview failed"); },
    });
  };
  const commit = () => {
    if (!rows) return;
    imp.mutate(rows, {
      onSuccess: (r) => { toast.success(`${r.created.length} drafts created`); setText(""); reset(); onImported(); },
      onError: (e) => setImpErr(e instanceof Error ? e.message : "Import failed"),
    });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "expedition-template.json"; a.click(); URL.revokeObjectURL(url);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(PROMPT); toast.success("Prompt copied"); } catch { toast.error("Copy failed"); } };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setParseErr("File is too large."); return; }
    const mine = ++rev.current;
    const content = await f.text();
    if (rev.current !== mine) return;
    setText(content); reset(); setParseErr(null);
  };

  return (
    <div className="space-y-4" data-testid="expedition-import">
      <div className="rounded-md border border-border bg-card p-4 text-sm">
        Imports only create <strong>drafts</strong>. Existing expeditions are never updated or overwritten, nothing is published automatically, and the whole batch is rejected if any entry fails. Every draft needs human factual and safety review.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={download}>Download JSON template</Button>
        <Button type="button" variant="secondary" onClick={copy}>Copy ChatGPT/Claude prompt</Button>
        <Button type="button" variant="secondary" disabled={preview.isPending || imp.isPending} onClick={() => fileRef.current?.click()}>Choose JSON file</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <Textarea rows={12} className="font-mono text-xs" placeholder='Paste JSON: {"expeditions":[...]} or a raw array' value={text} disabled={preview.isPending || imp.isPending} onChange={(e) => { setText(e.target.value); reset(); }} />
      {parseErr && <div role="alert" className="text-sm text-destructive">{parseErr}</div>}
      <div className="flex gap-2">
        <Button type="button" disabled={!text.trim() || preview.isPending} onClick={runPreview}>{preview.isPending ? "Checking..." : "Preview"}</Button>
        <Button type="button" disabled={!result?.valid || imp.isPending} onClick={commit}>{imp.isPending ? "Importing..." : "Import as drafts"}</Button>
      </div>
      {impErr && <div role="alert" className="text-sm text-destructive">{impErr} <button className="underline" onClick={commit}>Retry</button></div>}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Badge variant={result.valid ? "secondary" : "destructive"}>{result.valid ? "Valid" : "Not valid"}</Badge><span className="text-sm text-muted-foreground">{result.entries.length} entries</span></div>
          {result.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{result.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          <ul className="space-y-2">
            {result.entries.map((en) => (
              <li key={en.index} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="font-medium">#{en.index + 1} {en.challengeId} <span className="font-normal text-muted-foreground">{en.challengeName}</span></div>
                {en.errors.map((x, i) => <div key={i} className="text-destructive">Error: {x}</div>)}
                {en.warnings.map((x, i) => <div key={i} className="text-amber-500">Warning: {x}</div>)}
                {en.errors.length === 0 && en.warnings.length === 0 && <div className="text-muted-foreground">No issues.</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdminKeyBar() {
  const [key, setKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [saved, setSaved] = useState(false);
  const apply = () => {
    if (key.trim()) sessionStorage.setItem("summitready-admin-key", key.trim());
    else sessionStorage.removeItem("summitready-admin-key");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3 text-sm lg:col-span-2">
      <span className="text-muted-foreground">Admin key (this browser session only)</span>
      <input type="password" autoComplete="off" className={`${field} max-w-xs`} value={key} onChange={(e) => setKey(e.target.value)} />
      <Button type="button" size="sm" variant="secondary" onClick={apply}>{saved ? "Saved" : "Use key"}</Button>
    </div>
  );
}

export default function Expeditions() {
  const list = useExpeditionList();
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "new" | "import">("import");
  const [dirty, setDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const detail = useExpedition(mode === "edit" ? selected : null);

  const guard = () => !dirty || window.confirm("You have unsaved edits. Discard them?");
  const go = (m: "edit" | "new" | "import", id: string | null = null) => {
    if (!guard()) return;
    setDirty(false); setMode(m); setSelected(id); setEditorKey((k) => k + 1);
  };
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const items = list.data?.expeditions ?? [];
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <ArtworkAdminHeader activeSection="expeditions" actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => go("import")}>Bulk import</Button>
          <Button size="sm" onClick={() => go("new")}>New draft</Button>
        </div>} />
      <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[320px_1fr]">
        <AdminKeyBar />
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Expeditions</h2>
          {list.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          {list.error && <div role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{(list.error as Error).message}<div><Button size="sm" variant="secondary" className="mt-2" onClick={() => list.refetch()}>Retry</Button></div></div>}
          {list.data && items.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No expeditions yet. Create a blank draft or import a JSON file.</div>}
          <ul className="space-y-2">
            {items.map((e) => (
              <li key={e.challengeId}>
                <button type="button" onClick={() => go("edit", e.challengeId)} data-testid={`row-expedition-${e.challengeId}`}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${mode === "edit" && selected === e.challengeId ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{e.challengeName}</span><Badge variant="secondary">{e.status}</Badge></div>
                  <div className="text-xs text-muted-foreground">{e.challengeId} · {e.targetMountainName} · {e.stages?.length ?? 0} stages</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-semibold">{mode === "import" ? "Bulk import" : mode === "new" ? "New draft expedition" : "Edit expedition"}</h2>
          {mode === "import" && <ImportPanel onImported={() => list.refetch()} />}
          {mode === "new" && <Editor key={`new-${editorKey}`} source={null} isNew onDirty={setDirty} onDone={(id) => { setDirty(false); if (id) { setMode("edit"); setSelected(id); setEditorKey((k) => k + 1); } }} />}
          {mode === "edit" && !selected && <div className="text-sm text-muted-foreground">Select an expedition.</div>}
          {mode === "edit" && selected && detail.isLoading && <Skeleton className="h-96 w-full" />}
          {mode === "edit" && selected && detail.error && <div role="alert" className="text-sm text-destructive">{(detail.error as Error).message} <button className="underline" onClick={() => detail.refetch()}>Retry</button></div>}
          {mode === "edit" && selected && detail.data && !detail.isFetching && (
            <Editor key={`${selected}-${detail.data.expedition.updatedAt}-${editorKey}`} source={detail.data.expedition} isNew={false} onDirty={setDirty}
              onDone={(id) => { setDirty(false); if (id) { setSelected(id); } else { setSelected(null); setMode("import"); } setEditorKey((k) => k + 1); }} />
          )}
        </section>
      </main>
    </div>
  );
}
