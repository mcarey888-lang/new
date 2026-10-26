import { randomUUID } from "node:crypto";
import type { PoolClient } from "@workspace/db";
import { z } from "zod";
import { ReviewError, importReview } from "./routeReviewAdmin.js";
import type { ReviewFileStore } from "./routeReviewStorage.js";
import { isConstructedRoute, constructedSourceMessage } from "./routeSourcePolicy.js";

export const routeEditInput = z.object({
  coordinates: z.array(z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
  ])).min(2).max(20000),
  note: z.string().trim().max(2000).optional().default(""),
  expectedLatestRevisionId: z.string().uuid(),
}).strict();

/** Save a new unbound revision; never overwrite source evidence or carry approval. */
export async function editReview(client: PoolClient, id: string, raw: unknown, store?: ReviewFileStore) {
  const input = routeEditInput.parse(raw);
  const { rows: [parent] } = await client.query(`SELECT id,candidate_key,geometry_sha256,
    source_manifest,source_manifest_sha256,revision_version
    FROM public.route_geometry_review_revisions WHERE id=$1`, [id]);
  if (!parent) throw new ReviewError(404, "Review candidate not found.");
  if (isConstructedRoute(parent.source_manifest, parent.revision_version, parent.candidate_key))
    throw new ReviewError(422, constructedSourceMessage);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`route-edit:${parent.candidate_key}`]);
  const { rows: [latest] } = await client.query(`SELECT id
    FROM public.route_geometry_review_revisions WHERE candidate_key=$1
    ORDER BY created_at DESC,id DESC LIMIT 1`, [parent.candidate_key]);
  if (latest.id !== input.expectedLatestRevisionId || latest.id !== id) {
    throw new ReviewError(409, "Stale draft: another revision exists. Open the latest draft before editing; nothing was overwritten.");
  }
  const routeKey = parent.source_manifest.find((s: Record<string, unknown>) => typeof s.expeditionRouteKey === "string")?.expeditionRouteKey;
  return importReview(client, {
    candidateKey: parent.candidate_key,
    revisionVersion: `owner-edit-${randomUUID()}`,
    geometryFile: JSON.stringify({ type: "LineString", coordinates: input.coordinates }),
    sourceManifest: [
      {
        name: "Owner-edited route draft", provider: "SummitReady owner route editor",
        ...(routeKey ? { expeditionRouteKey: routeKey } : {}),
        fullExpeditionVariantConfirmed: false, rightsReviewComplete: false,
        routeAccessReviewed: false,
        parentReviewRevisionId: id, parentRevisionVersion: parent.revision_version,
        parentGeometrySha256: parent.geometry_sha256,
        parentSourceManifestSha256: parent.source_manifest_sha256,
        sourceCapturedAt: new Date().toISOString(),
        note: input.note,
        routingProviderNotice: {
          provider: "Edited sections may use the app's openrouteservice hiking engine or be manually drawn.",
          licence: "Provider-derived edits require CC-BY-SA-4.0 review, in addition to original source obligations.",
          attribution: "© openrouteservice by HeiGIT | Data from OpenStreetMap · CC BY-SA 4.0",
          url: "https://account.heigit.org/info/tos",
        },
        scope: "Owner edited geometry. Original sources retained below for lineage only, not proof for newly drawn or routed sections. Previous map feedback, canonical binding, elevation and technical approvals do not transfer.",
      },
      ...parent.source_manifest,
    ],
  }, store);
}
