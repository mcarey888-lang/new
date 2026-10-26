import { useQuery } from "@tanstack/react-query";
import { routeReviewCall, type RouteRevision, type RouteValidation } from "@/hooks/use-route-reviews";
import { analyseRoute, parseCoordinates } from "@/lib/route-review-map";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const num = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (v: unknown): string => typeof v === "string" ? v : "";
const metres = (v: unknown) => num(v) === null ? "Unavailable" : `${Math.round(num(v)!).toLocaleString()} m`;

export function RouteReviewSummary({ revision: r, validations = [] }: { revision: RouteRevision; validations: RouteValidation[] }) {
  const sources = r.sourceManifest ?? [];
  const prepared = sources.map(s => obj(obj(s.metadata).reviewSummary)).find(s => s.format === "summitready-route-review-summary-v1") ?? {};
  const legacy = sources.find(s => s.planningEstimates) ?? {};
  const mountain = obj(prepared.mountain ?? legacy.catalogueMountain);
  const estimates = obj(legacy.planningEstimates);
  const profile = useQuery({
    queryKey: ["route-reviews", r.id, "profile-summary", r.profileSha256],
    enabled: !!r.profileSha256,
    queryFn: () => routeReviewCall<Obj>(`/${r.id}/files/profile`),
    retry: false, staleTime: 30_000,
  });
  const validProfile = profile.data?.format === "summitready-terrain-profile-review-v1"
    && profile.data?.geometrySha256 === r.reviewFileHashes?.files?.geometry?.sha256;
  const result = validProfile ? obj(profile.data?.result) : {};
  const length = num(result.lengthM);
  const parsedGeometry = parseCoordinates(r.geometry?.coordinates);
  const savedLength = parsedGeometry.ok ? analyseRoute(parsedGeometry.coords, null).lengthM : null;
  const distance = length !== null ? length / 1000 : savedLength !== null ? savedLength / 1000 : num(estimates.outAndBackHorizontalKm);
  const rawPoints = Array.isArray(result.points) ? result.points.map(obj) : [];
  const points = rawPoints.filter(p => num(p.distanceM) !== null && num(p.elevationM) !== null);
  const canPlot = points.length > 1 && points.length === rawPoints.length;
  let path = "";
  if (canPlot) {
    const xMax = Math.max(...points.map(p => num(p.distanceM)!));
    const low = Math.min(...points.map(p => num(p.elevationM)!));
    const high = Math.max(...points.map(p => num(p.elevationM)!));
    path = points.map((p, i) => `${i ? "L" : "M"}${(8 + num(p.distanceM)! / (xMax || 1) * 584).toFixed(1)} ${(130 - (num(p.elevationM)! - low) / (high - low || 1) * 116).toFixed(1)}`).join(" ");
  }
  const oldDistance = num(prepared.existingExpeditionDistanceKm ?? estimates.existingExpeditionDistanceKm);
  const oldAscent = num(prepared.existingExpeditionAscentM ?? estimates.existingExpeditionAscentM);
  const linked = !!r.canonicalGeometryId;
  const latest = validations[0];
  const isWatkin = prepared.terrainSourceFamily === "EU-DEM" || text(legacy.candidateId).startsWith("osm-watkin-");
  const source = sources.find(s => s.provider === "OpenStreetMap") ?? {};
  const isOsm = source.provider === "OpenStreetMap";
  const osmUrl = text(source.url ?? source.relationUrl);
  const safeUrl = /^https:\/\/(?:www\.)?openstreetmap\.org\//.test(osmUrl) ? osmUrl : "https://www.openstreetmap.org/copyright";
  const sourceDate = text(prepared.sourceCapturedAt ?? legacy.sourceCapturedAt);
  const usesHostedRouting = sources.some(s => text(s.provider).includes("openrouteservice") || !!s.routingProviderNotice);
  const itinerary = sources.find(s => Array.isArray(s.proposedAnchors));
  const proposedAnchors = Array.isArray(itinerary?.proposedAnchors) ? itinerary.proposedAnchors.map(obj) : [];
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" data-testid="route-readable-summary">
      <div>
        <h4 className="font-semibold">Route at a glance</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {text(mountain.name) || "Mountain not specified"} · {text(prepared.routeKind) || "Proposed route — see source evidence"}
        </p>
        <p className="mt-1 text-sm text-amber-400">Development review only — not cleared for navigation.</p>
        {sources.some(s => s.fullExpeditionVariantConfirmed === false) && (
          <p role="note" className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Unverified route draft—not a confirmed expedition itinerary. Check the start/parking, approach, summit connection, return and exact ridge or scramble variant. Network/engine drafts are proposed walks, not sourced named itineraries; source-only tracks may still be incomplete. No elevation has been invented.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Route length (geometry)</dt><dd className="text-lg font-semibold">{distance === null ? "Unavailable" : `${distance.toFixed(2)} km`}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Estimated ascent (DEM)</dt><dd className="text-lg font-semibold">{profile.isPending && r.profileSha256 ? "Loading…" : metres(result.ascentM)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Summit (catalogue)</dt><dd className="text-lg font-semibold">{metres(mountain.elevationM)}</dd></div>
      </dl>
      {proposedAnchors.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Proposed itinerary waypoints (not verified)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            {proposedAnchors.map((a,i) => <li key={i}>{text(a.label) || "Unlabelled anchor"}{num(a.offsetM) !== null && num(a.offsetM)! > 150 ? ` — nearest mapped path node ${Math.round(num(a.offsetM)!)} m away; check this location` : ""}</li>)}
          </ol>
        </details>
      )}
      {profile.isError && <p role="alert" className="text-sm text-destructive">The elevation profile could not be read. Use the protected download below or reload; no estimate has been substituted.</p>}
      {profile.data && !validProfile && <p role="alert" className="text-sm text-destructive">This profile does not match the original geometry file. Its figures are not shown.</p>}
      {canPlot && <figure className="space-y-1">
        <svg viewBox="0 0 600 150" className="w-full rounded-md border border-border bg-background text-primary" role="img" aria-label="DEM-estimated elevation along the proposed route">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <figcaption className="text-xs text-muted-foreground">Estimated terrain profile, not a GPS recording or surveyed elevation. DEM maximum: {metres(result.maxElevationM)}; catalogue summit: {metres(mountain.elevationM)}. No heights were adjusted to force a match. This does not prove safe access.</figcaption>
      </figure>}
      {(oldDistance !== null || oldAscent !== null) && <p className="text-xs text-muted-foreground">
        Existing expedition snapshot: {oldDistance !== null ? `${oldDistance} km` : "distance unavailable"} · {oldAscent !== null ? metres(oldAscent) : "ascent unavailable"}. These figures and all recorded activities are unchanged.
      </p>}
      {distance !== null && oldDistance !== null && Math.abs(distance - oldDistance) > oldDistance * .25 && (
        <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          This draft's length differs substantially from the existing expedition figure. Check for detours, repeated sections, a different start or a different variant. Neither figure is treated as verified, and the expedition is unchanged.
        </p>
      )}
      <details className="space-y-3 text-sm">
      <summary className="cursor-pointer font-medium">Evidence checks and outstanding publication requirements</summary>
      <div className="space-y-2 text-sm">
        <h5 className="font-medium">What has been checked</h5>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>The saved files have recorded integrity checksums; protected downloads verify those bytes.</li>
          {num(prepared.sourceEdgesChecked) !== null && <li>{num(prepared.sourceEdgesChecked)?.toLocaleString()} source edges checked across {num(prepared.sourceWayCount)} OpenStreetMap ways. No invented connecting edges were added.</li>}
          <li>{linked ? "A separate draft route geometry is linked in development. This does not make the route verified." : "No canonical route geometry is linked to this revision."}</li>
        </ul>
      </div>
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="route-review-next-steps">
        <h5 className="font-medium">{r.eligible ? "Development review status" : "What still blocks acceptance"}</h5>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {linked && !r.bindingCurrent && <li>The draft catalogue link is not cleared. {prepared.mountainStatus === "imported" ? "At preparation, the peak was imported, and the new route and definition needed review; current binding checks still do not pass." : "Catalogue status, exact source membership and reuse evidence must pass the binding checks."}</li>}
          {!linked && <li>This revision is unbound. A separate canonical draft must be prepared before it can be accepted.</li>}
          {!latest?.sourceRightsReviewed && <li>{isOsm ? "OpenStreetMap reuse requires attribution and ODbL compliance." : "Source reuse permission and required credits need review."} No source-rights attestation is set in the latest validation.</li>}
          {r.profileSha256 && !latest?.terrainRightsReviewed && <li>{isWatkin ? "The six Watkin terrain tiles were identified as EU-DEM, but their exact source edition remains unresolved. Attribution, modification notices and no implied endorsement are required." : "Terrain-source rights and required credits need explicit review."}</li>}
          {!latest?.routeAccessReviewed && <li>Current access, hazards and the intended start/finish need explicit route review. No flagged source tags is not proof of safe access.</li>}
          {r.profileSha256 && !latest?.profileReviewed && <li>The elevation estimate, including its difference from the catalogue summit height, still needs profile review.</li>}
          {latest?.outcome !== "accepted" && <li>No accepted validation is recorded as the latest review.</li>}
          {r.bindingCurrent && !r.eligible && <li>A current accepted validation and active development approval are required. They do not publish a route.</li>}
          {r.eligible && <li>The server reports development eligibility. Production publication is separate and remains disabled here.</li>}
        </ul>
        <p className="mt-2 font-medium">No approval is required just to inspect this route. Only attest to checks you have actually completed.</p>
      </div>
      </details>
      <p className="text-xs text-muted-foreground">
        {usesHostedRouting && <><a href="https://openrouteservice.org/" target="_blank" rel="noreferrer" className="underline">© openrouteservice by HeiGIT</a> | Data from OpenStreetMap · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-SA 4.0</a>. Routing credits apply to provider-derived sections. </>}
        {isOsm ? <>Source: <a href={safeUrl} target="_blank" rel="noreferrer" className="underline">OpenStreetMap — © OpenStreetMap contributors</a>, ODbL 1.0.</> : <>Source details are retained in the technical evidence below.</>}
        {sourceDate && <> Snapshot captured {new Date(sourceDate).toLocaleDateString()}.</>}
        {isWatkin && <> <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer" className="underline">Terrain attribution</a>. <a href="https://sdi.eea.europa.eu/catalogue/srv/api/records/19cff95e-61ac-45ed-8ee3-c43220d709cf" target="_blank" rel="noreferrer" className="underline">EU-DEM terms</a>.</>}
      </p>
    </section>
  );
}
