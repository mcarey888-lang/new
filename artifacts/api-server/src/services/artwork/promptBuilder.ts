/**
 * Expedition Prompt Builder
 * ─────────────────────────
 * Reads expedition data and constructs a detailed cinematic landscape
 * photography prompt that produces consistent, premium-quality artwork
 * across the entire Summit Ready catalogue.
 *
 * Style target: National Geographic / Patagonia / Arc'teryx quality.
 * Visual language: golden hour, atmospheric haze, natural colours,
 * UK foreground + iconic target mountain in the background.
 */

import type { SignatureChallenge, ChallengeStage } from "@workspace/db";
import crypto from "node:crypto";

// ── Region-to-terrain vocabulary ─────────────────────────────────────────────
const REGION_TERRAIN: Record<string, string> = {
  "Lake District":  "rocky Lakeland fells, ancient stone walls, autumn bracken",
  "Snowdonia":      "dramatic Welsh ridgelines, slate-grey scree, Snowdonian valleys",
  "Scotland":       "vast Scottish moorland, purple heather, Highland glens",
  "Peak District":  "gritstone edges, open moorland, limestone dales",
  "Yorkshire Dales":"limestone pavements, rolling green dales, dry-stone walls",
  "Dartmoor":       "granite tors, sweeping moorland, ancient bogland",
  "Brecon Beacons": "sandstone ridges, wide open summits, Welsh valleys",
  "Cairngorms":     "Arctic plateau, ancient Caledonian forest, mountain corries",
};

// ── Mountain background vocabulary ───────────────────────────────────────────
const MOUNTAIN_BG: Record<string, string> = {
  "Matterhorn":           "the iconic pyramidal horn of the Matterhorn rising sharply beyond layers of atmospheric haze",
  "Mont Blanc":           "the vast snow-capped dome of Mont Blanc looming on the horizon with glaciated flanks",
  "Kilimanjaro":          "the flat-topped volcanic summit of Kilimanjaro crowned with its glacial ice cap",
  "Everest Base Camp":    "the immense Himalayan valley leading to Everest, with Khumbu Icefall visible in the distance",
  "Mount Everest":        "the dark pyramid of Everest above the South Col ridge, highest point on earth",
  "K2":                   "the savage silhouette of K2's near-perfect pyramid above swirling cloud",
  "Kangchenjunga":        "the massive multi-summit wall of Kangchenjunga spread across the horizon",
  "Eiger":                "the sheer north face of the Eiger catching the last light of the day",
  "Aconcagua":            "the broad glaciated shoulders of Aconcagua, highest peak in the Americas",
  "Denali":               "the enormous bulk of Denali rising from boreal forest into arctic sky",
  "Elbrus":               "the twin volcanic summits of Elbrus draped in permanent snowfields",
  "Mount Fuji":           "the perfect symmetrical cone of Fuji with a dusting of snow at its crater",
  "Ama Dablam":           "the elegant spire of Ama Dablam with its hanging glacier catching golden light",
  "Annapurna I":          "the broad Annapurna massif with its dramatic south face",
  "Nanga Parbat":         "the immense Rupal Face of Nanga Parbat filling the horizon",
  "Jungfrau":             "the graceful snow-draped ridge of the Jungfrau above the Bernese Oberland",
  "Grossglockner":        "the rocky summit of Grossglockner with the Pasterze Glacier below",
  "Mount Toubkal":        "the barren Atlas summit of Toubkal under a wide North African sky",
  "Mount Kenya - Batian": "the twin rocky spires of Batian and Nelion above the equatorial snowfields",
  "Triglav":              "the three-headed summit of Triglav above Julian Alps meadows",
  "Ben Nevis":            "the broad plateau of Ben Nevis above dramatic Highland cliffs",
  "Snowdon / Yr Wyddfa":  "the summit pyramid of Snowdon above glacially carved cwms",
  "Carrauntoohil":        "the rugged Irish summit of Carrauntoohil above Macgillycuddy's Reeks",
};

// ── Mood vocabulary by difficulty ────────────────────────────────────────────
const DIFFICULTY_MOOD: Record<string, string> = {
  "Beginner":     "accessible and inviting, gentle adventure, encouraging light",
  "Moderate":     "confident adventure, dramatic but approachable, mid-morning energy",
  "Challenging":  "bold and dramatic, sense of real commitment, golden hour intensity",
  "Expert":       "raw and wild, extreme conditions suggested, last-light atmosphere",
};

// ── DNA focus vocabulary ──────────────────────────────────────────────────────
const DNA_MOOD: Record<string, string> = {
  "Ridge":        "exposed ridgeline leading the eye to the horizon",
  "Valley":       "deep valley framing the distant peak",
  "Summit":       "relentless ascent, summit close on the skyline",
  "Traverse":     "long elegant traverse across open hillside",
  "Circuit":      "sweeping circular panorama, full landscape visible",
  "Long Distance":"vast wilderness perspective, scale of the journey apparent",
  "Wilderness":   "remote and untouched, no signs of human impact",
};

