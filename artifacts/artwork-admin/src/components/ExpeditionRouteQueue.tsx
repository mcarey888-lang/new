import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpeditionRouteQueue, type ExpeditionRouteQueueRoute } from "../hooks/use-route-reviews";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function status(r: ExpeditionRouteQueueRoute) {
  if (r.reviews.length > 0) return "Source track only";
  return "Needs route source";
}
const range = (v: number[], u: string) => v.length ? `${Math.min(...v)}${v.length > 1 && Math.max(...v) !== Math.min(...v) ? `-${Math.max(...v)}` : ""} ${u}` : "none";

export function ExpeditionRouteQueue({ onSelectReview }: { onSelectReview: (id: string) => void }) {
  const q = useExpeditionRouteQueue();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const routes = q.data?.routes ?? [];
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return routes;
    return routes.filter((r) => [r.routeName, r.region, ...r.expeditionIds].some((s) => s.toLowerCase().includes(t)));
  }, [routes, term]);
  const counts = useMemo(() => {
    const c = { "Source track only": 0, "Needs route source": 0 };
    routes.forEach((r) => { c[status(r) as keyof typeof c]++; });
    return c;
  }, [routes]);

  return (
    <div className="rounded-md border border-border bg-card" data-testid="expedition-route-queue">
      <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="button-toggle-queue">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Expedition route requirements</span>
        <span className="text-xs text-muted-foreground">
          {q.data ? `${q.data.summary.distinctRoutes} required routes · ${counts["Source track only"]} have source tracks, completeness unverified` : q.isLoading ? "Loading..." : "Unavailable"} · {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="text-xs text-muted-foreground">Constructed itineraries are withdrawn. Existing source tracks may be incomplete; none is presented as a verified full expedition route. Replacements require an exact published track and permission for app reuse—not inferred waypoints or automatic pathfinding.</div>
          {q.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          {q.error && (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-queue-error">
              {q.error instanceof Error ? q.error.message : "Request failed"}
              <div><Button size="sm" variant="secondary" className="mt-2" onClick={() => q.refetch()}>Retry</Button></div>
            </div>
          )}
          {q.data && (
            <>
              <input aria-label="Search routes" data-testid="input-queue-search" className={field} placeholder="Search route, region or expedition ID" value={term} onChange={(e) => setTerm(e.target.value)} />
              <div className="text-xs text-muted-foreground">{rows.length} of {routes.length} routes shown · {counts["Source track only"]} have unverified source tracks · {counts["Needs route source"]} have no source track</div>
              {rows.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No routes match.</div>}
              <ul className="max-h-[32rem] space-y-2 overflow-auto">
                {rows.map((r) => {
                  const s = status(r);
                  return (
                    <li key={`${r.routeKey}:${r.region}`} className="space-y-2 rounded-md border border-border bg-background p-3 text-sm" data-testid={`row-queue-${r.routeKey}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><span className="font-medium">{r.routeName}</span> <span className="text-muted-foreground">{r.region}</span></div>
                        <Badge variant="outline">{s}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.stageUses} stage use{r.stageUses === 1 ? "" : "s"} · Expeditions: {r.expeditionIds.join(", ") || "none"} · Unverified snapshot: {range(r.distanceKm, "km")}, ascent {range(r.ascentM, "m")}
                      </div>
                      {r.reviews.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {r.reviews.slice(0,1).map((v) => (
                            <Button key={v.id} type="button" size="sm" variant="secondary" className="h-auto max-w-full whitespace-normal break-words py-2 text-left" data-testid={`button-queue-review-${v.id}`} onClick={() => { setOpen(false); onSelectReview(v.id); }}>
                              Open latest {v.candidateKey} v{v.revisionVersion}{v.canonicalGeometryId ? "" : " (unbound)"}
                            </Button>
                          ))}
                        </div>
                      )}
                      {r.sourceLeads.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Unverified source leads (not matched to this route):</span>
                          <ul className="list-disc pl-5">{r.sourceLeads.map((l) => (
                            <li key={l.id}><a className="underline" href={l.url} target="_blank" rel="noreferrer">{l.name}</a> <span className="text-muted-foreground">({l.status}, unverified)</span></li>
                          ))}</ul>
                        </div>
                      )}
                      {r.blockers.length > 0 && <ul className="list-disc pl-5 text-xs">{r.blockers.map((b, i) => <li key={i}>Blocking: {b}</li>)}</ul>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
