/**
 * Read-only development evidence audit. Does not acquire tracks, approve routes,
 * change expedition content, or expose private review files/owner identities.
 */
import { pool, executeEngineReadOnlyQuery } from "@workspace/db";
import { isConstructedRoute } from "../src/services/routeSourcePolicy";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='20s'");
    const inventory = await client.query(`SELECT
      count(*) AS expeditions,
      count(*) FILTER (WHERE approved AND image_status='approved') AS artwork_approved
      FROM public.signature_challenges`);
    const candidates = await client.query(`SELECT c.challenge_id,c.challenge_name,c.target_mountain_name,
      c.difficulty,c.total_ascent_m,c.total_distance_km,c.recommended_days,c.status,c.approved,c.image_status,
      json_agg(json_build_object('order',s.stage_order,'routeKey',s.route_key,'name',s.route_name,
        'region',s.region,'km',s.distance_km,'ascent',s.ascent_m,'difficulty',s.difficulty,
        'catalogue',s.catalogue_mountain) ORDER BY s.stage_order) AS stages,
      sum(s.distance_km) AS stage_distance_sum,sum(s.ascent_m) AS stage_ascent_sum
      FROM public.signature_challenges c JOIN public.challenge_stages s USING(challenge_id)
      WHERE c.challenge_id IN ('SIG047','SIG042','SIG031','SIG054')
      GROUP BY c.id ORDER BY c.total_ascent_m`);
    const reviews = await client.query(`SELECT r.candidate_key,r.revision_version,
      r.canonical_geometry_id, r.source_manifest,
      (SELECT outcome FROM public.route_geometry_map_reviews
        WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS map_feedback,
      (SELECT outcome FROM public.route_geometry_review_validations
        WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS validation,
      (SELECT decision FROM public.route_geometry_review_decisions
        WHERE review_revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS decision
      FROM public.route_geometry_review_revisions r ORDER BY r.created_at DESC,r.id`);
    const compact = reviews.rows.map(row => ({
      candidate: row.candidate_key, revision: row.revision_version,
      withdrawnConstructed: isConstructedRoute(row.source_manifest, row.revision_version, row.candidate_key),
      canonicalGeometry: row.canonical_geometry_id,
      routeKeys: [...new Set(row.source_manifest.flatMap((s: any) => s.expeditionRouteKey ? [s.expeditionRouteKey] : []))],
      sources: row.source_manifest.map((s: any) => ({
        name: s.name, url: s.url ?? s.sourceUrl, relation: s.relationId ?? s.metadata?.relationId,
        licence: s.licence ?? s.license, method: s.draftMethod,
      })),
      mapFeedback: row.map_feedback, validation: row.validation, decision: row.decision,
    }));
    const peaks = await executeEngineReadOnlyQuery(`SELECT m.id,m.name,m.country,m.region,m.status,
      m.elevation_m,ST_Y(m.geom) AS latitude,ST_X(m.geom) AS longitude,
      EXISTS(SELECT 1 FROM public.mountain_source_records s WHERE s.mountain_id=m.id
        AND s.source_dataset='Database of British and Irish Hills (DoBIH)'
        AND s.source_trust='trusted_source' AND s.final_verification_status='trusted_source'
        AND s.qa_status IN ('pass','info')) AS trusted_dobih
      FROM public.mountains m WHERE m.name ILIKE ANY($1::text[]) ORDER BY m.name,m.id`,
    [["%Mam Tor%", "Whernside%", "%Pen-y-ghent%", "Ingleborough%", "%Yr Wyddfa%", "Fairfield", "Scafell Pike"]]);
    const verifiedRoutes = await executeEngineReadOnlyQuery(`SELECT ri.mountain_id,ri.canonical_name,
      rf.distance_km,rf.total_ascent_m,e.publisher,e.url
      FROM public.route_identities ri
      JOIN public.route_definitions rd ON rd.route_identity_id=ri.id AND rd.version=ri.version
      JOIN public.route_facts rf ON rf.route_definition_id=rd.id AND rf.version=rd.version
      JOIN public.evidence_sources e ON e.id=rf.evidence_source_id
      WHERE ri.mountain_id=ANY($1::uuid[]) AND ri.status='verified'
        AND rd.status='verified' AND rf.status='verified'`,
    [peaks.map(p => p.id)]);
    console.log(JSON.stringify({
      environment: "development", ownerSelectedCandidate: "SIG054",
      inventory: inventory.rows[0], candidates: candidates.rows,
      structuralChecks: candidates.rows.map(c => ({
        id: c.challenge_id,
        contiguousStageOrder: c.stages.every((s: any, index: number) => s.order === index + 1),
        daysMatchStages: c.recommended_days === c.stages.length,
        totalsMatch: Number(c.stage_distance_sum) === c.total_distance_km &&
          Number(c.stage_ascent_sum) === c.total_ascent_m,
        positiveStageFigures: c.stages.every((s: any) => s.km > 0 && s.ascent > 0),
      })),
      cataloguePeaks: peaks, verifiedRouteFacts: verifiedRoutes, reviewCount: compact.length,
      retainedReviews: compact.filter(r => !r.withdrawnConstructed),
      candidateReviews: compact.filter(r => r.routeKeys.some(k =>
        ["great_ridge", "whernside", "pen_y_ghent", "ingleborough", "llanberis", "fairfield", "scafell_corridor"].includes(String(k)))),
    }, null, 2));
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
