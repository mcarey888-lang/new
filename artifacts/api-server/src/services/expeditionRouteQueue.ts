import type { PoolClient } from "@workspace/db";
import { expeditionRouteSourcing as sourcing } from "../data/expedition-route-sourcing.js";

type Review = { id: string; candidateKey: string; revisionVersion: string; canonicalGeometryId: string | null; routeKey: string | null };
type Source = { sourceLeads: { id: number; name: string; url: string; status: string }[]; blockers: string[] };
type Stage = {
  challenge_id: string; route_key: string; route_name: string; region: string;
  distance_km: string | number; ascent_m: number;
};
const sources = sourcing as { generatedAt: string | null; routes: Record<string, Source> };

/** Requirements are derived live, never fabricated geometry or new stage links. */
export function buildExpeditionRouteQueue(stages: Stage[], reviews: Review[]) {
  const groups = new Map<string, Stage[]>();
  for (const stage of stages) {
    // Same route key is the existing expedition identity. Preserve separate
    // regions if a future author accidentally reuses a key elsewhere.
    const key = `${stage.route_key}\0${stage.region}`;
    groups.set(key, [...(groups.get(key) ?? []), stage]);
  }
  const routes = [...groups.values()].map(group => {
    const head = group[0];
    const matching = reviews.filter(r => r.routeKey === head.route_key);
    const source = sources.routes[head.route_key];
    const blockers = [
      ...(source?.blockers ?? ["An exact reusable source for the full expedition route still needs to be acquired."]),
      ...(!matching.some(r => r.canonicalGeometryId)
        ? ["No current canonical geometry binding; approval is unavailable."] : []),
      "Source rights, access and any elevation profile require explicit validation before approval.",
    ];
    return {
      routeKey: head.route_key, routeName: head.route_name, region: head.region,
      stageUses: group.length, expeditionIds: [...new Set(group.map(s => s.challenge_id))].sort(),
      distanceKm: [...new Set(group.map(s => Number(s.distance_km)))].sort((a, b) => a - b),
      ascentM: [...new Set(group.map(s => Number(s.ascent_m)))].sort((a, b) => a - b),
      reviews: matching.map(({ routeKey: _key, ...r }) => r),
      sourceLeads: source?.sourceLeads ?? [], blockers,
    };
  }).sort((a, b) => b.stageUses - a.stageUses || a.routeName.localeCompare(b.routeName));
  return { environment: "development" as const, generatedAt: sources.generatedAt,
    summary: { expeditions: new Set(stages.map(s => s.challenge_id)).size, stages: stages.length, distinctRoutes: routes.length },
    routes };
}

export async function expeditionRouteQueue(client: PoolClient) {
  const stages = await client.query<Stage>(`SELECT challenge_id,route_key,route_name,region,distance_km,ascent_m
    FROM public.challenge_stages ORDER BY challenge_id,stage_order`);
  // Read only compact explicit metadata, not every revision's potentially large
  // manifest/geometry. Watkin predates expeditionRouteKey, so its exact known
  // pilot relation/key pair is handled explicitly, never through fuzzy names.
  const reviews = await client.query<Review>(`SELECT r.id, r.candidate_key AS "candidateKey",
    r.revision_version AS "revisionVersion",r.canonical_geometry_id AS "canonicalGeometryId",
    COALESCE(
      (SELECT s->>'expeditionRouteKey' FROM jsonb_array_elements(r.source_manifest) s
       WHERE s->>'expeditionRouteKey' IS NOT NULL LIMIT 1),
      CASE WHEN r.candidate_key='Snowdon via Watkin Path — pilot'
        AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.source_manifest) s
          WHERE COALESCE(s->>'relationId',s->'metadata'->>'relationId')='4004198')
        THEN 'watkin' END) AS "routeKey"
    FROM public.route_geometry_review_revisions r ORDER BY r.created_at DESC,r.id`);
  return buildExpeditionRouteQueue(stages.rows, reviews.rows);
}
