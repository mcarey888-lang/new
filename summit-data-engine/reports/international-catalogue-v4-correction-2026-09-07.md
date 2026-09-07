# International catalogue v4 correction report

## Release

- Version: `international-v4-2026-09-07`
- Archive: `attached_assets/summit-ready-international-alignment-v4-2026-09-07.zip`
- SHA-256: `6f5e432cdf1c0289cdc0e04b10bf67fc79358e57c13b44b29fce0bd89027c369`
- Rebuild command: `summit-rebuild-international`

The archive is generated deterministically from the immutable v3 upload. ZIP
member order, timestamps, permissions, compression settings, CSV serialization,
and new evidence UUIDs are fixed. Repeated rebuilds produce byte-identical files.

## Denali identity resolution

`INT-0092` was a shadow extraction of Denali, not a second mountain:

- Wikidata `Q130018` identifies Denali.
- GeoNames `5868589` identifies Denali.
- Both records had identical coordinates at `63.06933, -151.00609`.
- Both records had the same 6,190 m summit elevation.
- Ninety-nine aliases were already present on verified `INT-0252`; the only two
  additional strings were case variants of the canonical name `Denali`.

The correction removes shadow record `INT-0092`, preserves verified `INT-0252`,
adds Wikidata `Q130018` and the Alaska Range to its canonical/source metadata,
and transfers the Wikidata and GeoNames identity evidence to `INT-0252`.

## Route evidence resolution

### `IR-0005` — Mount Whitney Trail

- Evidence: U.S. National Park Service, Seeing and Climbing Mt. Whitney.
- The source states the route begins at Whitney Portal, is 17.1 km one-way, the
  trailhead is 2,550 m, and the summit is 4,421 m.
- The staged 34.2 km round-trip distance is retained with explicit QA flag
  `DISTANCE_IS_ROUND_TRIP_FROM_17_1_KM_ONE_WAY_SOURCE`.

### `IR-0007` — West Buttress

- Evidence: U.S. National Park Service, FAQ's About Mountaineering in Denali.
- The source identifies the West Buttress route and states an average expedition
  duration of 17–21 days.
- `typical_duration_hours` is corrected from the unsupported upper bound of 504
  hours to the range midpoint of 456 hours, with explicit QA flag
  `DURATION_IS_MIDPOINT_OF_17_TO_21_DAY_RANGE`.

## Corrected package counts

- 216 geometry-complete mountains: 74 verified and 142 needs review.
- 37 blocked mountains still missing geometry.
- 253 source records.
- 4,102 aliases: 4,001 unique and 101 duplicate rows.
- 489 evidence records: 452 loadable and 37 associated with blocked mountains.
- 23 routes, all supported by same-mountain evidence.

## Dry-run outcome

- Proposed inserts: 216.
- Review-status records: 142.
- Blocked missing-geometry records: 37.
- Failed records: 0.
- Canonical collisions: 0.
- Held evidence records: 0.
- Held route records: 0.
- Database mutations: 0.

No catalogue import was run. The development database retains all 21,576 DoBIH
mountains and contains zero international mountains, aliases, or route facts.