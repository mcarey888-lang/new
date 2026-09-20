# SummitReady Media Studio curation workflow

## Scope

This document covers development-only Flagship Artwork Batch 01 curation and
the bounded Signature/Mountain Hero administration safeguards. It does not
authorize Stage 9, production publication, production data changes, or another
generation batch.

## Editorial states

```text
Generate → REVIEW REQUIRED → APPROVED → PUBLISHED
                           ↘ REJECTED
```

- **REVIEW REQUIRED** means a generated version is waiting for visual review.
- **APPROVED** means that exact immutable version passed visual review.
- **REJECTED** is an editorial state on that exact version. Its image, prompt,
  derivatives, generation metadata, cost, and history remain available.
- **PUBLISHED** would allow production/app consumers to use the version.
  Publication is deliberately unavailable in this implementation because the
  persistent Media catalogue does not yet exist.

Approval never implies publication.

## Batch 01 persistence

Batch 01 remains isolated under its Object Storage review-batch prefix. The
manifest now stores:

- the current version for each of the 12 assets;
- every immutable generated version;
- exact prompt, placement, provider/model, cost, timestamps, and crop paths;
- per-version review status and rejection reason;
- the append-only generation attempt ledger.

No production database or schema migration is required. Review mutations and
generation share the same renewable cross-process Object Storage lease.
Manifest writes use the exact previously read Object Storage generation as a
compare-and-swap precondition, so a stale holder cannot overwrite newer
version/status/attempt history.

## Review actions

### Approve

Approve targets one asset ID and one exact version. It changes only that
version to `APPROVED`, keeps `published=false`, and does not regenerate.

### Reject

Reject targets one exact version and requires an objective reason. It changes
the version to `REJECTED` without deleting any source object or history.

### Regenerate

Regenerate requires:

- one asset ID;
- one allowlisted objective-failure reason;
- explicit confirmation showing title, provider/model, and estimated cost.

Only that asset is generated. The next monotonically increasing immutable
version returns to `REVIEW REQUIRED`. Initial generation plus two
regenerations remains the hard ceiling.

### Publish

Publish is visible as an unavailable action with an explanation. There is no
publication endpoint and Batch 01 cannot become production-visible through
this development review manifest.

## Bulk generation safety

Signature bulk generation no longer discovers every active target on the
server. The client must provide an explicit curated list, confirmation, and
matching expected count. The server rejects empty lists, count mismatches, and
lists over 25. The confirmation shows image count, provider/model, and
estimated cost.

Mountain Heroes are a separate catalogue and are never included by the
Signature bulk endpoint. Their admin screen supports search, review status,
sorting, page jump, and an explicit curated queue selection. No action can
implicitly target the full catalogue.

## Environment boundary

Batch 01 manifest and image routes fail closed unless
`NODE_ENV === "development"`. The Assets screen is also compiled into
navigation only under Vite development mode. Production app consumers do not
read review-batch paths or states.

## Human review boundary

No Batch 01 version was approved, rejected, regenerated, or published while
this workflow was implemented. The human reviewer owns every editorial action.