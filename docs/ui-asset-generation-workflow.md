# UI asset family generation (S2-C02)

The UI asset workflow is a draft-only extension of the existing Artwork Admin
review-manifest store. It does not add database tables, alter mobile artwork,
publish, or generate the catalogue automatically.

## Reference flow

Generation resolves references in this order:

1. Explicit SummitReady global style and family art direction.
2. The immutable approved family master candidate/version (sent once, first).
3. Exact curator-selected approved same-family candidate/version descriptors.
4. Configured family additional descriptors fill only remaining slots. The API
   contract is `referenceCandidates: [{ candidateId, version }]`; these exact
   descriptors are validated and persisted, rather than resolving an ambiguous
   asset key to the latest candidate. Legacy `referenceAssets` metadata is not
   used as the authoritative reference input.
An eligible own-asset refinement candidate, if requested, is always included
second (after the master) without resolving
   it again by asset key. Duplicate candidate/version descriptors are removed.
The individual asset prompt describes the semantic difference. Required master,
refinement, and curator references are never silently truncated; if they exceed
the application cap of three, the request is rejected with available-slot
detail. Optional configured additions are the only references that may be
dropped.

For `gpt-image-1`, the server downloads approved review images from Object
Storage and passes their actual bytes to the Images Edit API (`editImages`).
Reference IDs, versions, MIME types, and immutable object paths are retained
in history for reproducibility but are not presented
to the model as a substitute for image input. The application sends at most
**three** actual references per request (family master first); this is an
application cap, not a provider maximum. With no usable approved image, the
legacy Images Generate call is used. Image input improves continuity but cannot
guarantee style fidelity.

The provider is OpenAI `gpt-image-1`. Supported candidate counts are exactly
`1`, `2`, and `4` (default `4`). Every result is `DRAFT`; selecting does not
approve it. Curators explicitly approve as an asset or family reference, reject
with a reason, and can refine by sending a selected/draft candidate as the image
reference for a new confirmed run. Family locking affects future inheritance
only; it never regenerates existing artwork.

Routes are under `/api/artwork/ui-assets`; every read, image stream and mutation
uses the shared `x-vx-admin-key`/`x-vx-admin-key-b64` admin protection:

- `GET /workflow`
- `GET /:assetKey/resolve`
- `POST /generate` (including `mode=family-master` and `familyId`)
- `GET /candidates/:candidateId/v:version/:crop`
- `POST /candidates/:candidateId/{select|reject|approve-as-asset|approve-as-family-reference}`
- `POST /families/:familyId/lock`

Families are `SIGNATURE_SYMBOLS`, `RANKS`, `ACHIEVEMENTS`, and `EDITORIAL`.
Manifest history records prompts, negative prompts, model, references, count,
candidate IDs, selection, approval state, provider, lock/unlock events, and
failures. The legacy `$0.04` value is only a rough per-output estimate; edited
outputs may differ.

Square/portrait/landscape requests use the corresponding supported model size.
Symbol, rank, and achievement derivatives preserve transparency as PNG; legacy
review batches continue to use their existing JPEG paths.