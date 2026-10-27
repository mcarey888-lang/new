import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminExpeditionGenerationPreview, VirtualExpeditionSearchInput } from "@workspace/api-client-react";
import { useGenerateExpedition } from "../hooks/use-expeditions";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
type Item = Record<string, unknown>;

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t}</span>{children}</label>;
}
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const label = (x: Item) => str(x.label) || str(x.name) || str(x.title) || str(x.routeName) || str(x.mountainName) || "Unnamed option";
const details = (x: Item) => Object.entries(x)
  .filter(([k, v]) => !["label", "name", "title"].includes(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
  .map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
const routeKeyOf = (x: Item) => str(x.identityKey) || str(x.targetRouteIdentityKey) || str(x.routeIdentityKey) || str(x.identityKey) || str(x.key) || str(x.id);

export function GeneratePanel({ onGenerated, onPending }: { onGenerated: (p: AdminExpeditionGenerationPreview) => void; onPending: (p: boolean) => void }) {
  const [targetMountain, setTarget] = useState("");
  const [targetCountry, setCountry] = useState("");
  const [targetRegion, setRegion] = useState("");
  const [userLocation, setLoc] = useState("");
  const [radius, setRadius] = useState("25");
  const [days, setDays] = useState("");
  const [difficulty, setDiff] = useState("");
  const [routeKey, setRouteKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ambiguity, setAmbiguity] = useState<Item | null>(null);
  const gen = useGenerateExpedition();
  const alive = useRef(true);
  const rev = useRef(0);
  const pendingRef = useRef(onPending); pendingRef.current = onPending;
  useEffect(() => { alive.current = true; return () => { alive.current = false; rev.current++; pendingRef.current(false); }; }, []);

  const r = Number(radius), d = days.trim() ? Number(days) : null;
  const problems: string[] = [];
  if (targetMountain.trim().length < 2) problems.push("Target mountain needs at least 2 characters.");
  if (userLocation.trim().length < 2) problems.push("Local walking area needs at least 2 characters.");
  if (!Number.isInteger(r) || r < 5 || r > 100) problems.push("Radius must be a whole number from 5 to 100 km.");
  if (d !== null && (!Number.isSafeInteger(d) || d < 1)) problems.push("Walking allowance must be a positive whole number.");

  const run = () => {
    if (gen.isPending || problems.length) return;
    setErr(null);
    const input: VirtualExpeditionSearchInput = { targetMountain: targetMountain.trim(), userLocation: userLocation.trim(), radius: r, daysOverride: d, mode: "automatic" };
    if (targetCountry.trim()) input.targetCountry = targetCountry.trim();
    if (targetRegion.trim()) input.targetRegion = targetRegion.trim();
    if (difficulty) input.difficultyPreference = difficulty;
    if (routeKey) input.targetRouteIdentityKey = routeKey;
    const mine = ++rev.current;
    onPending(true);
    gen.mutate(input, {
      onSuccess: (p) => { if (!alive.current || rev.current !== mine) return; onPending(false); setAmbiguity(null); onGenerated(p); },
      onError: (e) => {
        if (!alive.current || rev.current !== mine) return;
        onPending(false);
        const status = (e as { status?: number }).status;
        const data = (e as { data?: unknown }).data;
        if (status === 409 && data && typeof data === "object") { setAmbiguity(data as Item); setErr(null); return; }
        setAmbiguity(null);
        setErr(e instanceof Error ? e.message : "Generation failed");
      },
    });
  };

  const list = (k: string) => (ambiguity && Array.isArray(ambiguity[k]) ? (ambiguity[k] as unknown[]).filter((x): x is Item => !!x && typeof x === "object") : []);
  const places = [...list("choices"), ...list("candidates")];
  const routes = [...list("routes"), ...list("routeChoices")];
  const tm = ambiguity && ambiguity.targetMountain && typeof ambiguity.targetMountain === "object" ? (ambiguity.targetMountain as Item) : null;
  const busy = gen.isPending;

  return (
    <div className="space-y-4" data-testid="expedition-generate">
      <div className="rounded-md border border-border bg-card p-4 text-sm space-y-1">
        <p>Builds an <strong>unsaved draft</strong> from the app's expedition engine using local walks near your chosen area. It may use AI to profile the target mountain.</p>
        <p className="text-muted-foreground">Distances, ascent and times are estimates. Nothing here is verified navigation. Review every stage, fill any missing figures, then use Create draft to save. Nothing is published.</p>
      </div>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <Lbl t="Target mountain"><input data-testid="input-gen-target" className={field} value={targetMountain} onChange={(e) => { setTarget(e.target.value); setRouteKey(""); }} placeholder="e.g. Ben Nevis" /></Lbl>
        <Lbl t="Local walking area"><input data-testid="input-gen-location" className={field} value={userLocation} onChange={(e) => setLoc(e.target.value)} placeholder="Town or area where training walks happen" /></Lbl>
        <Lbl t="Target country (optional)"><input data-testid="input-gen-country" className={field} value={targetCountry} onChange={(e) => setCountry(e.target.value)} /></Lbl>
        <Lbl t="Target region (optional)"><input data-testid="input-gen-region" className={field} value={targetRegion} onChange={(e) => setRegion(e.target.value)} /></Lbl>
        <Lbl t="Search radius (km, 5-100)"><input data-testid="input-gen-radius" className={field} type="number" min={5} max={100} step={1} value={radius} onChange={(e) => setRadius(e.target.value)} /></Lbl>
        <Lbl t="Walking days allowance (optional)"><input data-testid="input-gen-days" className={field} type="number" min={1} step={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="Walking outings, not consecutive days" /></Lbl>
        <Lbl t="Difficulty preference (optional)">
          <select data-testid="select-gen-difficulty" className={field} value={difficulty} onChange={(e) => setDiff(e.target.value)}>
            <option value="">No preference</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option>
          </select>
        </Lbl>
      </fieldset>
      <p className="text-xs text-muted-foreground">Walking allowance is capacity, not consecutive dates. A draft can hold up to 30 stages; unused days do not create extra stages.</p>
      {routeKey && <div className="text-sm">Selected route: <strong>{routeKey}</strong> <button type="button" className="underline" disabled={busy} onClick={() => setRouteKey("")}>Clear</button></div>}
      {problems.length > 0 && (targetMountain || userLocation) && <ul className="list-disc pl-5 text-sm text-destructive">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
      <Button type="button" data-testid="button-generate" disabled={busy || problems.length > 0} onClick={run}>{busy ? "Generating, this can take a minute..." : ambiguity ? "Retry generation" : "Generate expedition"}</Button>
      {busy && <div className="space-y-2" aria-live="polite"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /><p className="text-xs text-muted-foreground">Working. Navigation to other expeditions is paused until this finishes.</p></div>}
      {err && <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}
      {ambiguity && (
        <div role="alert" className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm" data-testid="generate-ambiguity">
          <p className="font-medium">{str(ambiguity.message) || str(ambiguity.error) || "More than one match was found. Choose how to narrow it down, then retry."}</p>
          {tm && <p className="text-muted-foreground">Mountain resolved: <strong className="text-foreground">{str(tm.canonicalName) || str(tm.id)}</strong>{str(tm.matchedBy) ? ` (matched by ${str(tm.matchedBy)})` : ""}. Choose a route below.</p>}
          {places.length > 0 && <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mountain matches</p>
            <ul className="space-y-1">{places.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-card p-2">
                <span><strong>{label(x)}</strong> <span className="text-muted-foreground">{details(x)}</span></span>
                {(str(x.country) || str(x.region)) && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { setCountry(str(x.country)); setRegion(str(x.region)); }}>Use country/region</Button>}
              </li>))}</ul>
          </div>}
          {routes.length > 0 && <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Route choices</p>
            <ul className="space-y-1">{routes.map((x, i) => { const k = routeKeyOf(x); return (
              <li key={i}><label className="flex items-start gap-2 rounded border border-border bg-card p-2">
                <input type="radio" name="gen-route" className="mt-1" disabled={busy || !k} checked={!!k && routeKey === k} onChange={() => setRouteKey(k)} />
                <span><strong>{label(x)}</strong> <span className="text-muted-foreground">{details(x)}</span></span>
              </label></li>); })}</ul>
          </div>}
          {places.length === 0 && routes.length === 0 && <p className="text-muted-foreground">No options were returned. Add a country or region and retry.</p>}
        </div>
      )}
    </div>
  );
}
