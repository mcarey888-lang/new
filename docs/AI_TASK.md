# SummitReady Flagship Artwork Generation — Batch 01

**Command:** ART-C01
**Authority:** ChatGPT lead product/design/art direction
**Baseline:** `f69e358e14dae28c253ce5f519e91477f3a78321`
**Purpose:** Generate individual production-quality masters through the EXISTING SummitReady Artwork Admin / artwork API / ImageProvider pipeline.
**Do not publish or auto-approve. Do not start Stage 9.**

## Core rule

Before generating an asset, know exactly where it will be used. Every image is an individual master — NEVER a collage, contact sheet, mood board, UI mockup, poster or image containing multiple panels. No baked-in text, labels, logos, UI, route lines or badges.

Use the existing OpenAI image provider pipeline and object storage/version metadata. Generated images must remain candidates until reviewed/approved.

## Art direction lock

Photographic premium outdoor editorial. Believable real geography. Natural weather and terrain. Authentic technical clothing/equipment where people appear. Restrained saturation. Deep natural shadows, atmospheric depth, dawn/dusk/golden-hour only when geographically plausible. Premium Berghaus/Arc'teryx/Patagonia editorial character without copying a specific campaign.

Avoid: fantasy peaks, impossible ridgelines, oversaturated HDR, generic AI gloss, excessive lens flare, duplicated hikers, malformed equipment, unsafe/impossible climbing positions, fake signage, text, watermarks.

All masters: 1536×1024 landscape 3:2 using the current provider unless the provider contract has changed. Compose for downstream crops. Preserve a clear focal subject and useful negative space. Do not crop summit tips, faces, hands or essential route terrain.

## ART-C01 — Make prompt builder placement-aware

Add a safe additive prompt mode/metadata input for asset purpose/placement. Preserve existing challenge generation compatibility. It must be able to describe:
- subject
- actual intended app placement
- focal location
- negative-space location
- crop requirements
- people/no-people
- mood/weather
- geographic identity requirements
- exclusions

Do not introduce production schema/migrations. For this batch, generation manifest/metadata may be stored in docs/dev tooling or existing candidate metadata.

## ART-C02 — Generate Batch 01 individually

Generate ONE candidate master for each item below through the existing SummitReady generation engine. Titles below are internal asset titles, not text to render in images.

### SR-MTN-MONTBLANC-001 — “Mont Blanc — Alpine Dawn”
**Use:** Mountain/Expedition structural hero; later derivatives for Explore card and expedition discovery.
**Composition:** recognisable Mont Blanc massif as the unquestionable subject, viewed from a credible Chamonix-side alpine perspective; summit in upper-middle/right third; broad darker foreground/lower third for UI gradient; atmospheric dawn, cold whites and restrained warm first light; no people.
**Crop safety:** massif remains recognisable in 16:9 hero and 4:5/3:2 card crops; generous sky and lower foreground.
**Prompt intent:** premium photographic editorial mountain landscape, realistic snow/glacier texture, geographically credible, natural optics.
**Exclude:** Matterhorn-like pyramidal silhouette, impossible glacier forms, climbers, buildings dominating frame, text.

### SR-MTN-MATTERHORN-001 — “Matterhorn — First Light”
**Use:** Mountain detail/Explore hero and Expedition discovery card.
**Composition:** recognisable Matterhorn from a credible Zermatt-area perspective; peak around right third, clear asymmetric silhouette; darker alpine foreground with restrained warm first light; no people.
**Crop safety:** full summit retained in wide and card crops; left-side negative space useful for overlay.
**Exclude:** generic symmetric fantasy pyramid, Mont Blanc morphology, text/buildings dominating.

### SR-MTN-KILIMANJARO-001 — “Kilimanjaro — Above the Cloud”
**Use:** Mountain detail/Expedition hero and discovery card.
**Composition:** broad recognisable Kibo/Uhuru massif, East African highland foreground, sea of cloud, restrained sunrise light; no people; spacious scale.
**Crop safety:** summit and broad volcanic profile survive 16:9 and card crops; darker lower foreground for text gradient.
**Exclude:** sharp Alpine peak, jungle at summit, excessive snow, fantasy volcano plume, text.

### SR-EXP-EBC-001 — “Everest Base Camp — The Approach”
**Use:** Everest Base Camp expedition hero/Basecamp progress context and discovery card.
**Composition:** trekking approach in Khumbu environment; Everest-region scale and glaciated terrain; 2–3 small authentic trekkers moving away from camera to establish human scale; mountain landscape remains dominant; cold morning atmosphere.
**Crop safety:** hikers near lower-centre/right but not edge; major mountain features survive wide/card crop; left/lower negative space.
**Exclude:** summit-climbing scene, crowds, tents dominating, flags/text, impossible Everest view.

### SR-TRAIN-BASECAMP-001 — “Training Basecamp — Build Today”
**Use:** Training Basecamp structural hero behind the user’s active mountain goal UI.
**Composition:** authentic UK hill/mountain training scene at dawn; single hiker seen from behind ascending a steep rocky path/ridge, practical daypack and trekking clothing, believable Lake District/Snowdonia-style terrain; destination ridge/peak ahead; determined rather than heroic pose.
**Crop safety:** hiker on right third; left and lower-left negative space for Training objective/metrics; horizon high enough to support portrait/wide derivatives.
**Exclude:** Alps, ropes/ice axe, extreme mountaineering, gym scene, text, staged influencer pose.

