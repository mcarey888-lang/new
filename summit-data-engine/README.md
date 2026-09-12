# Summit Data Engine

Standalone Python proof of concept for deterministic mountain and hiking-route
data. It is intentionally independent from Atlas and the production SummitReady
application.

## Non-negotiable data rule

Coordinates, route connections, elevation, distance, gradients and ascent are
accepted only from preserved datasets or explicit deterministic calculation.
Missing or conflicting evidence is reported as `needs_review`; the engine never
asks an AI model to fill gaps or silently repairs geography.

## Repository boundary

This directory is a complete project and can be copied into an empty repository
without modification. It has no pnpm package, no Atlas imports, no workspace
dependencies and no production SummitReady integration.

The database layer reads only `ENGINE_DATABASE_URL`. It never reads or falls
back to a generic `DATABASE_URL`. Engine-owned data tables and enum types live
in PostgreSQL's `public` schema so the API can use the normal shared search
path. The legacy `summit_data_engine` schema is retained only for
`alembic_version`, which keeps the existing revision chain and blank-database
bootstrap compatible.

## Inputs used by the Tryfan proof of concept

- OpenStreetMap Wales PBF from Geofabrik. The exact downloaded file is preserved
  locally and identified by SHA-256.
- Copernicus DEM GLO-30 Cloud Optimized GeoTIFFs from AWS Open Data. Canonical
  tiles are planned from exact accepted route geometry; every supplied tile is
  preserved locally and identified by SHA-256.
- A complete versioned route/mountain evidence package, including factual
  anchors and explicit geometry-rights decisions.
- `config/tryfan_topology_acquisition.json`, an independently hashed,
  versioned acquisition dossier recording accepted, partial, rejected, and
  unavailable topology candidates and their rights decisions.

Both files are ignored by Git. Attribution, source URL, retrieval time, file
size, hash, CRS and processing versions are written to the generated manifest.

## Setup

Use Python 3.11. Install the project and development dependencies using the
dependency manager of the destination repository:

```bash
python -m pip install -e '.[dev]'
```

Copy `.env.example` to `.env` only when using an isolated engine database.

## Database

Migrations are owned by this repository:

```bash
alembic upgrade head
```

PostGIS must be available in the engine database. Never point the migration at
the Atlas or production SummitReady database. Revision `0007` transactionally
moves the tables, enum types, and immutable-field trigger function from the
legacy schema to `public`; it performs collision checks first and can be
reversed with `alembic downgrade 0006_international_catalogue`.

## Reviewed DoBIH master import

The database importer consumes only the externally reviewed 125-column master
CSV. It independently hashes the retained original `DoBIH_v18_5.csv`, then
verifies that hash, the archive and the import CSV before opening a database
transaction. `Metres`, `Drop` and `Col height` remain
independent source facts; repeated names are permitted and identity is always
DoBIH `Number` plus release version.

Preserve the master package under
`data/raw/dobih/v18.5/master/`, apply migrations to an explicitly selected
development engine database, then import:

```bash
ENGINE_DATABASE_URL="$DATABASE_URL" alembic upgrade head
ENGINE_DATABASE_URL="$DATABASE_URL" summit-import-dobih \
  --report-output data/processed/dobih/v18.5/import-report.json
```

The command is transactional and idempotent. A second identical run reports
every Mountain, source record and classification as unchanged. It also validates
counts, provenance, source statuses and PostGIS geometry, then benchmarks exact
ID, name and nearest-hill lookups. It does not change Summit Ready application
lookup behavior.

## Wales DoBIH review preparation

## International catalogue validation

The international catalogue command is dry-run by default and makes no database
changes. Pass the supplied archive directly:

```bash
summit-import-international path/to/international-catalogue.zip
```

The corrected v4 source package is reproducible from the immutable v3 upload:

```bash
summit-rebuild-international \
  ../attached_assets/0_summit-ready-international-alignment-upload_1788803262874.zip \
  ../attached_assets/summit-ready-international-alignment-v4-2026-09-07.zip
```

