# SummitReady Artwork Batch 02 — Mock-up Support Pack

**Command:** ART2-C01
**Authority:** ChatGPT lead product/design/architecture
**Purpose:** Create a tightly curated second artwork batch through the EXISTING SummitReady Artwork Admin / Media Studio pipeline used for Batch 01.
**Production publication:** NOT AUTHORIZED.
**App integration:** NOT AUTHORIZED in this task.
**Stage 9:** PAUSED.

## Objective

The approved app mock-ups currently contain a richer visual language than the live asset library can support. Create Batch 02 as a coherent premium support pack for Explore, Track, Expeditions and You/Profile so later UI implementation can match those mock-ups without substituting generic/satellite imagery.

This is an artwork-generation/review task only. Do not redesign screens in this task.

## Non-negotiable architecture

Use the existing canonical SummitReady artwork system:
Artwork Admin + artwork API/services + existing ImageProvider + prompt/version/status/approval/crop/storage workflow.

Follow the same lifecycle as Batch 01:
**curated batch definition → cost/count confirmation → generation → review gallery → manual approval/rejection → variants/publication later**

Do NOT:
- create another media/artwork subsystem;
- bypass Artwork Admin;
- directly hard-code generated files into app screens;
- auto-approve assets;
- publish to production;
- perform catalogue-wide generation;
- alter the Summit Data Engine;
- touch protected Progress Mountain/cinematic files.

Retain the server-side generation safety limit and existing cost controls.

## ART2-C01 — Curated Batch 02 manifest

Create exactly these 12 masters with stable IDs and intended placement metadata:

1. **SR-EXPLORE-HERO-002 — Explore — Into the Mountains**
   Placement: `explore.discovery.hero`
   Cinematic British mountain discovery landscape; dramatic ridge leading the eye into distant peaks/valley; early light; adventurous but credible; generous dark/quiet negative space for native UI.

2. **SR-EXPLORE-RIDGE-002 — Explore Route — Exposed Ridge**
   Placement: `explore.route.card.ridge`
   Authentic-feeling UK high ridge hiking scene; strong trail line; atmospheric depth; small distant hiker for scale only; no identifiable named mountain claim.

3. **SR-EXPLORE-SUMMIT-002 — Explore Route — Summit Day**
   Placement: `explore.route.card.summit`
   Rugged British summit approach; stone/rock foreground, layered mountains, changing weather, premium editorial photography.

4. **SR-EXPLORE-VALLEY-002 — Explore Route — Valley to Mountain**
   Placement: `explore.route.card.valley`
   Mountain route beginning in green valley and rising toward imposing high ground; route journey readable visually.

5. **SR-TRACK-HERO-002 — Track — Into the Wild**
   Placement: `track.hero`
   Lone hillwalker moving through rugged upland trail; strong forward motion/composition; room for GPS/tracking UI overlay; realistic weather and terrain.

6. **SR-TRACK-ACTIVITY-002 — Track — Mountain Activity**
   Placement: `track.activity.hero`
   Elevated view across winding mountain trail and terrain; visual sense of distance/elevation; no drawn GPS line baked into image.

7. **SR-EXPEDITION-HERO-002 — Expeditions — Bigger Objective**
   Placement: `expedition.discovery.hero`
   Grand high-mountain expedition atmosphere; distant climbers for scale; dramatic but realistic; should feel aspirational and premium, not fantasy.

8. **SR-EXPEDITION-STAGE-002 — Expedition — The Ascent**
   Placement: `expedition.stage.hero`
   Climbers ascending broad mountain terrain toward a high objective; clear vertical journey; safe space for stage/progress UI.

9. **SR-YOU-HERO-002 — You — Mountain Identity**
   Placement: `profile.hero`
   Mountaineer/hillwalker viewed from behind at a summit/ridge overlook; identity/achievement mood; no recognisable face; ample overlay space.

10. **SR-RANK-ASCENT-002 — Rank — The Ascent**
    Placement: `rank.progress.background`
    Abstract-real photographic mountain ascent composition with layered elevation/ridges; designed to support rank/progression overlays without becoming busy.

11. **SR-DNA-TERRAIN-002 — Mountain DNA — Terrain Layers**
    Placement: `mountain.dna.background`
    Highly detailed mountain terrain/ridge composition emphasizing steepness, exposure, rock, trail and relief; clean enough for analytical overlays; no labels baked in.

