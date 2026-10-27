import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetAdminExpeditionTargetProfile200, VirtualExpeditionSearchInput } from "@workspace/api-client-react";
import { calculateManualDna } from "../../../summit-ready/utils/manualExpedition";
import { useTargetProfile } from "../hooks/use-expeditions";

type Item = Record<string, unknown>;
const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const label = (x: Item) => str(x.label) || str(x.name) || str(x.title) || str(x.routeName) || str(x.mountainName) || "Unnamed option";
const details = (x: Item) => Object.entries(x)
  .filter(([k, v]) => !["label", "name", "title"].includes(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
  .map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
const routeKeyOf = (x: Item) => str(x.identityKey) || str(x.targetRouteIdentityKey) || str(x.routeIdentityKey) || str(x.key) || str(x.id);

/** Mount with key={targetMountain|targetRoute} so text changes clear the loaded profile. */
export function TargetComparison({ targetMountain, regions, stages }: {
  targetMountain: string; regions: string; stages: { distanceKm: string; ascentM: string }[];
}) {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [routeKey, setRouteKey] = useState("");
  const [profile, setProfile] = useState<GetAdminExpeditionTargetProfile200 | null>(null);
  const [amb, setAmb] = useState<Item | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tp = useTargetProfile();
  const alive = useRef(true);
  const rev = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; rev.current++; }; }, []);
  const fence = () => { rev.current++; setProfile(null); };

  const load = () => {
    if (tp.isPending || targetMountain.trim().length < 2) return;
    setErr(null);
    const loc = regions.split(",").map((x) => x.trim()).filter(Boolean).join(", ");
    const input: VirtualExpeditionSearchInput = { targetMountain: targetMountain.trim(), userLocation: loc.length >= 2 ? loc : "United Kingdom" };
    if (country.trim()) input.targetCountry = country.trim();
    if (region.trim()) input.targetRegion = region.trim();
    if (routeKey) input.targetRouteIdentityKey = routeKey;
    const mine = ++rev.current;
    tp.mutate(input, {
      onSuccess: (r) => { if (!alive.current || rev.current !== mine) return; setAmb(null); setProfile(r); },
      onError: (e) => {
        if (!alive.current || rev.current !== mine) return;
        const status = (e as { status?: number }).status;
        const data = (e as { data?: unknown }).data;
        if (status === 409 && data && typeof data === "object") { setAmb(data as Item); return; }
        setAmb(null); setErr(e instanceof Error ? e.message : "Target comparison failed");
      },
    });
  };

  const list = (k: string) => (amb && Array.isArray(amb[k]) ? (amb[k] as unknown[]).filter((x): x is Item => !!x && typeof x === "object") : []);
  const places = [...list("choices"), ...list("candidates")];
  const routes = [...list("routes"), ...list("routeChoices")];
  const tm = amb && amb.targetMountain && typeof amb.targetMountain === "object" ? (amb.targetMountain as Item) : null;
  const busy = tp.isPending;

  const complete = stages.length > 0 && stages.every((s) => {
    const distance = Number(s.distanceKm), ascent = Number(s.ascentM);
    return s.distanceKm.trim() !== "" && Number.isFinite(distance) && distance > 0 && distance <= 1000
      && s.ascentM.trim() !== "" && Number.isFinite(ascent) && ascent >= 0 && ascent <= 20000;
  });
  const t = profile?.targetProfile;
  const targetOk = !!t && t.totalElevationGain > 0 && t.totalDistance > 0;
  const dna = complete && targetOk ? calculateManualDna(stages.map((s) => ({ gainM: Number(s.ascentM), distanceKm: Number(s.distanceKm) })), { gainM: t!.totalElevationGain, distanceKm: t!.totalDistance }) : null;
  const warnings = profile?.provenance?.warnings ?? [];

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="target-comparison">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Target comparison</h3>
        <Button type="button" size="sm" variant="secondary" data-testid="button-load-target" disabled={busy || targetMountain.trim().length < 2} onClick={load}>{busy ? "Loading..." : profile ? "Reload target comparison" : amb ? "Retry" : "Load target comparison"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Loading may use AI to profile a target that is not cached. Scores are diagnostic only: not saved, not progress, and not route approval. Estimates never verify navigation.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder="Target country (optional)" value={country} disabled={busy} onChange={(e) => { fence(); setCountry(e.target.value); }} />
        <input className={field} placeholder="Target region (optional)" value={region} disabled={busy} onChange={(e) => { fence(); setRegion(e.target.value); }} />
      </div>
      {routeKey && <div className="text-sm">Chosen route key: <strong>{routeKey}</strong> <button type="button" className="underline" disabled={busy} onClick={() => { fence(); setRouteKey(""); }}>Clear</button></div>}
      {busy && <Skeleton className="h-16 w-full" />}
      {err && <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}
      {amb && (
        <div role="alert" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">{str(amb.message) || str(amb.error) || "More than one match was found. Choose explicitly, then retry."}</p>
          {tm && <p className="text-muted-foreground">Mountain resolved: <strong className="text-foreground">{str(tm.canonicalName) || str(tm.id)}</strong>{str(tm.matchedBy) ? ` (matched by ${str(tm.matchedBy)})` : ""}.</p>}
          {places.map((x, i) => (
            <div key={`p${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-card p-2">
              <span><strong>{label(x)}</strong> <span className="text-muted-foreground">{details(x)}</span></span>
              {(str(x.country) || str(x.region)) && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { fence(); setCountry(str(x.country)); setRegion(str(x.region)); }}>Use country/region</Button>}
            </div>))}
          {routes.map((x, i) => { const k = routeKeyOf(x); return (
            <label key={`r${i}`} className="flex items-start gap-2 rounded border border-border bg-card p-2">
              <input type="radio" name="cmp-route" className="mt-1" disabled={busy || !k} checked={!!k && routeKey === k} onChange={() => { fence(); setRouteKey(k); }} />
              <span><strong>{label(x)}</strong> <span className="text-muted-foreground">{details(x)}</span></span>
            </label>); })}
        </div>)}
      {profile && t && (
        <div className="space-y-2 text-sm" data-testid="target-result">
          <div>Target: <strong>{t.name}</strong>{profile.targetRoute?.name ? ` via ${profile.targetRoute.name}` : ""}{t.technicalGrade ? ` · ${t.technicalGrade}` : ""}</div>
          <div className="text-xs text-muted-foreground">Target route ascent {Math.round(t.totalElevationGain)} m, distance {t.totalDistance.toFixed(1)} km{profile.provenance?.targetRouteSource ? ` · source: ${profile.provenance.targetRouteSource}` : ""}. Summit altitude is not used.</div>
          {warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-600">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          {!targetOk && <div className="text-destructive">The target profile has no usable ascent or distance, so no score is shown.</div>}
          {targetOk && !dna && <div className="rounded border border-dashed border-border p-2 text-muted-foreground" data-testid="text-comparison-incomplete">Incomplete: every stage needs a distance above 0 and an ascent of 0 or more before a match can be shown.</div>}
          {dna && (
            <div className="space-y-1 rounded border border-border p-3" data-testid="comparison-dna">
              <div className="flex items-center justify-between"><span className="font-medium">Stages vs target</span><Badge variant="secondary">Overall {dna.overall}%</Badge></div>
              <div>Ascent {Math.round(dna.gainM)} m of {Math.round(t.totalElevationGain)} m ({dna.gainMatch}%) · {dna.remainingGainM > 0 ? `${Math.round(dna.remainingGainM)} m remaining` : `${Math.round(-dna.remainingGainM)} m over`}</div>
              <div>Distance {dna.distanceKm.toFixed(1)} km of {t.totalDistance.toFixed(1)} km ({dna.distanceMatch}%) · {dna.remainingDistanceKm > 0 ? `${dna.remainingDistanceKm.toFixed(1)} km remaining` : `${(-dna.remainingDistanceKm).toFixed(1)} km over`}</div>
              <div className="text-xs text-muted-foreground">Range: {dna.range.replace("_", " ")}. Updates as you edit stages.</div>
            </div>)}
        </div>)}
    </div>
  );
}
