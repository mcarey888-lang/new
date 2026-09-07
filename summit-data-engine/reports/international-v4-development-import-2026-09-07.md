# International catalogue v4 development import report

## Scope and safety

- Environment: development only
- Checkpoint: checkpoint-before-international-v4-dev-import-20260907
- Checkpoint commit: 7fc80d7711966ce1b4dff428ccec8a29a06e158f
- Tracked archive: attached_assets/summit-ready-international-alignment-v4-2026-09-07.zip
- Verified SHA-256: 6f5e432cdf1c0289cdc0e04b10bf67fc79358e57c13b44b29fce0bd89027c369
- Migration: 0006_international_catalogue
- Production was not queried or changed.
- Runtime lookup code was not changed.

## Pre-import baseline

| Dataset | Rows | Fingerprint |
|---|---:|---|
| DoBIH mountains | 21,576 | c76d377ac1e06814cf3d3a2718b69464 |
| DoBIH source records | 21,576 | 0c3b8a92460d0b71082161f29041f001 |
| DoBIH classifications | 33,369 | bd8dbdc4235d3fdbae1c6d2d993ee5ca |
| International mountains | 0 | d41d8cd98f00b204e9800998ecf8427e |
| Mountain aliases | 0 | d41d8cd98f00b204e9800998ecf8427e |
| Evidence sources | 0 | d41d8cd98f00b204e9800998ecf8427e |
| Mountain verifications | 0 | d41d8cd98f00b204e9800998ecf8427e |
| Route identities / definitions / facts | 0 / 0 / 0 | empty-table fingerprint |

## Final dry-run gate

- 216 geometry-complete mountains: 74 verified and 142 needs review.
- 37 coordinate-blocked records excluded.
- 253 source rows; 216 proposed.
- 4,102 staged aliases; 4,001 unique after normalization; 101 duplicates.
- 489 evidence records; 452 loadable; 37 blocked; 0 held.
- 23 routes; 23 loadable; 0 held.
- 0 failures, 0 identity collisions, and 0 database mutations.
- Denali resolves only to INT-0252; INT-0092 is absent.
- Cho Oyu remains needs_review.

## First transactional apply

- Mountains inserted: 216
- Source records inserted: 216
- Unique aliases inserted: 4,001
- Evidence sources inserted: 452
- Mountain verifications inserted: 216
- Verification-evidence links inserted: 452
- Route identities inserted: 23
- Route definitions inserted: 23
- Route facts inserted: 23
- Blocked: 37
- Failed: 0

## Trust and integrity validation

- Verified / trusted_source: 74
- needs_review / needs_review: 142
- Cho Oyu: needs_review
- Duplicate canonical keys: 0
- Alias/source mountain mismatches: 0
- Verification-evidence mountain mismatches: 0
- Route-evidence mountain mismatches: 0
- Mountain/source elevation mismatches: 0
- Route-related mountain elevation mismatches: 0
- Denali shadow rows: 0
- Final international ID set exactly matches the 216 dry-run-approved IDs.

## Preserved data

DoBIH counts and factual fingerprints are unchanged after both applies:

| Dataset | Rows | Fingerprint |
|---|---:|---|
| Mountains | 21,576 | c76d377ac1e06814cf3d3a2718b69464 |
| Source records | 21,576 | 0c3b8a92460d0b71082161f29041f001 |
| Classifications | 33,369 | bd8dbdc4235d3fdbae1c6d2d993ee5ca |

Protected runtime tables are also unchanged:

| Table | Rows | Fingerprint |
|---|---:|---|
| cached_mountains | 56 | 889eaedd887d97d4bc719203acb8d049 |
| canonical_hills | 0 | d41d8cd98f00b204e9800998ecf8427e |
| virtual_expeditions | 0 | d41d8cd98f00b204e9800998ecf8427e |

## Idempotency apply

The identical second apply was a no-op:

- Inserted: 0
- Updated: 0
- Failed: 0
- Canonical/source rows unchanged: 432 (216 mountains plus 216 source records)
- Aliases unchanged: 4,001
- Evidence unchanged: 452
- Routes unchanged: 23
- Every affected table fingerprint exactly matches the post-first-import fingerprint.

## Representative checks

name,source_feature_id,canonical_source_key,status,elevation_m,aliases,evidence_links,route_identities
Cho Oyu,INT-0104,geonames:1280210,needs_review,8188,47,3,0
Denali,INT-0252,geonames:5868589,verified,6190,96,4,1
Jbel Toubkal,INT-0159,geonames:2526906,verified,4167,27,3,0
Mont Blanc,INT-0001,geonames:3181986,verified,4808.73,66,2,0
Mount Fuji,INT-0251,geonames:1864094,verified,3776,11,1,4
Mount Kilimanjaro,INT-0084,geonames:157452,verified,5895,98,4,6
Mount Whitney,INT-0136,geonames:5409018,verified,4421,48,3,1