12. **SR-ATMOSPHERE-002 — SummitReady — Alpine Atmosphere**
    Placement: `app.atmosphere.background`
    Flexible dark cinematic mountain atmosphere master for transitions/empty states/supporting surfaces; deliberately low-detail safe zones.

## ART2-C02 — Shared art direction

All 12 must feel like one SummitReady campaign/library:
- premium outdoor editorial photography;
- National Geographic / high-end technical outdoor campaign quality target;
- photorealistic, physically plausible terrain/weather/light;
- dark cinematic grading compatible with SummitReady;
- restrained natural greens/blues/stone/earth;
- realistic atmospheric depth;
- no fantasy mountains;
- no oversaturated HDR;
- no glossy AI-ad aesthetic;
- no text, logos, badges, UI, route lines or fake map data baked into imagery;
- no close-up faces;
- no unsafe/impossible climbing depiction;
- deliberate focal point plus negative/safe space for native UI;
- compositions designed for mobile crops.

Generate landscape masters using the existing Batch 01 provider/master settings unless the existing architecture requires a documented equivalent. Derive crops through the existing crop system, not separate generations.

## ART2-C03 — Geographic truth

Batch 02 intentionally uses mostly non-named terrain so generated art cannot falsely represent a named mountain.

For actual named mountains/routes in Explore, later runtime integration must continue to prefer exact approved geographically truthful photography/artwork according to the existing hierarchy.

Do not label a Batch 02 generic image as Ben Nevis, Snowdon/Yr Wyddfa, Helvellyn, Mont Blanc, Matterhorn, etc.

## ART2-C04 — Mock-up-aware composition

Prompts must explicitly account for later native UI overlays.

Explore assets:
- landscape is the star;
- strong visual route through scene;
- suitable for premium editorial discovery cards;
- avoid important detail at extreme crop edges.

Track:
- sense of movement, terrain and real outdoor effort;
- preserve quiet overlay area for tracking controls/data.

Expedition:
- bigger scale and ambition than Explore;
- preserve the protected Progress Mountain/cinematic as a separate system; these images do not replace it.

You/Profile:
- identity, accumulated experience, aspiration;
- subject secondary to mountain environment.

DNA/Rank:
- background supports information hierarchy; it must not fight charts/labels.

## ART2-C05 — Generation safety and cost gate

Before generation:
- confirm count = exactly 12;
- calculate/display estimated provider cost using the existing provider estimate;
- confirm no other assets are queued;
- verify no catalogue-wide generation path is invoked.

This task authorizes generation of **only these 12 Batch 02 masters** using the existing configured provider. It does not authorize retries/regenerations beyond one initial candidate per asset.

If any generation fails, leave it failed/retryable and report it; do not silently spend on repeated attempts.

## ART2-C06 — Review workflow

Add Batch 02 to the existing Artwork Admin review experience with the same useful review controls as Batch 01.

Each candidate must expose:
- asset ID/name;
- intended placement;
- prompt/version where already supported;
- generation/review status;
- approve/reject controls;
- preview of useful derived crop(s) where existing system supports it.

**All generated assets must remain unapproved/review-only.**
The product owner will manually review and approve/reject them.

Approval does NOT mean production publication.

## ART2-C07 — Verification

Verify:
- exactly 12 Batch 02 manifest entries;
- no duplicate IDs;
- generation restricted to Batch 02;
- generated assets stored/versioned through existing storage;
- review gallery loads;
- approve/reject state path remains functional;
- Batch 01 remains intact;
- no production publication;
- no SDE changes;
- no protected Progress Mountain/cinematic changes.

Run targeted tests/TypeScript only as necessary; avoid unrelated expensive full-suite work.

## ART2-C08 — Report and STOP

Create:
`docs/ARTWORK_BATCH_02_REPORT.md`

Report:
- exact 12 assets;
- prompts/prompt version;
- provider/model/master dimensions;
- count generated/succeeded/failed;
- actual/estimated cost if available;
- review URL/path;
- files changed;
- tests;
- confirmation Batch 01 unchanged;
- confirmation nothing was auto-approved or published.

Update AI_HANDOFF and AI_CHANGELOG as appropriate.

Commit/push and STOP. Do not begin Explore V3 or any screen integration.

End with exactly one:
COMPLETE
PARTIAL
BLOCKED
FAILED
APPROVAL REQUIRED
