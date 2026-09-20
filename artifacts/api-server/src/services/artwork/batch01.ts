import {
  buildPlacementAwarePrompt,
  type PlacementPromptInput,
} from "./promptBuilder.js";

export const BATCH_01_ID = "batch-01";

export const OBJECTIVE_FAILURE_REASONS = [
  "TEXT_OR_WATERMARK",
  "COLLAGE_OR_MULTI_PANEL",
  "SEVERE_ANATOMY_OR_EQUIPMENT",
  "WRONG_MOUNTAIN_MORPHOLOGY",
  "UNUSABLE_CROP",
  "FANTASY_GEOGRAPHY",
] as const;

export type ObjectiveFailureReason = typeof OBJECTIVE_FAILURE_REASONS[number];

export function isObjectiveFailureReason(value: unknown): value is ObjectiveFailureReason {
  return typeof value === "string"
    && OBJECTIVE_FAILURE_REASONS.includes(value as ObjectiveFailureReason);
}

export function validateCandidateGeneration(
  hasStoredCandidate: boolean,
  priorAttemptCount: number,
  reason?: ObjectiveFailureReason,
): number {
  if (hasStoredCandidate && !reason) {
    throw new Error("Regeneration requires an objectiveFailureReason");
  }
  if (!hasStoredCandidate && reason) {
    throw new Error("Initial generation cannot have an objectiveFailureReason");
  }
  const nextAttempt = priorAttemptCount + 1;
  if (nextAttempt > 3) {
    throw new Error("Initial generation plus two-regeneration limit reached");
  }
  return nextAttempt;
}

export function nextReviewVersion(priorReservedVersions: number[]): number {
  return Math.max(0, ...priorReservedVersions) + 1;
}

export interface ReviewAssetDefinition extends PlacementPromptInput {
  family: string;
  cropGuidance: string;
}

