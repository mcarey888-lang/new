/**
 * Signature Challenge Import Script
 * ----------------------------------
 * Reads the curated Signature Expedition Library (xlsx) and upserts all
 * records into the DB.  Idempotent — safe to re-run; uses challenge_id as
 * the upsert key.
 *
 * Run:
 *   cd artifacts/api-server
 *   npx tsx src/scripts/import-signature-challenges.ts [--dry-run]
 */
import * as path from "path";
import { readFileSync } from "fs";
import { db } from "@workspace/db";
import {
  signatureChallenges,
  challengeStages,
  challengeLimitations,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ── xlsx parsing ─────────────────────────────────────────────────────────────
// We ship xlsx as a workspace dependency; import dynamically so the script can
// be used from the API server package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

const XLSX_PATH = path.resolve(
  __dirname,
  "../../../../attached_assets/summit_ready_signature_expeditions_v1-1_1785507369868.xlsx"
);

// ── slug helper ───────────────────────────────────────────────────────────────
function toMountainSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõöø]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Signature Challenge Import  ${dryRun ? "[DRY RUN]" : "[LIVE]"}`);
  console.log("=".repeat(60));

  const wb = XLSX.readFile(XLSX_PATH);
  const rawChallenges: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
    wb.Sheets["Challenges"],
    { defval: null }
  );
  const rawStages: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
    wb.Sheets["Challenge_Stages"],
    { defval: null }
  );

  console.log(`\nParsed: ${rawChallenges.length} challenges, ${rawStages.length} stages`);

  // Group stages by challenge_id
  const stagesMap: Record<string, typeof rawStages> = {};
  for (const s of rawStages) {
    const cid = s.challenge_id as string;
    if (!stagesMap[cid]) stagesMap[cid] = [];
    stagesMap[cid].push(s);
  }

  let upsertedChallenges = 0;
  let upsertedStages = 0;
  let upsertedLimitations = 0;

  for (const c of rawChallenges) {
    const challengeId = c.challenge_id as string;
    const mountainSlug = toMountainSlug(c.target_mountain as string);
    const limitations: string[] = c.limitations
      ? (c.limitations as string).split(" | ").filter(Boolean)
      : [];

    const challengeRecord = {
      challengeId,
      challengeName:      c.challenge_name as string,
      targetMountainName: c.target_mountain as string,
      mountainSlug,
      targetRoute:        (c.target_route as string) ?? null,
      recommendedDays:    (c.recommended_days as number) ?? 2,
      dnaMatchScore:      (c.dna_match_score as number) ?? null,
      adventureScore:     (c.adventure_score as number) ?? null,
      totalAscentM:       (c.total_ascent_m as number) ?? null,
      totalDistanceKm:    (c.total_distance_km as number) ?? null,
      estimatedHours:     (c.estimated_hours as number) ?? null,
      difficulty:         (c.difficulty as string) ?? null,
      routeDnaFocus:      (c.route_dna_focus as string) ?? null,
      summary:            (c.summary as string) ?? null,
      regions:            (c.regions as string) ?? null,
      featured:           c.is_featured === true || c.is_featured === 1,
      dataConfidence:     (c.data_confidence as string) ?? "Curated",
      status:             "active" as const,
      updatedAt:          new Date(),
    };

    if (dryRun) {
      console.log(`  [DRY] Would upsert ${challengeId}: ${c.challenge_name} → ${mountainSlug}`);
    } else {
      await db
        .insert(signatureChallenges)
        .values(challengeRecord)
        .onConflictDoUpdate({
          target: signatureChallenges.challengeId,
          set: {
            challengeName:      challengeRecord.challengeName,
            targetMountainName: challengeRecord.targetMountainName,
            mountainSlug:       challengeRecord.mountainSlug,
            targetRoute:        challengeRecord.targetRoute,
            recommendedDays:    challengeRecord.recommendedDays,
            dnaMatchScore:      challengeRecord.dnaMatchScore,
            adventureScore:     challengeRecord.adventureScore,
            totalAscentM:       challengeRecord.totalAscentM,
            totalDistanceKm:    challengeRecord.totalDistanceKm,
            estimatedHours:     challengeRecord.estimatedHours,
            difficulty:         challengeRecord.difficulty,
            routeDnaFocus:      challengeRecord.routeDnaFocus,
            summary:            challengeRecord.summary,
            regions:            challengeRecord.regions,
            featured:           challengeRecord.featured,
            dataConfidence:     challengeRecord.dataConfidence,
            status:             challengeRecord.status,
            updatedAt:          challengeRecord.updatedAt,
          },
        });
      upsertedChallenges++;

      // Delete old stages + limitations and re-insert (cleanest upsert for child rows)
      await db.delete(challengeStages).where(eq(challengeStages.challengeId, challengeId));
      await db.delete(challengeLimitations).where(eq(challengeLimitations.challengeId, challengeId));

      const stages = (stagesMap[challengeId] ?? []).sort(
        (a, b) => (a.day_order as number) - (b.day_order as number)
      );
      if (stages.length > 0) {
        await db.insert(challengeStages).values(
          stages.map((s) => ({
            challengeId,
            stageOrder:     s.day_order as number,
            routeKey:       (s.route_key as string) ?? null,
            routeName:      s.route_name as string,
            region:         (s.region as string) ?? null,
            distanceKm:     (s.distance_km as number) ?? null,
            ascentM:        (s.ascent_m as number) ?? null,
            estimatedHours: (s.estimated_hours as number) ?? null,
            difficulty:     (s.difficulty as string) ?? null,
            dnaContribution: (s.dna_contribution as string) ?? null,
            whySelected:    (s.why_selected as string) ?? null,
          }))
        );
        upsertedStages += stages.length;
      }

      if (limitations.length > 0) {
        await db.insert(challengeLimitations).values(
          limitations.map((lim) => ({ challengeId, limitation: lim }))
        );
        upsertedLimitations += limitations.length;
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (dryRun) {
    console.log("Dry run complete — no DB changes made.");
    console.log(`Would import: ${rawChallenges.length} challenges, ${rawStages.length} stages`);
  } else {
    console.log("Import complete:");
    console.log(`  Challenges upserted : ${upsertedChallenges}`);
    console.log(`  Stages inserted     : ${upsertedStages}`);
    console.log(`  Limitations inserted: ${upsertedLimitations}`);
  }
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
