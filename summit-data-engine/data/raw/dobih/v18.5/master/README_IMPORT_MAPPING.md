# Summit Ready DoBIH v18.5 import package

This package is prepared for the existing `summit-data-engine` PostGIS schema.

## Source facts
- Use `Metres` as summit elevation.
- Use `Drop` as prominence. Do **not** recompute prominence as `Metres - Col height`.
- Preserve `Col height` separately.
- Never identify or deduplicate hills by name alone; use DoBIH `Number` as the stable source ID.
- Store canonical internal ID/UUID separately; `summit_ready_canonical_id` is a deterministic import key only.

## Trust/status
- `trusted_source`: DoBIH-backed record suitable as Summit Ready's primary UK/Ireland factual summit source.
- `needs_review`: preserve source data but do not silently promote/correct.
- DoBIH ID 15584 (Grassholm Island) is explicitly `needs_review`.
- DoBIH ID 1965 (Carnedd Llewelyn) retains 1061.8 m with an informational recent-revision note.

## Lookup priority
1. Summit Ready database.
2. Trusted external geographic lookup only when required data is missing.
3. AI fallback only as a last resort.
4. AI-derived geographic facts must carry provenance and must not overwrite database values without review.

## Route data
No hiking routes, parking, trailheads, or route elevation gain are included in this package.
