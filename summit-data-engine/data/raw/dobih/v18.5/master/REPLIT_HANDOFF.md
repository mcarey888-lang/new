# Replit handoff — Summit Ready DoBIH v18.5

The data-preparation work has already been completed outside Replit to save build credits.

## What Replit should do
1. Inspect the existing `summit-data-engine` PostGIS schema.
2. Map the supplied import-ready CSV columns to the existing summit/source/provenance models.
3. Apply only any small backwards-compatible migration actually required.
4. Import idempotently using DoBIH `Number` + source/version identity.
5. Store `Metres` as summit elevation and `Drop` as prominence.
6. Preserve source provenance and review statuses.
7. Keep DoBIH ID 15584 (Grassholm Island) as `needs_review`.
8. Keep DoBIH ID 1965 (Carnedd Llewelyn) at 1061.8 m with its informational revision note.
9. Run count, spatial, duplicate-ID, and benchmark lookup tests.
10. Do not change production Summit Ready lookup logic in the same task.

## Do not spend Replit credits on
- source downloading
- CSV parsing/normalisation
- country filtering
- QA generation
- spreadsheet generation
- AI research/review
These are already complete in this package.

## Lookup policy for the later integration task
Database first → trusted external geographic source → AI fallback.
AI must never silently overwrite a trusted database value.