### SR-EXP-DISCOVERY-001 — “Expeditions — The Journey Ahead”
**Use:** Expeditions discovery page structural hero, not tied to one exact expedition.
**Composition:** small group of 3 hikers traversing a dramatic but credible high-mountain approach, viewed from behind; large landscape, layered peaks, early light, sense of journey and scale; people secondary.
**Crop safety:** group lower-right/centre; clean darker left side for page title/CTA; landscape usable 16:9.
**Exclude:** identifiable false composite of a named mountain, summit celebration, flags, text.

### SR-EXPLORE-001 — “Explore — Find Your Mountain”
**Use:** Explore page hero/empty-discovery visual.
**Composition:** expansive UK mountain/ridge landscape with a lone hiker paused at a natural viewpoint looking toward several route possibilities; believable terrain; subtle atmospheric layers; no map graphics.
**Crop safety:** hiker lower-right; broad left/centre negative space; strong depth.
**Exclude:** route overlays, UI, text, fantasy terrain, summit celebration.

### SR-TRACK-001 — “Track — Real Effort”
**Use:** Track pre-start/background hero and marketing derivative; must not interfere with live map readability.
**Composition:** close-to-mid rear three-quarter view of a hiker moving uphill on a rugged UK trail, natural exertion, boots/poles/daypack, landscape opening ahead; cooler overcast/dawn light, tactile terrain.
**Crop safety:** person on right third; central/left terrain clean enough for UI overlays.
**Exclude:** phone in hand, visible app UI, running race, gym, text.

### SR-RANK-001 — “Rank — Higher With Every Step”
**Use:** Rank progression screen atmospheric background behind the vertical ascent/progression UI.
**Composition:** dramatic dark mountain ridge rising diagonally from lower-left toward a luminous summit upper-right; no people; enough real terrain detail to feel photographic; restrained atmospheric light.
**Crop safety:** clear diagonal ascent corridor; dark negative space around it for rank markers; no baked-in markers.
**Exclude:** glowing dots/route lines, game art, badges, text, fantasy mountain.

### SR-DNA-001 — “Mountain DNA — Terrain Intelligence”
**Use:** Mountain DNA comparison hero/background beneath data visualisation.
**Composition:** close/wide real mountain terrain showing a readable ridge, slope transitions, rock/grass/scree textures and elevation character; cool neutral daylight; no people.
**Crop safety:** terrain structure visible across frame; darker edge areas for data overlays.
**Exclude:** generated blue networks, charts, route lines, text, sci-fi look.

### SR-ACHIEVE-001 — “Achievement — Earned Summit”
**Use:** Achievement/completion atmospheric hero, below the protected Expedition summit cinematic in drama.
**Composition:** one hiker standing naturally on a UK/alpine-style summit ridge after effort, back/side to camera, sunrise/sunset restrained, expansive landscape; quiet earned satisfaction, not arms-up stock-photo celebration.
**Crop safety:** hiker right third, left space for achievement details.
**Exclude:** trophy, medals, confetti, arms-up cliché, text.

### SR-YOU-001 — “You — Mountain Identity”
**Use:** You/Profile header background supporting Rank, lifetime elevation and mountain identity.
**Composition:** authentic outdoor portrait/environmental scene, single anonymous hiker in dark technical shell, side/back three-quarter profile looking toward mountain landscape; face not dominant; premium documentary feel.
**Crop safety:** person right third; left side dark/quiet for profile metrics.
**Exclude:** fashion shoot, brand logos, extreme climber gear, text.

## ART-C03 — Generation manifest

Create `docs/SUMMITREADY_ARTWORK_BATCH_01.md` recording for every asset:
- ID/title
- family
- intended app placements
- exact final prompt sent
- provider/model
- master dimensions
- generated version/object path
- generation cost if available
- status = REVIEW REQUIRED
- crop/focal guidance

No asset may be marked approved/published by this command.

## ART-C04 — Review gallery

Expose all 12 individual candidates together in the existing development-only Media Studio review surface. Each must be independently viewable at master ratio plus representative 16:9 and card crop previews. This gallery is for review only; do not bake labels into image files.

## ART-C05 — Quality self-review

Before reporting complete, inspect each candidate against its brief. Automatically reject/regenerate only for objective generation failures: text/watermark, collage/multi-panel output, severe anatomy/equipment corruption, obviously wrong mountain morphology, unusable crop, or clear fantasy geography.

Maximum 2 regeneration attempts per asset in this run to control cost. Do NOT endlessly regenerate for subjective taste. Leave the strongest candidate as REVIEW REQUIRED.

## ART-C06 — Verify and STOP

Verify:
- exactly 12 independently stored masters/candidates;
- no collage assets;
- no automatic approval/publication;
- no production schema/migration/backfill;
- no mobile release/deploy;
- no Stage 9;
- protected Progress Mountain/cinematic untouched.

Update `docs/AI_HANDOFF.md` and `docs/AI_CHANGELOG.md`, commit/push, then STOP for ChatGPT visual review.

End Replit response with exactly one status: COMPLETE, PARTIAL, BLOCKED, FAILED, or APPROVAL REQUIRED.