export const BATCH_01_ASSETS: ReviewAssetDefinition[] = [
  {
    assetId: "SR-MTN-MONTBLANC-001",
    title: "Mont Blanc — Alpine Dawn",
    family: "Mountains",
    placement: "Mountain and Expedition structural hero; later Explore card and expedition discovery derivatives.",
    subject: "The recognisable Mont Blanc massif as the unquestionable subject, viewed from a credible Chamonix-side alpine perspective, with realistic snow and glacier texture.",
    focalLocation: "Summit in the upper-middle/right third.",
    negativeSpaceLocation: "Generous sky plus a broad darker foreground and lower third for UI gradient and overlay.",
    cropRequirements: "The massif must remain recognisable in 16:9 hero and 4:5 or 3:2 card crops; retain the full summit tip.",
    people: "No people.",
    moodWeather: "Atmospheric alpine dawn, cold whites and restrained warm first light, natural optics.",
    geographicIdentity: "Credible Chamonix-side Mont Blanc morphology; broad glaciated massif, not a pyramidal horn.",
    exclusions: ["Matterhorn-like pyramidal silhouette", "impossible glacier forms", "climbers", "buildings dominating the frame", "text"],
    cropGuidance: "Focal summit upper-middle/right; preserve sky and darker lower-third overlay area.",
  },
  {
    assetId: "SR-MTN-MATTERHORN-001",
    title: "Matterhorn — First Light",
    family: "Mountains",
    placement: "Mountain detail and Explore hero; Expedition discovery card.",
    subject: "The recognisable Matterhorn from a credible Zermatt-area perspective with its clear asymmetric silhouette and darker alpine foreground.",
    focalLocation: "Peak around the right third.",
    negativeSpaceLocation: "Quiet darker left side for overlay.",
    cropRequirements: "Retain the full summit in wide and card crops.",
    people: "No people.",
    moodWeather: "Restrained warm first light, natural alpine shadows and atmosphere.",
    geographicIdentity: "Credible Zermatt-area Matterhorn morphology with its asymmetric horn.",
    exclusions: ["generic symmetric fantasy pyramid", "Mont Blanc morphology", "text", "buildings dominating the frame"],
    cropGuidance: "Peak right third; protect summit tip; use left negative space.",
  },
  {
    assetId: "SR-MTN-KILIMANJARO-001",
    title: "Kilimanjaro — Above the Cloud",
    family: "Mountains",
    placement: "Mountain detail and Expedition hero; discovery card.",
    subject: "The broad recognisable Kibo and Uhuru massif above an East African highland foreground and sea of cloud.",
    focalLocation: "Broad summit profile across the upper-middle frame.",
    negativeSpaceLocation: "Spacious sky and darker lower foreground for text gradient.",
    cropRequirements: "The summit and broad volcanic profile must survive 16:9 and card crops.",
    people: "No people.",
    moodWeather: "Restrained sunrise light, spacious natural scale and atmospheric cloud.",
    geographicIdentity: "Broad Kilimanjaro volcanic morphology with a restrained glacial cap and East African context.",
    exclusions: ["sharp Alpine peak", "jungle at the summit", "excessive snow", "fantasy volcano plume", "text"],
    cropGuidance: "Keep broad Kibo profile central; preserve darker lower foreground.",
  },
  {
    assetId: "SR-EXP-EBC-001",
    title: "Everest Base Camp — The Approach",
    family: "Expeditions",
    placement: "Everest Base Camp expedition hero, Basecamp progress context and discovery card.",
    subject: "A trekking approach through a credible Khumbu environment with Everest-region scale and glaciated terrain; the mountain landscape remains dominant.",
    focalLocation: "Two or three small trekkers moving away from camera near lower-centre/right.",
    negativeSpaceLocation: "Left and lower negative space without obscuring essential terrain.",
    cropRequirements: "Trekkers must remain away from edges and major mountain features must survive wide and card crops.",
    people: "Two or three small authentic trekkers, viewed from behind, with practical Himalayan trekking equipment.",
    moodWeather: "Cold natural morning atmosphere.",
    geographicIdentity: "Credible Khumbu trekking approach and glaciated Everest-region terrain; not a summit-climbing viewpoint.",
    exclusions: ["summit-climbing scene", "crowds", "tents dominating", "flags", "text", "impossible Everest view"],
    cropGuidance: "Trekkers lower-centre/right; retain mountain scale and left overlay space.",
  },
  {
    assetId: "SR-TRAIN-BASECAMP-001",
    title: "Training Basecamp — Build Today",
    family: "Training",
    placement: "Training Basecamp structural hero behind the active mountain goal UI.",
    subject: "An authentic UK hill training scene with one hiker ascending a steep rocky path or ridge toward a destination ridge or peak.",
    focalLocation: "Hiker on the right third.",
    negativeSpaceLocation: "Left and lower-left space for Training objective and metrics.",
    cropRequirements: "Keep the horizon high enough to support portrait and wide derivatives while retaining the hiker.",
    people: "One hiker seen from behind, practical daypack and trekking clothing, determined rather than heroic.",
    moodWeather: "Believable dawn in tactile Lake District or Snowdonia-style terrain.",
    geographicIdentity: "Authentic UK mountain or hill terrain, not alpine or extreme mountaineering.",
    exclusions: ["Alps", "ropes", "ice axe", "extreme mountaineering", "gym scene", "text", "staged influencer pose"],
    cropGuidance: "Hiker right third; preserve left/lower-left overlay area and high horizon.",
  },
  {
    assetId: "SR-EXP-DISCOVERY-001",
    title: "Expeditions — The Journey Ahead",
    family: "Expeditions",
    placement: "Expeditions discovery structural hero, not tied to one named expedition.",
    subject: "A small group traversing a dramatic but credible high-mountain approach, viewed from behind, with a large layered landscape and sense of journey.",
    focalLocation: "Three hikers lower-right or lower-centre, secondary to the landscape.",
    negativeSpaceLocation: "Clean darker left side for page title and CTA.",
    cropRequirements: "Landscape and group remain usable in a 16:9 crop.",
    people: "A small group of three authentic hikers viewed from behind.",
    moodWeather: "Restrained early light with atmospheric layered peaks.",
    geographicIdentity: "Credible non-specific high-mountain approach, not a false composite of a named mountain.",
    exclusions: ["identifiable false composite of a named mountain", "summit celebration", "flags", "text"],
    cropGuidance: "Group lower-right/centre; protect dark left title space.",
  },
  {
    assetId: "SR-EXPLORE-001",
    title: "Explore — Find Your Mountain",
    family: "Onboarding / App UI",
    placement: "Explore page hero and empty-discovery visual.",
    subject: "An expansive UK mountain and ridge landscape with a lone hiker paused at a natural viewpoint looking toward several believable route possibilities.",
    focalLocation: "Hiker lower-right.",
    negativeSpaceLocation: "Broad left and centre area with atmospheric depth.",
    cropRequirements: "Retain strong layered depth and the viewpoint in wide and card crops.",
    people: "One lone authentic hiker, naturally paused, not celebrating.",
    moodWeather: "Subtle atmospheric layers and natural restrained daylight.",
    geographicIdentity: "Believable UK mountain terrain and route choices.",
    exclusions: ["route overlays", "UI", "text", "fantasy terrain", "summit celebration"],
    cropGuidance: "Hiker lower-right; preserve broad left/centre discovery space.",
  },
  {
    assetId: "SR-TRACK-001",
    title: "Track — Real Effort",
    family: "Training",
    placement: "Track pre-start/background hero and marketing derivative; must preserve live map readability.",
    subject: "A close-to-mid rear three-quarter view of a hiker moving uphill on a rugged UK trail with natural exertion and landscape opening ahead.",
    focalLocation: "Person on the right third.",
    negativeSpaceLocation: "Clean central and left terrain for UI overlay and map readability.",
    cropRequirements: "Keep person, boots, poles and daypack intact in wide and card crops.",
    people: "One authentic hiker with boots, poles and practical daypack; no phone.",
    moodWeather: "Cooler overcast or dawn light with tactile terrain.",
    geographicIdentity: "Credible rugged UK trail, not a race or gym.",
    exclusions: ["phone in hand", "visible app UI", "running race", "gym", "text"],
    cropGuidance: "Person right third; keep central/left terrain quiet and readable.",
  },
  {
    assetId: "SR-RANK-001",
    title: "Rank — Higher With Every Step",
    family: "Rank",
    placement: "Rank progression atmospheric background behind vertical ascent and progression UI.",
    subject: "A dramatic dark real mountain ridge rising diagonally from lower-left toward a luminous summit upper-right, with enough terrain detail to remain photographic.",
    focalLocation: "Luminous summit upper-right, diagonal ascent corridor from lower-left.",
    negativeSpaceLocation: "Dark quiet space around the ridge for rank markers.",
    cropRequirements: "Preserve the diagonal ascent corridor in wide and card crops.",
    people: "No people.",
    moodWeather: "Restrained atmospheric light and deep natural shadows.",
    geographicIdentity: "Real plausible mountain ridge terrain rather than game or fantasy art.",
    exclusions: ["glowing dots", "route lines", "game art", "badges", "text", "fantasy mountain"],
    cropGuidance: "Diagonal lower-left to upper-right; dark space around ridge.",
  },
  {
    assetId: "SR-DNA-001",
    title: "Mountain DNA — Terrain Intelligence",
    family: "Routes / Mountain DNA",
    placement: "Mountain DNA comparison hero and background beneath data visualisation.",
    subject: "Close-to-wide real mountain terrain with a readable ridge, slope transitions and rock, grass and scree textures that communicate elevation character.",
    focalLocation: "Terrain structure distributed clearly across the frame.",
    negativeSpaceLocation: "Darker edge areas for data overlays.",
    cropRequirements: "Slope transitions and terrain character remain visible across wide and card crops.",
    people: "No people.",
    moodWeather: "Cool neutral daylight with natural texture and depth.",
    geographicIdentity: "Credible real mixed mountain terrain and ridge structure.",
    exclusions: ["generated blue networks", "charts", "route lines", "text", "sci-fi look"],
    cropGuidance: "Retain ridge and slope transitions; darker overlay-safe edges.",
  },
  {
    assetId: "SR-ACHIEVE-001",
    title: "Achievement — Earned Summit",
    family: "Achievements",
    placement: "Achievement and completion atmospheric hero, deliberately below the protected Expedition summit cinematic in drama.",
    subject: "One hiker standing naturally on a UK or alpine-style summit ridge after effort, with an expansive landscape and quiet earned satisfaction.",
    focalLocation: "Hiker on the right third, back or side to camera.",
    negativeSpaceLocation: "Left side for achievement details.",
    cropRequirements: "Retain the full natural stance and landscape in wide and card crops.",
    people: "One authentic hiker, calm posture, no arms-up celebration.",
    moodWeather: "Restrained sunrise or sunset, quiet rather than triumphant.",
    geographicIdentity: "Credible UK or alpine-style summit ridge without exaggerated exposure.",
    exclusions: ["trophy", "medals", "confetti", "arms-up cliché", "text"],
    cropGuidance: "Hiker right third; left detail space; keep drama below cinematic summit treatment.",
  },
  {
    assetId: "SR-YOU-001",
    title: "You — Mountain Identity",
    family: "Onboarding / App UI",
    placement: "You and Profile header supporting Rank, lifetime elevation and mountain identity.",
    subject: "An authentic environmental outdoor portrait with a single anonymous hiker in a dark technical shell looking toward a mountain landscape.",
    focalLocation: "Person on the right third in side or back three-quarter profile; face not dominant.",
    negativeSpaceLocation: "Dark quiet left side for profile metrics.",
    cropRequirements: "Keep head, hands and shell intact in wide and card crops.",
    people: "One anonymous authentic hiker; documentary rather than fashion pose.",
    moodWeather: "Premium restrained documentary atmosphere with natural mountain light.",
    geographicIdentity: "Credible mountain environment and practical non-extreme hiking equipment.",
    exclusions: ["fashion shoot", "brand logos", "extreme climber gear", "text"],
    cropGuidance: "Person right third; left side dark and quiet for metrics.",
  },
];

export const BATCH_01_PROMPTS = BATCH_01_ASSETS.map((asset) => ({
  ...asset,
  ...buildPlacementAwarePrompt(asset),
}));