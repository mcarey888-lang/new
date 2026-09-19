# Stage 7 Mountain DNA Model

**Checkpoint:** S7-C04 / S7-R04
**Model version:** `mountain-dna-v1`

Mountain DNA is a deterministic route-to-route comparison of already-audited
route facts. It is not an AI opinion, geographic matcher, route generator, or
replacement for SDE verification.

## Eligibility and evidence

Both target and candidate must have:

- SDE `engineStatus: "verified"`;
- product lifecycle `summitready_verified`;
- reusable geometry rights;
- stable versioned route identity.

If either route does not meet this boundary, the evaluator returns
`unavailable`, excludes every score, and explains the provenance/trust reason.
`needs_review`, `rejected`, generated, compatibility-only, or rights-unclear
records are never made to look verified.

## Dimensions and weights

The initial weights are deliberately modest, explainable defaults rather than
marketing tuning. They can only be changed by a future versioned model:

| Dimension | Weight | Formula/source |
| --- | ---: | --- |
| Ascent demand | 0.35 | `100 * (1 - abs(target-candidate) / max(target,candidate))`, bounded 0–100 |
| Distance | 0.25 | Same symmetric ratio similarity |
| Steepness | 0.20 | Mean sourced grade; otherwise transparent `ascent / distance * 100` derivation |
| Terrain | 0.10 | Exact comparison of genuinely sourced categories |
| Technical character | 0.10 | Exact comparison of genuinely sourced categories |

Only dimensions with valid facts on both routes participate; the available
weights are renormalized. Equal zero values score 100, while zero versus a
non-zero value scores 0. Categorical values are exact, case-insensitive
comparisons; no fuzzy semantics are introduced.

Altitude is scored only when both routes have sourced summit elevation and is
currently weight 0 because it is optional context, not a tuned similarity
dimension. Exposure and profile-shape comparison are explicitly unknown because
the current trusted contracts do not provide those facts reliably.

## Result semantics

The result always includes model version, route IDs, every dimension, missing
dimensions, evidence labels, explanations, confidence, and state:

- `ready`: all weighted dimensions are available (optional unweighted
  dimensions may still be explicitly unknown);
- `degraded`: at least one weighted dimension is unavailable but a bounded score
  can be calculated;
- `unavailable`: no trustworthy score can be calculated.

Confidence is `high` with four or more scored dimensions, `moderate` with two or
three, `low` with one, and `unavailable` with none. Unknown dimensions are
excluded, never imputed. No score implies route safety, weather, exposure,
technical capability, or a verified geography beyond the supplied evidence.

The pure implementation is
`artifacts/summit-ready/utils/mountainDna.ts`; it has no network, clock,
randomness, AI, persistence, or side effects.