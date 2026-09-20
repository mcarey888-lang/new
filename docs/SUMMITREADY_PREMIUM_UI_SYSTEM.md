# SummitReady Premium UI System

**Gate:** MV-C04

## Principles

1. Imagery is structural: it establishes objective, mode and hierarchy.
2. Dark navy/charcoal surfaces support terrain rather than competing with it.
3. One action dominates each screen; secondary links remain visibly secondary.
4. Remove card-within-card decoration before adding new containers.
5. Use sentence-case labels; reserve uppercase for genuine compact metadata.
6. Training and Expedition remain immediately distinguishable.
7. Navigation remains **Basecamp | Explore | Track | Expeditions | You** with
   Track visually central.

## Foundation

The existing `T` theme remains canonical. The Training Basecamp pilot adds
bounded `basecamp*` tokens for deep natural background, surface, border and
text hierarchy. Existing green, blue, orange, red and purple keep their
semantic meanings.

### Type

- Display/objective: 28–40, bold, tight line height.
- Section: 18–24, semibold/bold.
- Body: 14–16, regular/medium.
- Supporting: 12–13; never below 10 for meaningful content.
- Metrics pair a dominant value with a quieter unit/label.

### Space and shape

- Base rhythm: 4, 8, 12, 16, 20, 24, 32.
- Use 12–16 radii for controls and 18–24 only for major surfaces.
- Use borders sparingly to separate interactive or status regions.
- Prefer one parent surface with dividers over nested standalone cards.

### Imagery and overlays

- Cover crop with stored focal point.
- Layer a light top vignette and strong bottom readability fade.
- Keep primary text and actions out of the unsafe crop region.
- Image failure uses a branded atmospheric gradient, never broken media.

## Component guidance

- **StructuralHero:** approved/published image first, current resolver fallback,
  objective title, concise metadata and accessible edit action.
- **MissionControl:** week/status/progress plus one dominant next action.
- **MetricStrip:** flat grouped metrics with minimal separators.
- **StatusSurface:** restrained semantic tint, short explanation and one route.
- **ModeSwitch:** persistent Training/Expedition identity without resetting
  state.

## Pilot finding

Training Basecamp can achieve the premium direction without changing product
semantics: increase the mountain hero’s structural role, flatten the page
background, consolidate mission/progress, and normalise secondary surfaces.
Broad migration remains explicitly out of scope.
