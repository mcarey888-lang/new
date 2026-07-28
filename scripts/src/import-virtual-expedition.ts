/**
 * Virtual Expedition Engine — Import Script
 *
 * Reads summit_ready_route_intelligence_database_v1.xlsx and upserts all data
 * into the seven VX engine tables.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run import:virtual:dry   # dry-run, no DB writes
 *   pnpm --filter @workspace/scripts run import:virtual       # real import
 *
 * Re-running is always safe — all upserts are keyed by stable spreadsheet IDs (M0xx, GR0xx, UK0xx).
 */

import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import {
  virtualExpeditions,
  expeditionRoutes,
  trainingRoutes,
  routeDna,
  matchWeights,
  routeMatches,
  importReviewItems,
} from "@workspace/db/schema";
import type {
  InsertVirtualExpedition,
  InsertExpeditionRoute,
  InsertTrainingRoute,
  InsertRouteDna,
  InsertMatchWeight,
  InsertRouteMatch,
  InsertImportReviewItem,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateDna,
  upsertExpeditionDna,
  upsertTrainingDna,
} from "../../artifacts/api-server/src/services/routeDna.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_PATH = path.resolve(
  __dirname,
  "../../../attached_assets/summit_ready_route_intelligence_database_v1.xlsx",
);

const DRY_RUN = process.argv.includes("--dry-run");

// Expected sheet names
const SHEET_MOUNTAINS     = "Mountains";
const SHEET_GLOBAL_ROUTES = "Global_Routes";
const SHEET_UK_ROUTES     = "UK_Routes";
const SHEET_MATCH_WEIGHTS = "Match_Weights";
const SHEET_MATCHES       = "Suggested_Matches";

// Mountains that have a known stable slug (prevents review queue noise)
const KNOWN_MOUNTAIN_SLUGS: Record<string, string> = {
  "Mount Everest":     "mount-everest",
  "Everest":           "mount-everest",
  "Mont Blanc":        "mont-blanc",
  "Kilimanjaro":       "kilimanjaro",
  "Mount Kilimanjaro": "kilimanjaro",
  "Matterhorn":        "matterhorn",
  "Aconcagua":         "aconcagua",
  "Denali":            "denali",
  "Mount McKinley":    "denali",
  "Elbrus":            "elbrus",
  "Mount Elbrus":      "elbrus",
  "Ben Nevis":         "ben-nevis",
  "Mount Fuji":        "mount-fuji",
  "Fuji":              "mount-fuji",
  "Snowdon":           "snowdon",
  "Yr Wyddfa":         "snowdon",
  "Scafell Pike":      "scafell-pike",
  "Helvellyn":         "helvellyn",
  "Gran Paradiso":     "gran-paradiso",
  "Monte Rosa":        "monte-rosa",
  "Eiger":             "eiger",
  "Jungfrau":          "jungfrau",
  "Grossglockner":     "grossglockner",
  "Piz Bernina":       "piz-bernina",
  "Toubkal":           "toubkal",
  "Mount Kenya":       "mount-kenya",
  "Rwenzori":          "rwenzori",
  "Margherita Peak":   "rwenzori",
  "Mount Rainier":     "mount-rainier",
  "Mount Whitney":     "mount-whitney",
  "Pico de Orizaba":   "pico-de-orizaba",
  "Orizaba":           "pico-de-orizaba",
  "Iztaccíhuatl":      "iztaccihuatl",
  "Iztaccihuatl":      "iztaccihuatl",
  "Mount Logan":       "mount-logan",
  "Huascarán":         "huascaran",
  "Huascaran":         "huascaran",
  "Chimborazo":        "chimborazo",
  "Cotopaxi":          "cotopaxi",
  "Puncak Jaya":       "puncak-jaya",
  "Carstensz Pyramid": "puncak-jaya",
  "Vinson Massif":     "vinson-massif",
  "Mount Vinson":      "vinson-massif",
  "Kosciuszko":        "mount-kosciuszko",
  "Mount Kosciuszko":  "mount-kosciuszko",
  "Kebnekaise":        "kebnekaise",
  "Galdhøpiggen":      "galdhopiggen",
  "Galdhopiggen":      "galdhopiggen",
  "Mulhacén":          "mulhacen",
  "Mulhacen":          "mulhacen",
  "Olympus":           "mount-olympus",
  "Mount Olympus":     "mount-olympus",
  "Lobuche East":      "lobuche-east",
  "Island Peak":       "island-peak",
  "Mera Peak":         "mera-peak",
  "Thorong La":        "thorong-la",
};

