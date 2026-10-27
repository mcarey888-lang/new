import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminExpeditionManualBuilder, AdminExpeditionManualBuilderEligibleSummitPoolItemRoutesItem as PoolRoute } from "@workspace/api-client-react";
import { calculateManualDna, normalizeManualTechnicalTarget } from "../../../summit-ready/utils/manualExpedition";

export const MAX_MANUAL_STAGES = 30;
const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const fmtKm = (v: number) => `${v.toFixed(1)} km`;
const fmtM = (v: number) => `${Math.round(v)} m`;

export function routeIndex(pool: AdminExpeditionManualBuilder) {
  const m = new Map<string, { route: PoolRoute; summitName: string }>();
  pool.eligibleSummitPool.forEach((s) => s.routes.forEach((r) => {
    if (r.routeIdentityKey) m.set(r.routeIdentityKey, { route: r, summitName: s.summitName });
  }));
  return m;
}
export const hasDistance = (r: PoolRoute) => typeof r.routeDistanceKm === "number" && r.routeDistanceKm > 0;

export function ManualRoutePicker({ pool, selected, onChange, disabled }: {
  pool: AdminExpeditionManualBuilder; selected: string[]; onChange: (keys: string[]) => void; disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const index = useMemo(() => routeIndex(pool), [pool]);
  const chosen = selected.map((k) => index.get(k)).filter((x): x is { route: PoolRoute; summitName: string } => !!x);
  const complete = chosen.filter((c) => hasDistance(c.route));
  const missing = chosen.length - complete.length;
  const t = pool.targetDna;
  const dna = calculateManualDna(
    complete.map((c) => ({ gainM: c.route.routeGainM, distanceKm: c.route.routeDistanceKm as number, averageGradientPercent: c.route.estimatedAverageGradientPercent ?? null })),
    { gainM: t.elevationGainM, distanceKm: t.distanceKm, averageGradientPercent: t.averageGradientPercent ?? null },
  );
  const technical = normalizeManualTechnicalTarget(t.technicalCharacter ?? null);

  const toggle = (r: PoolRoute) => {
    if (!r.routeIdentityKey) return;
    if (selected.includes(r.routeIdentityKey)) { onChange(selected.filter((k) => k !== r.routeIdentityKey)); return; }
    const sameSummit = selected.findIndex((k) => index.get(k)?.route.summitIdentityKey === r.summitIdentityKey);
    if (sameSummit >= 0) { const next = [...selected]; next[sameSummit] = r.routeIdentityKey; onChange(next); return; }
    if (selected.length >= MAX_MANUAL_STAGES) return;
    onChange([...selected, r.routeIdentityKey]);
  };

  const needle = q.trim().toLowerCase();
  const summits = pool.eligibleSummitPool.filter((s) => !needle || s.summitName.toLowerCase().includes(needle) || s.routes.some((r) => r.routeName?.toLowerCase().includes(needle)));

  return (
    <div className="space-y-4" data-testid="manual-route-picker">
      <div className="rounded-md border border-border bg-card p-4 text-sm space-y-2" data-testid="manual-live-dna">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Live match against target</span>
          <Badge variant="secondary" data-testid="text-manual-overall">Overall {dna.overall}%</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>Ascent: <strong>{fmtM(dna.gainM)}</strong> of {fmtM(t.elevationGainM)} ({dna.gainMatch}%) · {dna.remainingGainM > 0 ? `${fmtM(dna.remainingGainM)} remaining` : `${fmtM(-dna.remainingGainM)} over`}</div>
          <div>Distance: <strong>{fmtKm(dna.distanceKm)}</strong> of {fmtKm(t.distanceKm)} ({dna.distanceMatch}%) · {dna.remainingDistanceKm > 0 ? `${fmtKm(dna.remainingDistanceKm)} remaining` : `${fmtKm(-dna.remainingDistanceKm)} over`}</div>
        </div>
        <div className="text-xs text-muted-foreground">Target character: {technical}. Range: {dna.range.replace("_", " ")}. Figures are route estimates, calculated locally; summit altitude and identity do not verify navigation.</div>
        {missing > 0 && <div className="text-xs text-destructive">{missing} selected route{missing > 1 ? "s have" : " has"} no known distance and {missing > 1 ? "are" : "is"} excluded from these totals. Remove or replace before building.</div>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm"><span className="font-medium">Selected ({selected.length}/{MAX_MANUAL_STAGES})</span>
          {selected.length > 0 && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange([])}>Clear all</Button>}</div>
        {chosen.length === 0 && <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No routes chosen yet. Pick one route per summit below.</div>}
        <ol className="space-y-1">{chosen.map((c, i) => (
          <li key={c.route.routeIdentityKey} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-sm" data-testid={`row-selected-${i}`}>
            <span>{i + 1}. {c.summitName} · {c.route.routeName ?? "Route name unavailable"} <span className="text-muted-foreground">{fmtM(c.route.routeGainM)} ascent, {hasDistance(c.route) ? fmtKm(c.route.routeDistanceKm as number) : <span className="text-destructive">distance unknown</span>}</span></span>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => toggle(c.route)}>Remove</Button>
          </li>))}</ol>
      </div>

      <input className={field} placeholder="Filter summits or routes" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-manual-filter" />
      {summits.length === 0 && <div className="text-sm text-muted-foreground">No summits match this filter.</div>}
      <ul className="max-h-[28rem] space-y-2 overflow-auto">
        {summits.map((s) => (
          <li key={s.summitIdentityKey} className="rounded-md border border-border bg-card p-3">
            <div className="text-sm font-medium">{s.summitName} {s.summitElevationASL != null && <span className="font-normal text-muted-foreground">summit {s.summitElevationASL} m (not ascent)</span>}</div>
            <ul className="mt-2 space-y-1">{s.routes.map((r) => {
              const on = !!r.routeIdentityKey && selected.includes(r.routeIdentityKey);
              const full = !on && selected.length >= MAX_MANUAL_STAGES && !selected.some((k) => index.get(k)?.route.summitIdentityKey === r.summitIdentityKey);
              return (
                <li key={r.routeIdentityKey ?? `${s.summitIdentityKey}-${s.routes.indexOf(r)}`}>
                  <button type="button" disabled={disabled || full || !r.routeIdentityKey} aria-pressed={on} onClick={() => toggle(r)} data-testid={`button-route-${r.routeIdentityKey}`}
                    className={`flex w-full flex-wrap justify-between gap-2 rounded border px-3 py-2 text-left text-sm disabled:opacity-50 ${on ? "border-primary bg-secondary" : "border-border hover:bg-secondary"}`}>
                    <span>{on ? "Selected: " : ""}{r.routeName ?? "Route name unavailable"}{!r.routeIdentityKey ? " · Selection unavailable: missing identity" : ""}{r.difficulty ? <span className="text-muted-foreground"> · {r.difficulty}</span> : null}</span>
                    <span className="text-xs text-muted-foreground">{fmtM(r.routeGainM)} ascent · {hasDistance(r) ? fmtKm(r.routeDistanceKm as number) : "distance unknown"}{r.provenance?.routeDataStatus ? ` · ${r.provenance.routeDataStatus}` : ""}</span>
                  </button>
                </li>);
            })}</ul>
          </li>))}
      </ul>
    </div>
  );
}
