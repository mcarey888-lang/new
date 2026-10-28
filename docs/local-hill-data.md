# Stored local training hills

## Data and rights

This independent layer contains named OpenStreetMap `natural=peak` nodes,
including smaller hills, obtained from Geofabrik's raw `.osm.pbf` downloads.
England is imported by county; Scotland, Wales and the combined
Ireland/Northern Ireland extract complete the coverage.

The original OSM node IDs, coordinates, names, mapped alternate names and
available summit heights are preserved. A missing height remains null until
terrain sampling supplies one. Towns, roads, unclassified localities and
unnamed points are not promoted to hills.

Source data is ODbL 1.0, © OpenStreetMap contributors:
https://www.openstreetmap.org/copyright
https://www.geofabrik.de/data/download.html

The public `/api/local-hills/source` download exposes the complete imported
hill snapshot with its licence and exact extract hashes/timestamps. It does
not expose user information, storage credentials or other catalogue sources.
Keep this layer separate from private user data and independently licensed
catalogue records. Review ODbL obligations before changing redistribution.

## Storage and querying

Immutable, content-addressed JSON snapshots live under `local-hills/uk/` in
existing App Storage, with a small `current.json` pointer promoted only after
validation and upload readback. They are not committed to Git or bundled into
the mobile app. No application or engine database is replaced.

The API validates checksums, coverage, identities and record counts. It shares
one loaded snapshot between requests and checks the pointer every 15 minutes.
A broken refresh retains the previous validated snapshot and logs a warning;
a cold failure is explicit and may use the pre-existing verified catalogue
and mapped-provider fallback. No AI hills are invented for UK searches.

Area results merge mapped peaks with nearby verified catalogue candidates.
The canonical supplement requests nearest summits rather than the highest
50; the training estimator also selects nearest first. Same-name records are
only deduplicated against canonical records within 100 metres. OSM alias data
is not promoted to a new verified canonical alias.

Summit height is not training ascent. Ascents, time and loop distance retain
their terrain-estimate labels; this source does not verify walking access,
parking, trails or safety.

Imported OSM candidates retain the `seeded_osm` route-identity family understood
by installed app builds; `dataSource: osm_extract` records exact provenance.
The stable summit identity remains the real OSM node ID. Do not introduce a
new identity prefix without checking older clients' mapped-location guards.

## Refreshing

From the repository root:

```sh
bash scripts/refresh-local-hills.sh
```

This downloads and filters the regional extracts using `osmium-tool`, validates
the complete index, uploads an immutable snapshot, verifies it, then updates
the pointer. A failed download/import does not change the pointer. The API
notices a successful refresh within 15 minutes, without a code release.

Run monthly, or more often if local mapping changes warrant it. The command
is ready for a separately scheduled batch job with the existing storage
service identity; no recurring job or additional paid service is configured.
Do not run bulk extract downloads in an interactive web request.

Generated `.pbf`, XML and intermediate JSON files belong in temporary storage,
not Git. The refresh wrapper cleans its own temporary directory.

For interrupted initial imports, the Python importer supports `--resume`,
reusing only outputs less than 24 hours old. Normal refreshes do not resume old
files. Extract URLs and timestamps in the public source identify freshness.

## Reviewed local names

OSM maps Musbury Tor as **Tor Hill**, a different feature from Musbury Heights.
Independent walking references explicitly equate Musbury Tor and Tor Hill.
The reviewed alias manifest records those evidence URLs against the exact
OSM node, source name and position. It is included in the public snapshot.
Both names find the same node; display uses Musbury Tor. The original OSM
record is unchanged and no elevation, route or access facts are copied.

Aliases stop applying if the source node changes name or moves materially.
This does not establish any new verified canonical mountain alias. Additional
local names need their own evidence and identity review, not suffix guessing
or automatic promotion of locality/street names.