// ── Slug function (mirrors mountain.ts) ───────────────────────────────────────

function mountainSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Logging helpers ───────────────────────────────────────────────────────────

let errors   = 0;
let warnings = 0;
let info     = 0;

function log(level: "INFO" | "WARN" | "ERROR", msg: string) {
  const prefix = { INFO: "  ✓", WARN: "  ⚠", ERROR: "  ✗" }[level];
  console.log(`${prefix} ${msg}`);
  if (level === "ERROR")   errors++;
  if (level === "WARN")    warnings++;
  if (level === "INFO")    info++;
}

// ── Row accessors ─────────────────────────────────────────────────────────────

function str(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  return v != null && v !== "" ? String(v).trim() : null;
}

function num(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function int15(row: Record<string, unknown>, key: string): number | null {
  const v = num(row, key);
  if (v == null) return null;
  if (v < 1 || v > 5) return null;
  return Math.round(v);
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  criticalErrors: string[];
}

function validateSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  requiredColumns: string[],
): ValidationResult {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { ok: false, criticalErrors: [`Sheet "${sheetName}" not found in workbook`] };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  if (rows.length === 0) {
    return { ok: false, criticalErrors: [`Sheet "${sheetName}" is empty`] };
  }

  const headers = Object.keys(rows[0] ?? {});
  const missing = requiredColumns.filter((c) => !headers.includes(c));

  if (missing.length > 0) {
    return {
      ok: false,
      criticalErrors: [`Sheet "${sheetName}" missing columns: ${missing.join(", ")}`],
    };
  }

  return { ok: true, criticalErrors: [] };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Virtual Expedition Engine — Import Script");
  console.log(DRY_RUN ? "  MODE: DRY RUN (no database writes)" : "  MODE: REAL IMPORT");
  console.log("══════════════════════════════════════════════════════\n");

  // ── Check spreadsheet exists ──────────────────────────────────────────────
  if (!existsSync(SPREADSHEET_PATH)) {
    console.error(`\n✗ Spreadsheet not found at: ${SPREADSHEET_PATH}`);
    console.error("  Please upload summit_ready_route_intelligence_database_v1.xlsx");
    console.error("  to the attached_assets/ folder and re-run this script.\n");
    process.exit(1);
  }

  console.log(`Loading spreadsheet: ${path.basename(SPREADSHEET_PATH)}\n`);
  const wb = XLSX.readFile(SPREADSHEET_PATH);

  // ── Validate all required sheets & columns ────────────────────────────────
  console.log("Phase 1 — Validation");

  const requiredSheets: [string, string[]][] = [
    [SHEET_MOUNTAINS, [
      "mountain_id", "name", "country_region", "continent", "summit_altitude_m",
      "category", "primary_goal", "altitude_risk", "max_technicality",
    ]],
    [SHEET_GLOBAL_ROUTES, [
      "route_id", "mountain_id", "route_name", "distance_km", "ascent_m",
      "typical_days", "exposure_1_5", "navigation_1_5", "endurance_1_5",
      "load_carry_1_5", "technicality_1_5", "altitude_1_5", "data_confidence",
    ]],
    [SHEET_UK_ROUTES, [
      "route_id", "region", "mountain_hill", "route_name", "distance_km",
      "ascent_m", "typical_hours", "exposure_1_5", "navigation_1_5",
      "endurance_1_5", "load_carry_1_5", "technicality_1_5", "data_confidence",
    ]],
    [SHEET_MATCH_WEIGHTS, ["metric", "weight"]],
  ];

  const criticalErrors: string[] = [];
  for (const [sheet, cols] of requiredSheets) {
    const { ok, criticalErrors: errs } = validateSheet(wb, sheet, cols);
    if (!ok) {
      criticalErrors.push(...errs);
      log("ERROR", errs.join("; "));
    } else {
      log("INFO", `${sheet}: columns OK`);
    }
  }

  if (criticalErrors.length > 0) {
    console.log("\n✗ Critical validation errors — aborting import.\n");
    process.exit(1);
  }

  // ── Parse all sheets ──────────────────────────────────────────────────────
  const mountainRows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET_MOUNTAINS]!,     { defval: null });
  const globalRouteRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET_GLOBAL_ROUTES]!, { defval: null });
  const ukRouteRows   = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET_UK_ROUTES]!,    { defval: null });
  const weightRows    = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET_MATCH_WEIGHTS]!, { defval: null });
  const matchRows     = wb.Sheets[SHEET_MATCHES]
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET_MATCHES]!, { defval: null })
    : [];

  console.log(`\n  Mountains:     ${mountainRows.length}`);
  console.log(`  Global routes: ${globalRouteRows.length}`);
  console.log(`  UK routes:     ${ukRouteRows.length}`);
  console.log(`  Weights:       ${weightRows.length}`);
  console.log(`  Seed matches:  ${matchRows.length}`);

  // Validate weights sum
  const weightSum = weightRows.reduce((s, r) => s + (num(r, "weight") ?? 0), 0);
  if (Math.abs(weightSum - 1.0) > 0.05) {
    log("WARN", `Match weights sum to ${weightSum.toFixed(3)} (expected ~1.0)`);
  } else {
    log("INFO", `Match weights sum: ${weightSum.toFixed(3)} ✓`);
  }

  // Build mountain_id → name lookup
  const mountainIdToName = new Map<string, string>();
  for (const row of mountainRows) {
    const id   = str(row, "mountain_id");
    const name = str(row, "name");
    if (id && name) mountainIdToName.set(id, name);
  }

  // Validate cross-references
  for (const row of globalRouteRows) {
    const mid = str(row, "mountain_id");
    if (mid && !mountainIdToName.has(mid)) {
      log("WARN", `Global route ${str(row, "route_id")} references unknown mountain_id: ${mid}`);
    }
  }

  console.log("\n  Validation complete.\n");

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would import:");
    console.log(`    - ${mountainRows.length} mountains → virtual_expeditions`);
    console.log(`    - ${globalRouteRows.length} routes → expedition_routes`);
    console.log(`    - ${ukRouteRows.length} routes → training_routes`);
    console.log(`    - ${weightRows.length} weights → match_weights`);
    console.log(`    - ${mountainRows.length + globalRouteRows.length + ukRouteRows.length} DNA calculations → route_dna`);
    console.log(`    - ${matchRows.length} seed matches → route_matches`);
    console.log("\n  Dry run complete. No database changes made.\n");
    return;
  }

  // ── Phase 2: Mountains → virtual_expeditions ──────────────────────────────
  console.log("Phase 2 — Mountains");

  let mountainsLinked   = 0;
  let mountainsQueued   = 0;
  let mountainsSkipped  = 0;

  // Maps spreadsheet mountain_id → DB virtual_expedition id
  const mountainIdToVxId = new Map<string, number>();

  for (const row of mountainRows) {
    const spreadsheetMountainId = str(row, "mountain_id");
    const name = str(row, "name");

    if (!spreadsheetMountainId || !name) {
      log("WARN", `Mountain row missing id or name — skipping`);
      continue;
    }

    // Check if already imported
    const [existing] = await db
      .select({ id: virtualExpeditions.id })
      .from(virtualExpeditions)
      .where(eq(virtualExpeditions.spreadsheetMountainId, spreadsheetMountainId))
      .limit(1);

    if (existing) {
      mountainIdToVxId.set(spreadsheetMountainId, existing.id);
      mountainsSkipped++;
      continue;
    }

    // Determine slug
    let slug: string;
    if (KNOWN_MOUNTAIN_SLUGS[name]) {
      slug = KNOWN_MOUNTAIN_SLUGS[name]!;
    } else {
      slug = mountainSlug(name);
      // Check if slug conflicts with a different mountain
      const [conflict] = await db
        .select({ spreadsheetMountainId: virtualExpeditions.spreadsheetMountainId })
        .from(virtualExpeditions)
        .where(eq(virtualExpeditions.mountainSlug, slug))
        .limit(1);

      if (conflict && conflict.spreadsheetMountainId !== spreadsheetMountainId) {
        // Slug already taken by a different mountain — review queue
        const reviewRow: InsertImportReviewItem = {
          importType:    "mountain",
          sourceId:      spreadsheetMountainId,
          sourceName:    name,
          proposedMatchId: slug,
          issue:         `Slug "${slug}" already used by mountain ${conflict.spreadsheetMountainId}. Manual resolution required.`,
          rawSourceData: row as Record<string, unknown>,
          status:        "pending",
        };
        await db.insert(importReviewItems).values(reviewRow);
        log("WARN", `${spreadsheetMountainId} "${name}" → review queue (slug conflict: ${slug})`);
        mountainsQueued++;
        continue;
      }
    }

    const insert: InsertVirtualExpedition = {
      mountainSlug:          slug,
      spreadsheetMountainId,
      name,
      countryRegion:         str(row, "country_region"),
      continent:             str(row, "continent"),
      summitAltitudeM:       num(row, "summit_altitude_m") ? Math.round(num(row, "summit_altitude_m")!) : null,
      category:              str(row, "category"),
      primaryGoal:           str(row, "primary_goal"),
      altitudeRisk:          int15(row, "altitude_risk"),
      maxTechnicality:       int15(row, "max_technicality"),
      heroImageUrl:          str(row, "hero_image_url"),
      shortDescription:      str(row, "short_description"),
      status:                "active",
      featured:              false,
      estimatedTrainingWeeks: num(row, "estimated_training_weeks") ? Math.round(num(row, "estimated_training_weeks")!) : null,
      sourceUrl:             str(row, "source_url"),
    };

    const [inserted] = await db
      .insert(virtualExpeditions)
      .values(insert)
      .onConflictDoUpdate({
        target: virtualExpeditions.spreadsheetMountainId,
        set: { ...insert, updatedAt: new Date() },
      })
      .returning({ id: virtualExpeditions.id });

    mountainIdToVxId.set(spreadsheetMountainId, inserted!.id);
    log("INFO", `${spreadsheetMountainId} "${name}" → slug: ${slug}`);
    mountainsLinked++;
  }

  console.log(`\n  Mountains: ${mountainsLinked} imported, ${mountainsSkipped} already existed, ${mountainsQueued} in review queue\n`);

  // ── Phase 3: Expedition routes ────────────────────────────────────────────
  console.log("Phase 3 — Expedition routes");

  let expRoutesImported = 0;
  let expRoutesSkipped  = 0;

  // Maps spreadsheet route_id → DB expedition_route id
  const grIdToExpRouteId = new Map<string, number>();

  for (const row of globalRouteRows) {
    const spreadsheetRouteId = str(row, "route_id");
    const mountainId         = str(row, "mountain_id");
    const routeName          = str(row, "route_name");

    if (!spreadsheetRouteId || !mountainId || !routeName) {
      log("WARN", `Global route row missing id/mountain_id/name — skipping`);
      continue;
    }

    const vxId = mountainIdToVxId.get(mountainId);
    if (!vxId) {
      log("WARN", `Route ${spreadsheetRouteId}: mountain ${mountainId} not imported — skipping route`);
      continue;
    }

    const confidence = str(row, "data_confidence") ?? "Estimated";
    const safeConfidence = ["Estimated", "Verified", "GPX_Verified"].includes(confidence)
      ? (confidence as "Estimated" | "Verified" | "GPX_Verified")
      : "Estimated";

    const insert: InsertExpeditionRoute = {
      virtualExpeditionId:     vxId,
      spreadsheetRouteId,
      routeName,
      startPoint:              str(row, "start_point"),
      finishPoint:             str(row, "finish_point"),
      distanceKm:              num(row, "distance_km"),
      ascentM:                 num(row, "ascent_m"),
      descentM:                num(row, "descent_m"),
      typicalDays:             num(row, "typical_days"),
      longestContinuousClimbM: num(row, "longest_continuous_climb_m"),
      avgGradientPct:          num(row, "avg_gradient_pct"),
      maxGradientPct:          num(row, "max_gradient_pct"),
      trailPct:                num(row, "trail_pct"),
      rockPct:                 num(row, "rock_pct"),
      screePct:                num(row, "scree_pct"),
      snowIcePct:              num(row, "snow_ice_pct"),
      glacierPct:              num(row, "glacier_pct"),
      scramblingPct:           num(row, "scrambling_pct"),
      viaFerrataPct:           num(row, "via_ferrata_pct"),
      exposure15:              int15(row, "exposure_1_5"),
      navigation15:            int15(row, "navigation_1_5"),
      endurance15:             int15(row, "endurance_1_5"),
      loadCarry15:             int15(row, "load_carry_1_5"),
      technicality15:          int15(row, "technicality_1_5"),
      altitude15:              int15(row, "altitude_1_5"),
      bestSeason:              str(row, "best_season"),
      popularity:              str(row, "popularity"),
      sourceUrl:               str(row, "source_url"),
      dataConfidence:          safeConfidence,
      active:                  true,
    };

    const [inserted] = await db
      .insert(expeditionRoutes)
      .values(insert)
      .onConflictDoUpdate({
        target: expeditionRoutes.spreadsheetRouteId,
        set:    { ...insert, updatedAt: new Date() },
      })
      .returning({ id: expeditionRoutes.id });

    grIdToExpRouteId.set(spreadsheetRouteId, inserted!.id);
    expRoutesImported++;
  }

  console.log(`  Expedition routes: ${expRoutesImported} upserted\n`);

  // ── Phase 4: Training routes ──────────────────────────────────────────────
  console.log("Phase 4 — UK training routes");

  let trainRoutesImported = 0;
  const ukIdToTrainRouteId = new Map<string, number>();

  for (const row of ukRouteRows) {
    const spreadsheetRouteId = str(row, "route_id");
    const region             = str(row, "region");
    const mountainHill       = str(row, "mountain_hill");
    const routeName          = str(row, "route_name");

    if (!spreadsheetRouteId || !region || !mountainHill || !routeName) {
      log("WARN", `UK route row missing required fields — skipping`);
      continue;
    }

    const confidence = str(row, "data_confidence") ?? "Estimated";
    const safeConfidence = ["Estimated", "Verified", "GPX_Verified"].includes(confidence)
      ? (confidence as "Estimated" | "Verified" | "GPX_Verified")
      : "Estimated";

    const insert: InsertTrainingRoute = {
      spreadsheetRouteId,
      region,
      mountainHill,
      routeName,
      distanceKm:              num(row, "distance_km"),
      ascentM:                 num(row, "ascent_m"),
      descentM:                num(row, "descent_m"),
      typicalHours:            num(row, "typical_hours"),
      longestContinuousClimbM: num(row, "longest_continuous_climb_m"),
      avgGradientPct:          num(row, "avg_gradient_pct"),
      maxGradientPct:          num(row, "max_gradient_pct"),
      trailPct:                num(row, "trail_pct"),
      rockPct:                 num(row, "rock_pct"),
      screePct:                num(row, "scree_pct"),
      snowIcePct:              num(row, "snow_ice_pct"),
      scramblingPct:           num(row, "scrambling_pct"),
      viaFerrataPct:           num(row, "via_ferrata_pct"),
      exposure15:              int15(row, "exposure_1_5"),
      navigation15:            int15(row, "navigation_1_5"),
      endurance15:             int15(row, "endurance_1_5"),
      loadCarry15:             int15(row, "load_carry_1_5"),
      technicality15:          int15(row, "technicality_1_5"),
      bestSeason:              str(row, "best_season"),
      routeType:               str(row, "route_type"),
      popularity:              str(row, "popularity"),
      sourceUrl:               str(row, "source_url"),
      dataConfidence:          safeConfidence,
      latitude:                num(row, "latitude"),
      longitude:               num(row, "longitude"),
      gpxUrl:                  str(row, "gpx_url"),
      verified:                false,
      active:                  true,
    };

    const [inserted] = await db
      .insert(trainingRoutes)
      .values(insert)
      .onConflictDoUpdate({
        target: trainingRoutes.spreadsheetRouteId,
        set:    { ...insert, updatedAt: new Date() },
      })
      .returning({ id: trainingRoutes.id });

    ukIdToTrainRouteId.set(spreadsheetRouteId, inserted!.id);
    trainRoutesImported++;
  }

  console.log(`  Training routes: ${trainRoutesImported} upserted\n`);

  // ── Phase 5: Match weights ────────────────────────────────────────────────
  console.log("Phase 5 — Match weights");

  const importedMetrics = new Set<string>();
  let weightsImported = 0;

  for (const row of weightRows) {
    const metric = str(row, "metric");
    const weight = num(row, "weight");
    if (!metric || weight == null) continue;

    const insert: InsertMatchWeight = {
      metric,
      weight,
      description: str(row, "description"),
      version: 1,
      active: true,
    };

    await db
      .insert(matchWeights)
      .values(insert)
      .onConflictDoUpdate({
        target: [matchWeights.metric],  // partial index handles version
        set:    { weight, description: insert.description, active: true },
      });

    importedMetrics.add(metric);
    weightsImported++;
  }

  console.log(`  Weights: ${weightsImported} upserted\n`);

  // ── Phase 6: DNA calculation ──────────────────────────────────────────────
  console.log("Phase 6 — Route DNA calculation");

  let dnaExpCalc   = 0;
  let dnaTrainCalc = 0;

  // Expedition routes DNA
  for (const row of globalRouteRows) {
    const spreadsheetRouteId = str(row, "route_id");
    if (!spreadsheetRouteId) continue;

    const dbId = grIdToExpRouteId.get(spreadsheetRouteId);
    if (!dbId) continue;

    const metrics = {
      ascentM:                 num(row, "ascent_m"),
      descentM:                num(row, "descent_m"),
      distanceKm:              num(row, "distance_km"),
      typicalDays:             num(row, "typical_days"),
      longestContinuousClimbM: num(row, "longest_continuous_climb_m"),
      avgGradientPct:          num(row, "avg_gradient_pct"),
      maxGradientPct:          num(row, "max_gradient_pct"),
      trailPct:                num(row, "trail_pct"),
      rockPct:                 num(row, "rock_pct"),
      screePct:                num(row, "scree_pct"),
      snowIcePct:              num(row, "snow_ice_pct"),
      glacierPct:              num(row, "glacier_pct"),
      scramblingPct:           num(row, "scrambling_pct"),
      viaFerrataPct:           num(row, "via_ferrata_pct"),
      exposure15:              int15(row, "exposure_1_5"),
      navigation15:            int15(row, "navigation_1_5"),
      endurance15:             int15(row, "endurance_1_5"),
      loadCarry15:             int15(row, "load_carry_1_5"),
      technicality15:          int15(row, "technicality_1_5"),
      altitude15:              int15(row, "altitude_1_5"),
    };

    const scores = calculateDna(metrics, "expedition");
    await upsertExpeditionDna(dbId, scores);
    dnaExpCalc++;
  }

  // Training routes DNA
  for (const row of ukRouteRows) {
    const spreadsheetRouteId = str(row, "route_id");
    if (!spreadsheetRouteId) continue;

    const dbId = ukIdToTrainRouteId.get(spreadsheetRouteId);
    if (!dbId) continue;

    const metrics = {
      ascentM:                 num(row, "ascent_m"),
      descentM:                num(row, "descent_m"),
      distanceKm:              num(row, "distance_km"),
      typicalHours:            num(row, "typical_hours"),
      longestContinuousClimbM: num(row, "longest_continuous_climb_m"),
      avgGradientPct:          num(row, "avg_gradient_pct"),
      maxGradientPct:          num(row, "max_gradient_pct"),
      trailPct:                num(row, "trail_pct"),
      rockPct:                 num(row, "rock_pct"),
      screePct:                num(row, "scree_pct"),
      snowIcePct:              num(row, "snow_ice_pct"),
      scramblingPct:           num(row, "scrambling_pct"),
      viaFerrataPct:           num(row, "via_ferrata_pct"),
      exposure15:              int15(row, "exposure_1_5"),
      navigation15:            int15(row, "navigation_1_5"),
      endurance15:             int15(row, "endurance_1_5"),
      loadCarry15:             int15(row, "load_carry_1_5"),
      technicality15:          int15(row, "technicality_1_5"),
    };

    const scores = calculateDna(metrics, "training");
    await upsertTrainingDna(dbId, scores);
    dnaTrainCalc++;
  }

  console.log(`  DNA: ${dnaExpCalc} expedition + ${dnaTrainCalc} training = ${dnaExpCalc + dnaTrainCalc} total\n`);

  // ── Phase 7: Seed matches ─────────────────────────────────────────────────
  console.log("Phase 7 — Seed matches");

  let seedMatchesImported = 0;

  for (const row of matchRows) {
    const grId = str(row, "route_id") ?? str(row, "expedition_route_id");
    const ukId = str(row, "uk_route_id") ?? str(row, "training_route_id");
    if (!grId || !ukId) continue;

    const expRouteDbId   = grIdToExpRouteId.get(grId);
    const trainRouteDbId = ukIdToTrainRouteId.get(ukId);

    if (!expRouteDbId || !trainRouteDbId) continue;

    // Build warnings based on expedition route data
    const [expRoute] = await db
      .select()
      .from(expeditionRoutes)
      .where(eq(expeditionRoutes.id, expRouteDbId))
      .limit(1);

    const warnings: string[] = [];
    if (expRoute) {
      if ((expRoute.altitude15 ?? 0) >= 3)
        warnings.push("Does not reproduce altitude acclimatisation");
      if ((expRoute.glacierPct ?? 0) > 0)
        warnings.push("Does not reproduce glacier travel");
      if ((expRoute.snowIcePct ?? 0) > 10)
        warnings.push("Does not reproduce sustained snow/ice conditions");
    }

    const spreadsheetScore  = num(row, "match_score") ?? num(row, "score");
    const spreadsheetReason = str(row, "match_reason") ?? str(row, "reason");

    const insert: InsertRouteMatch = {
      expeditionRouteId:     expRouteDbId,
      trainingRouteId:       trainRouteDbId,
      score:                 spreadsheetScore ?? 0,
      matchReasons:          spreadsheetReason ? [spreadsheetReason] : [],
      warnings,
      spreadsheetMatchScore:  spreadsheetScore,
      spreadsheetMatchReason: spreadsheetReason,
      algorithmVersion:      1,
      calculatedAt:          new Date(),
    };

    await db
      .insert(routeMatches)
      .values(insert)
      .onConflictDoUpdate({
        target: [
          routeMatches.expeditionRouteId,
          routeMatches.trainingRouteId,
          routeMatches.algorithmVersion,
        ],
        set: {
          score:                 insert.score,
          warnings,
          spreadsheetMatchScore:  insert.spreadsheetMatchScore,
          spreadsheetMatchReason: insert.spreadsheetMatchReason,
          calculatedAt:          new Date(),
        },
      });

    seedMatchesImported++;
  }

  console.log(`  Seed matches: ${seedMatchesImported} upserted\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════");
  console.log("  Import complete");
  console.log(`  Mountains:         ${mountainsLinked} imported, ${mountainsSkipped} skipped, ${mountainsQueued} review queue`);
  console.log(`  Expedition routes: ${expRoutesImported}`);
  console.log(`  Training routes:   ${trainRoutesImported}`);
  console.log(`  Weights:           ${weightsImported}`);
  console.log(`  DNA records:       ${dnaExpCalc + dnaTrainCalc}`);
  console.log(`  Seed matches:      ${seedMatchesImported}`);
  if (warnings > 0) console.log(`  Warnings:          ${warnings}`);
  if (errors   > 0) console.log(`  Errors:            ${errors}`);
  console.log("══════════════════════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Import failed:", err);
  process.exit(1);
});
