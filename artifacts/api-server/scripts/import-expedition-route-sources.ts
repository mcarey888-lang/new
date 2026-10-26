/**
 * Additive private development imports only. No engine/catalogue writes.
 * Default validates/previews without storage writes; --commit imports exact
 * source-only candidates, never acceptance/approval or expedition modification.
 */
import { pool } from "@workspace/db";
import { readFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { assertReviewDatabase, importReview, previewReview } from "../src/services/routeReviewAdmin.js";
import { sha256 } from "../src/services/routeReviewEvidence.js";

async function main() {
  const directory = resolve(process.argv.find(v => v.startsWith("--directory="))?.split("=").slice(1).join("=") ?? "../../generated-artifacts/expedition-route-batch/prepared");
  const commit = process.argv.includes("--commit");
  const results = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertReviewDatabase(client);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('development-expedition-route-source-batch'))");
    // Guard the protected scope against accidental changes by this operation.
    const protectedSnapshot = async () => (await client.query(`SELECT
      (SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY challenge_id,stage_order))
       FROM public.challenge_stages s) AS stages,
      (SELECT md5(string_agg(to_jsonb(c)::text,'' ORDER BY challenge_id))
       FROM public.signature_challenges c) AS expeditions,
      (SELECT count(*)::int FROM public.route_geometry_review_decisions) AS decisions`)).rows[0];
    const before = await protectedSnapshot();
    for (const file of (await readdir(directory)).filter(f => f.endsWith(".input.json")).sort()) {
      const input = JSON.parse(await readFile(resolve(directory, file), "utf8"));
      const routeKey = basename(file, ".input.json");
      // Very short search hits are not useful expedition source geometry.
      // This also prevents importing the 290m 'Braeriach Trail' as a 28km walk.
      if (routeKey === "braeriach") {
        results.push({ routeKey, status: "blocked", reason: "Source is only a short fragment, not the expedition approach." });
        continue;
      }
      if (input.canonicalGeometryId || input.profileFile || input.terrainManifestFile
        || input.sourceManifest?.[0]?.expeditionRouteKey !== routeKey
        || input.sourceManifest?.[0]?.fullExpeditionVariantConfirmed !== false) {
        throw new Error("Input is not an explicitly unbound source-only candidate.");
      }
      const exists = await client.query("SELECT id FROM public.route_geometry_review_revisions WHERE candidate_key=$1 AND revision_version=$2", [input.candidateKey, input.revisionVersion]);
      if (exists.rowCount) {
        results.push({ routeKey, status: "already_imported", id: exists.rows[0].id });
        continue;
      }
      const checked = await previewReview(client, input);
      if (!checked.valid) throw new Error(`${routeKey}: ${checked.errors.join("; ")}`);
      const bytes = await readFile(resolve(directory, `${routeKey}.source.json`));
      const digest = sha256(bytes);
      if (input.sourceManifest[0].sha256 !== digest) throw new Error("Source snapshot hash mismatch.");
      const imported = commit ? await importReview(client, input, undefined,
        [{ name: "source-snapshot", bytes, sha256: digest }]) : null;
      results.push({ routeKey, status: commit ? "imported_source_only" : "preview_only",
        id: imported?.id, points: checked.pointCount, approvalAvailable: false });
    }
    if (JSON.stringify(before) !== JSON.stringify(await protectedSnapshot())) {
      throw new Error("Protected expedition data or approval history changed; rolling back.");
    }
    await client.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ environment: "development", commit, protectedDataUnchanged: true, results }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed"); process.exitCode = 1; })
  .finally(() => pool.end());
