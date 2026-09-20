# Training Basecamp Approved Artwork Diagnostic and Fix

**Date:** 2026-09-20 UTC  
**Scope:** Approved Mont Blanc artwork consumption only  
**Status:** Complete

## Root cause

Training Basecamp requested approved artwork with `fetch` from the API origin,
but the API CORS allowlist did not include the Expo web development origin.

The browser request to:

`/api/artwork/resolve/SR-MTN-MONTBLANC-001/hero`

was rejected with HTTP 500 and:

`CORS: origin not allowed`

The resolver caught that failure and returned `null`. Basecamp then silently
rendered its normal mountain-image fallback. Cross-origin `<Image>` loading did
not need the fetch CORS permission, so the fallback loaded successfully and
looked like an intentional hero.

## Image previously rendered

The pre-fix browser network and DOM trace proved that Basecamp rendered:

`https://c845fd48-4223-49a2-a54f-cbec8cb8f5c3-00-32e0r8ryvemws.spock.replit.dev/api/mountain-image?name=Mont%20Blanc`

Observed source properties:

- source: existing mountain-image fallback;
- dimensions: `960×202`;
- SHA-256:
  `a46dfe8b581b694828d1692909439a3b49c895fde5881e8d20afed4c29ae1915`;
- appearance: cold blue valley with jagged peaks.

The correct approved-artwork resolve request was issued but never became the
rendered image.

## Persisted approved asset verified

The persisted Batch 01 manifest contains:

- asset ID: `SR-MTN-MONTBLANC-001`;
- title: `Mont Blanc — Alpine Dawn`;
- current version: `1`;
- status: `APPROVED`;
- `approved=true`;
- `published=false`;
- source master dimensions: `1536×1024`;
- hero derivative manifest path:
  `/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero`;
- hero object path:
  `expedition-artwork/review-batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero.jpg`.

The versioned Artwork Admin hero derivative and stable approved stream are
byte-for-byte identical:

- hero derivative dimensions: `1536×864`;
- SHA-256:
  `610126306e01687bb3c00c485a3321e43ad4cce48d12d86e63504f88f311bd7b`.

## Fix

### API origin and identity contract

- Added the Replit Expo development domain to the API CORS allowlist.
- Added development-only loopback origins for direct Metro visual QA.
- Kept production origins unchanged.
- Extended the development-only approved resolver response with the exact
  approved `version` and versioned `derivativePath`.
- The stable image stream remains:
  `/api/artwork/approved/SR-MTN-MONTBLANC-001/hero`.
- Publication state remains unchanged.

### Mobile resolver and rendering

The Training Basecamp resolver now accepts a response only when all of these
match the requested visual-QA contract:

- asset ID `SR-MTN-MONTBLANC-001`;
- version `1`;
- placement `hero`;
- derivative path
  `/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero`.

A URI by itself is no longer sufficient. The request also has a bounded timeout.

Basecamp now waits for the approved-artwork decision before selecting its image
source. In development it logs one observable source decision:

- `approved`, with asset ID, version, placement, and URI;
- `mountain-image`, with URI and failure reason;
- `gradient`, with failure reason.

## Final runtime result

The post-fix real browser trace recorded:

1. HTTP 200 from
   `/api/artwork/resolve/SR-MTN-MONTBLANC-001/hero`;
2. response identity:
   `SR-MTN-MONTBLANC-001`, version `1`, placement `hero`, exact v1 hero
   derivative path;
3. HTTP 200 image load from
   `https://c845fd48-4223-49a2-a54f-cbec8cb8f5c3-00-32e0r8ryvemws.spock.replit.dev/api/artwork/approved/SR-MTN-MONTBLANC-001/hero`;
4. final DOM image dimensions `1536×864`;
5. no mountain-image request in the successful final load;
6. development console diagnostic `[Basecamp hero source]` with source
   `approved`.

The final screenshot clearly shows the same composition as Artwork Admin:
broad Mont Blanc massif, golden dawn light across the snow, central glacier,
and dark foreground.

## Fallback behavior

The existing fallback order is preserved:

1. exact approved Mont Blanc v1 hero;
2. existing `mountain-image?name=Mont%20Blanc` if resolution, identity
   validation, timeout, or approved image rendering fails;
3. existing branded gradient if the mountain image also fails.

Fallback use is now observable in development rather than silent.

## Tests and verification

- SummitReady artwork resolver focused suite: **1 file / 8 tests passed**.
- SummitReady configured regression: **25 files / 166 tests passed**.
- API approved artwork/review regression: **2 files / 7 tests passed**.
- SummitReady TypeScript: **passed**.
- API production bundle build: **passed**.
- Expo-origin CORS request: **HTTP 200** with matching
  `Access-Control-Allow-Origin`.
- Loopback visual-QA CORS request: **HTTP 200** with matching
  `Access-Control-Allow-Origin`.
- Versioned derivative/stable stream byte comparison: **identical**.
- Real browser network, DOM, source diagnostic, and visual comparison:
  **passed**.
- `git diff --check`: **passed**.

## Screenshot

Fresh real 390×844 Training Basecamp first viewport:

`docs/visual-qa/premium-basecamp-v2/approved-artwork-fixed-first-viewport.png`

## Boundaries

No visual redesign, new artwork generation, approval, publication, deployment,
release, production schema/data, Readiness, Mission Control, Elevation Bank,
navigation, Training logic, development profile semantics, Progress Mountain,
cinematic behavior, or other-screen change occurred.