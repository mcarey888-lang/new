# Development expedition review drafts

## What the review list contains

The 32 distinct route requirements can be inspected as mapped drafts, covering
the existing 60 expeditions/120 stages. This does **not** mean 32 verified named
hiking itineraries have been acquired.

- The retained Watkin and Aonach source revisions remain separate from newly
  proposed itineraries.
- Eleven proposed drafts were routed over downloaded OpenStreetMap path nodes.
  Segments follow existing eligible edges; disconnected graphs fail instead of
  receiving invented straight-line joins.
- Nineteen proposed drafts use the existing openrouteservice `foot-hiking`
  provider through hand-selected reference waypoints. Its path may choose a
  detour or a different variant. These results carry CC-BY-SA 4.0 attribution
  and remain subject to explicit rights/access review.
- Peak names, waypoint labels and approximate starting references are not
  canonical navigation verification. A nearby path node is not a confirmed
  parking pin.
- No elevation profile, canonical binding, safety clearance, or technical
  approval is inferred from a mapped line or positive owner map feedback.
- Large differences from existing expedition distance estimates are flagged.
  Neither number is automatically treated as correct; expedition figures stay
  unchanged.

## Owner workflow

In Artwork Admin → Route Reviews (DEV), select the latest route draft, inspect
the saved map, and choose **Edit draft route**. The embedded editor is the same
planner served by the application, with a development-review import/save
adapter, not a separate routing implementation.

Use the map draw/drag controls and Undo/Clear as appropriate. Trim removes
points from the original working line. **Extend start** temporarily reverses
the working route so the original start becomes the editable endpoint; saving
restores its original direction. Manual straight legs remain explicitly
unconfirmed.

**Save as new draft** appends a new immutable revision. It never changes the
parent track or its feedback. New edits receive no inherited canonical
binding, elevation profile, map feedback, validation or approval. Inspect the
saved result before recording **Route looks correct**.

Older revisions, including the original partial Ben Nevis arête and its
needs-changes feedback, are available under **Show older revisions (history)**.
The latest-only list groups revisions by expedition route requirement.

Concurrent stale edits return 409 rather than overwrite a newer draft.
Transient polling failures retain the existing editor and working geometry.
Unsaved changes prompt before cancellation or selecting a different route.
Draft edits are not automatically recoverable after closing the browser.

## Acquisition and verification

- `scripts/prepare-expedition-network-drafts.py`: sanitized OSM evidence and
  connected shortest-path drafts through explicitly proposed waypoints.
- `scripts/expedition-network-itineraries.json`: proposed reference anchors,
  not certified itineraries.
- `artifacts/api-server/scripts/prepare-expedition-hosted-drafts.ts`: existing
  provider fallback, one request per missing itinerary, max 30 requests,
  reserving the app's shared free quota before calling. No paid-plan change.
- `artifacts/api-server/scripts/import-expedition-route-sources.ts`: preview
  by default; `--directory=../../generated-artifacts/expedition-network/prepared
  --commit` stores protected evidence and unbound development review records.
  It asserts that expeditions, stages, map feedback, validations and technical
  decisions are unchanged.
- `artifacts/api-server/scripts/test-route-review-edit.ts`: real save,
  immutable-parent, reset-approval and stale-edit assertions with memory-only
  evidence storage and a full database rollback.

Generated acquisition files are ignored under `generated-artifacts/`. Source
snapshots retain licence/source hashes and omit OSM contributor identifiers.
Respect provider throttling; never bypass rate limits to complete a batch.
The whole public OSM map API is not an unlimited bulk-extract service.

These tools must not publish routes or alter live expeditions, stages, recorded
activities, distances, readiness, or user progress. Technical publication
remains a separate explicitly authorized workflow.
