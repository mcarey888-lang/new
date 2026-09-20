# SummitReady Motion System

**Gate:** MV-C05

## Hierarchy

| Level | Use | Default |
|---|---|---|
| Ambient | Subtle atmosphere or hero depth | 8–20s, low amplitude, optional |
| Interface | Entrance, disclosure, selection, metric transition | 180–500ms |
| Meaningful | Elevation, Readiness response, DNA reveal, Rank ascent | 450–900ms, data-bound |
| Celebratory | Earned achievement/challenge feedback | 700–1600ms, once per event |
| Cinematic | Protected Expedition summit sequence | Existing protected system only |

## Timing and easing

- Press/selection feedback: 120–180ms.
- Small disclosure/state change: 180–260ms.
- Screen section entrance: 320–500ms.
- Meaningful data transition: 450–900ms.
- Use ease-out for entrances, ease-in-out for reversible movement and spring
  only for direct manipulation or earned feedback.
- Stagger no more than 40–80ms between adjacent sections.

## Behaviour

- Motion must be interruptible; new user input wins immediately.
- Never delay navigation, saving, tracking or safety information for animation.
- Do not loop attention-seeking motion around primary metrics or controls.
- Animate transformed/opacity properties where possible; avoid layout thrash.
- Keep simultaneous animated layers low on older devices.

## Reduced motion

- Replace parallax/ambient loops with a static final frame.
- Replace large spatial travel with short opacity transitions.
- Render meaningful progress in its final accurate state without animation.
- Celebrations become a static confirmation with equivalent text.
- The protected Expedition sequence keeps its existing accessible fallback.

## Implementation preference

Use Reanimated, native/SVG or procedural motion for UI and data. Use Lottie
only for a reviewed reusable vector asset. Use video only when photographic
cinematic content cannot be represented efficiently by native motion.

MV’s implemented prototype reuses the existing `FadeInDown` entrance for the
Training Basecamp mission surface. It does not alter Progress Mountain,
Mountain DNA, Readiness calculations or protected cinematics.