The rebuild removes the duplicate Denali shadow record, transfers its identity
evidence to the verified Denali record, and adds exact NPS evidence for the two
previously held routes. ZIP member order, timestamps, permissions, CSV encoding,
UUID generation, and compression settings are deterministic.

`--apply` is deliberately required for a future transactional import. Do not use
it against a production or shared database.

The separate review-only DoBIH pipeline downloads the current official CSV archive,
preserves it by release and hash, selects every source row with `Country == W`,
runs deterministic QA, and produces CSV, XLSX, JSON and documentation exports.
It does not open a database connection:

```bash
python scripts/prepare_wales_dobih_review.py
```

Generated files are written below `data/raw/dobih/` and
`data/processed/dobih/` and are ignored by Git.

## Tryfan proof of concept

Place the real source files under `data/raw/`, then run:

```bash
python scripts/import_tryfan.py \
  --osm-pbf data/raw/wales-latest.osm.pbf \
  --dem data/raw/Copernicus_DSM_COG_10_N53_00_W004_00_DEM.tif \
  --output data/processed \
  --osm-provider "Geofabrik GmbH / OpenStreetMap contributors" \
  --osm-source-url \
    "https://download.geofabrik.de/europe/united-kingdom/wales-latest.osm.pbf" \
  --osm-licence "Open Database License 1.0" \
  --osm-retrieved-at "2026-08-24T17:36:56Z" \
  --dem-provider "Copernicus DEM GLO-30 via AWS Open Data" \
  --dem-source-url \
    "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/Copernicus_DSM_COG_10_N53_00_W004_00_DEM/Copernicus_DSM_COG_10_N53_00_W004_00_DEM.tif" \
  --dem-licence "Copernicus DEM Licence" \
  --dem-retrieved-at "2026-08-24T17:36:56Z" \
  --summit-locator-json data/raw/tryfan_nominatim.json \
  --summit-locator-source-url \
    "https://nominatim.openstreetmap.org/search?q=Tryfan%2C%20Wales&format=jsonv2&limit=5&extratags=1" \
  --summit-osm-id 29580544

python scripts/validate_tryfan.py \
  --manifest data/processed/tryfan_manifest.json
```

The importer first discovers the `Tryfan` summit from OSM. Its source coordinate
is then used to define the local extraction bounds. Named route geometry is
accepted only when `resolve_ordered_route` produces one exact chain from an OSM
relation's ordered way members and source node IDs. Named geometry without this
topology remains `needs_review`. Missing planned DEM tiles stop processing
before metrics. If no exact named relation exists, exactly one dossier candidate
may be evaluated only when it is `accepted`, has reusable rights, supplies the
complete ordered way/node topology, and names exactly one immutable reusable
source whose SHA-256 exactly matches the imported PBF.
Partial chains are never routed, snapped, gap-filled, or rendered as accepted
routes. When a partial dossier record supplies exact topology, the engine still
re-evaluates its versions, tags, ordered node IDs, and gaps against the matching
hashed PBF, records the strict diagnostics, and then enforces a state gate that
strips any geometry. The v2 manifest embeds the complete evidence and acquisition packages, mountain
review, DEM plan, raw and smoothed profile samples, and source hashes. Review
output includes HTML, Markdown, and a hash index covering every generated file.
Validation re-ingests the hashed PBF and DEM inputs and recomputes ordered
topology, validation results, coverage, and profiles before accepting the
manifest.

After elevation and route validation, publication is universally fail-closed:
any route not left in `processed` state has its geometry and elevation profile
discarded and cannot emit route GeoJSON, profile JSON, or derived route metrics.
Its diagnostics and the neutral OSM candidate path network remain available for
review.

To acquire inputs without inventing route geometry, pass canonical tile IDs
(repeat `--tile-id`) or a source-backed GeoJSON geometry:

```bash
python scripts/download_tryfan_sources.py --output data/raw \
  --tile-id Copernicus_DSM_COG_10_N53_00_W004_00_DEM
```

## Tests and quality

```bash
pytest
ruff check .
mypy src
```

Synthetic profiles provide known expected ascent, descent, smoothing and
distance outputs. Geometry, connectivity and duplicate checks are also covered.