// ── Lighting vocabulary ───────────────────────────────────────────────────────
const LIGHTING_OPTIONS = [
  "golden hour sunrise light raking across the landscape from low on the horizon",
  "warm late-afternoon golden hour, long shadows stretching across the terrain",
  "dramatic pre-dawn blue hour transitioning to first golden light",
  "soft diffused morning light after mist clears from the valleys",
];

// ── Public style block (fixed across all expeditions) ────────────────────────
const STYLE_BLOCK = `
Photography style: National Geographic, Patagonia, Arc'teryx premium outdoor adventure.
Camera: full-frame DSLR or mirrorless, wide-angle lens 16-24mm, f/8, ISO 100.
Colour grading: natural, rich but not oversaturated. Deep blues, warm greens, earthy tones.
Quality: ultra-realistic, cinematic, sharp foreground, beautiful depth of field.
Atmosphere: soft haze in the mid-distance, dramatic but natural clouds, epic sky.
No people (or tiny silhouette for scale only). No text. No logos. No watermarks. No UI elements.
Negative space: clean sky in the top 20% of the frame for title overlay. Darker terrain in the bottom 25% for card UI overlay.
`.trim();

// ── Main export ───────────────────────────────────────────────────────────────

export interface BuiltPrompt {
  prompt: string;
  hash: string;  // sha256 of the source data; used to detect stale images
}

export function buildExpeditionPrompt(
  challenge: SignatureChallenge,
  stages: ChallengeStage[],
): BuiltPrompt {
  const { targetMountainName, targetRoute, routeDnaFocus, difficulty, regions } = challenge;

  // ── Foreground (Day 1 route or primary stage) ────────────────────────────
  const primaryStage = stages.find((s) => s.stageOrder === 1) ?? stages[0];
  const secondaryStage = stages.find((s) => s.stageOrder === 2);

  const foregroundRoute = primaryStage?.routeName ?? targetRoute ?? "rugged UK hiking terrain";
  const foregroundRegion = primaryStage?.region ?? regions?.split(",")[0] ?? "the UK";
  const terrainDesc = REGION_TERRAIN[foregroundRegion.trim()] ?? `beautiful ${foregroundRegion} landscape`;

  const foreground = `${foregroundRoute} in ${foregroundRegion}. Terrain: ${terrainDesc}.`;

  // ── Secondary / midground ────────────────────────────────────────────────
  const midground = secondaryStage
    ? `${secondaryStage.routeName} visible in the midground, rolling landscape leading the eye forward.`
    : "rolling UK countryside in the midground, leading the eye naturally toward the distant horizon.";

  // ── Background mountain ──────────────────────────────────────────────────
  const mountainBg = MOUNTAIN_BG[targetMountainName]
    ?? `${targetMountainName} rising majestically on the horizon beyond atmospheric layers`;

  // ── Mood / lighting ──────────────────────────────────────────────────────
  const moodDesc = DIFFICULTY_MOOD[difficulty ?? "Moderate"] ?? DIFFICULTY_MOOD["Moderate"];
  const dnaKey = routeDnaFocus?.split("|")[0]?.trim() ?? "";
  const dnaExtra = DNA_MOOD[dnaKey] ?? "";
  const lighting = LIGHTING_OPTIONS[
    Math.abs(challenge.challengeId.charCodeAt(challenge.challengeId.length - 1)) % LIGHTING_OPTIONS.length
  ];

  // ── Compose final prompt ─────────────────────────────────────────────────
  const prompt = [
    "Create an ultra-realistic cinematic landscape photograph.",
    "",
    `Foreground: ${foreground}`,
    "",
    `Midground: ${midground}`,
    "",
    `Background: ${mountainBg}.`,
    `This is the target mountain — the inspiration for this UK expedition. It should appear naturally and majestically, not as a collage. The UK foreground is the primary subject.`,
    "",
    `Lighting: ${lighting}.`,
    "",
    dnaExtra ? `Composition emphasis: ${dnaExtra}.` : "",
    "",
    `Mood: ${moodDesc}.`,
    "",
    STYLE_BLOCK,
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // ── Hash for stale detection ─────────────────────────────────────────────
  const hashSource = [
    challenge.challengeId,
    challenge.targetMountainName,
    challenge.targetRoute ?? "",
    challenge.routeDnaFocus ?? "",
    challenge.difficulty ?? "",
    challenge.regions ?? "",
    stages.map((s) => `${s.stageOrder}:${s.routeName}`).join("|"),
  ].join("::");

  const hash = crypto.createHash("sha256").update(hashSource).digest("hex").slice(0, 16);

  return { prompt, hash };
}
