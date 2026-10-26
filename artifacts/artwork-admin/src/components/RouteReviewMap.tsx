import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LMap } from "leaflet";
import { Button } from "@/components/ui/button";
import { analyseRoute, boundsOf, extractSummit, parseCoordinates, SUMMIT_TOLERANCE_M, unwrapForDisplay } from "@/lib/route-review-map";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};

export function RouteReviewMap({ identity, coordinates, sourceManifest, fallback }: {
  identity: string; coordinates: unknown; sourceManifest: Record<string, unknown>[]; fallback: React.ReactNode;
}) {
  // Detail refetches return fresh arrays; only the revision+geometry digest identity may rebuild the map.
  const coordsRef = useRef(coordinates);
  coordsRef.current = coordinates;
  const smRef = useRef(sourceManifest);
  smRef.current = sourceManifest;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parsed = useMemo(() => parseCoordinates(coordsRef.current), [identity]);
  const summit = useMemo(() => {
    const prepared = smRef.current.map(s => obj(obj(s.metadata).reviewSummary)).find(s => s.format === "summitready-route-review-summary-v1") ?? {};
    const legacy = smRef.current.find(s => s.planningEstimates) ?? {};
    return extractSummit(prepared.mountain ?? legacy.catalogueMountain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  const analysis = useMemo(() => parsed.ok ? analyseRoute(parsed.coords, summit) : null, [parsed, summit]);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const resetRef = useRef<() => void>(() => {});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tick, setTick] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!parsed.ok || !analysis || !el.current) return;
    let cancelled = false; let ro: ResizeObserver | null = null;
    let tileTimeout: ReturnType<typeof setTimeout> | undefined;
    setState("loading"); setTilesFailed(false);
    import("leaflet").then((mod) => {
      if (cancelled || !el.current) return;
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const map = L.map(el.current, { zoomControl: true, attributionControl: false, worldCopyJump: true });
      mapRef.current = map;
      let errs = 0;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, crossOrigin: true });
      tiles.on("tileerror", () => { if (++errs >= 4) setTilesFailed(true); });
      tiles.on("tileload", () => { clearTimeout(tileTimeout); });
      tileTimeout = setTimeout(() => { if (!cancelled) setTilesFailed(true); }, 12_000);
      tiles.addTo(map);
      L.control.attribution({ prefix: false }).addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>').addTo(map);
      const ll = unwrapForDisplay(parsed.coords).map((c) => [c[1], c[0]] as [number, number]);
      const b = boundsOf(parsed.coords);
      const centreLon = (b.west + b.east) / 2;
      const displayLon = (lon: number) => lon + 360 * Math.round((centreLon - lon) / 360);
      L.polyline(ll, { color: "#10151a", weight: 7, opacity: 0.75, smoothFactor: 0 }).addTo(map);
      const line = L.polyline(ll, { color: "#f5b84a", weight: 4, opacity: 0.95, smoothFactor: 0 }).addTo(map);
      const pin = (p: [number, number], color: string, label: string, r = 8) =>
        L.circleMarker([p[1], displayLon(p[0])], { radius: r, color: "#10151a", weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(label).addTo(map);
      if (analysis.startFinishCombined) pin(analysis.start, "#5ec28f", "Start and finish (within 5 m)");
      else { pin(analysis.start, "#5ec28f", "Start"); pin(analysis.end, "#e8695a", "Finish"); }
      if (analysis.outAndBack && analysis.turnaround) pin(analysis.turnaround, "#f5b84a", analysis.turnaroundIsSummit ? `Summit turnaround (within ${SUMMIT_TOLERANCE_M} m of catalogue point; draft)` : "Turnaround (middle of matching out-and-back geometry)", 7);
      if (analysis.summitReference) L.circleMarker([analysis.summitReference[1], displayLon(analysis.summitReference[0])], { radius: 10, color: "#6cb6ff", weight: 2, dashArray: "3 3", fillOpacity: 0 }).bindTooltip("Catalogue summit reference (not a route verification)").addTo(map);
      const bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
      const fit = () => map.fitBounds(bounds, { padding: [28, 28] });
      resetRef.current = fit; fit();
      void line;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => { map.invalidateSize(); });
        ro.observe(el.current);
      }
      setState("ready");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => {
      cancelled = true; ro?.disconnect(); clearTimeout(tileTimeout);
      try { mapRef.current?.remove(); } catch { /* ignore */ }
      mapRef.current = null;
    };
  }, [parsed, analysis, tick]);

  if (!parsed.ok || !analysis) return (
    <div className="space-y-2" data-testid="route-map-invalid">
      <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{parsed.ok ? "" : parsed.error} No map is drawn and no geometry has been substituted.</p>
    </div>
  );
  const km = (analysis.lengthM / 1000).toFixed(2);
  return (
    <section className="relative isolate space-y-2 rounded-lg border border-border bg-card p-3 sm:p-4" data-testid="route-map">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Saved route on the map</h4>
        <Button type="button" size="sm" variant="secondary" disabled={state !== "ready" || tilesFailed} onClick={() => resetRef.current()} data-testid="button-map-reset">Reset to route</Button>
      </div>
      {state === "error" || tilesFailed ? (
        <div className="space-y-2" data-testid="route-map-fallback">
          <p role="alert" className="text-sm text-amber-400">{state === "error" ? "The map library could not load." : "Map tiles could not be loaded."} Showing a schematic outline instead; it is not to scale and has no basemap.</p>
          <div className="flex flex-wrap items-center gap-2">{fallback}<Button type="button" size="sm" variant="secondary" onClick={() => { setState("loading"); setTilesFailed(false); setTick(t => t + 1); }}>Retry map</Button></div>
          <p className="text-xs text-muted-foreground">Route data: &copy; <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL 1.0. Basemap tiles are unavailable.</p>
        </div>
      ) : null}
      <div className={state === "error" || tilesFailed ? "hidden" : "relative"}>
        <div ref={el} className="h-72 w-full overflow-hidden rounded-md border border-border bg-background sm:h-96" data-testid="route-map-canvas" />
        {state === "loading" && <div className="absolute inset-0 grid place-items-center rounded-md bg-background/80 text-sm text-muted-foreground">Loading map...</div>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map marker key">
        <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-[#5ec28f]" />{analysis.startFinishCombined ? "Start / finish" : "Start"}</span>
        {!analysis.startFinishCombined && <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-[#e8695a]" />Finish</span>}
        {analysis.outAndBack && <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f5b84a]" />Turnaround</span>}
        {analysis.summitReference && <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-[#6cb6ff]" />Catalogue summit reference</span>}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li>Exact saved geometry, {parsed.coords.length.toLocaleString()} points, {km} km. Not simplified or snapped.</li>
        <li>{analysis.startFinishCombined ? "Start and finish are within 5 m." : "Start and finish are separate points."}</li>
        <li>{analysis.outAndBack ? `The outward and return geometry match; turnaround is halfway along the saved path${analysis.turnaroundIsSummit ? `, within ${SUMMIT_TOLERANCE_M} m of the catalogue summit reference` : ""}.` : "Matching out-and-back geometry not established; no turnaround or summit is labelled on the route."}</li>
        {analysis.summitReference && analysis.outAndBack && !analysis.turnaroundIsSummit && <li>Turnaround is {Math.round(analysis.turnaroundNearSummitM ?? 0).toLocaleString()} m from the catalogue summit reference; not labelled as the summit.</li>}
      </ul>
      <p className="text-xs text-amber-400">Review map only. Not navigation, not safety or rights clearance, and not approval.</p>
    </section>
  );
}
