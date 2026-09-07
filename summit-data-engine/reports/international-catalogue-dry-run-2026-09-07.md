# SummitReady international catalogue migration and dry-run report

**Date:** 7 September 2026  
**Scope:** Development schema and importer support only. No international catalogue rows imported. No production changes. No mountain-lookup changes.

## Checkpoint and source

- Git checkpoint tag: `checkpoint-international-catalogue-pre-schema-20260907`
- Baseline commit: `3a1e657a8684225bdff7e6c879712e6209be78ca`
- Source archive: `attached_assets/0_summit-ready-international-alignment-upload_1788803262874.zip`
- Archive SHA-256: `6a5eb583694de6e8c42daf7bd1d985b393955745b26856ef3b575fcc63e45ad4`
- Catalogue version: `international-v3-2026-09-06`
- Source-row hash convention: SHA-256 of exact UTF-8 `raw_payload` JSON text; raw and prepared payloads are also parsed and cross-validated.

## Development migration

- Revision: `0006_international_catalogue` (head).
- Source prominence, col height, and grid reference are nullable.
- Added Unicode-capable `mountain_aliases` with provenance/evidence links and lookup indexes.
- Added versioned `route_facts`; route ascent/descent remains separate from summit elevation.
- After all checks: 0 aliases, 0 route facts, and 0 non-DoBIH mountains.

## DoBIH preservation proof

| Dataset | Before | After | Identical full-row digest |
|---|---:|---:|---|
| Mountains | 21,576 | 21,576 | `c76d377ac1e06814cf3d3a2718b69464` |
| Source records | 21,576 | 21,576 | `0c3b8a92460d0b71082161f29041f001` |
| Classifications | 33,369 | 33,369 | `bd8dbdc4235d3fdbae1c6d2d993ee5ca` |

## Database-aware dry run

The original archive was run repeatedly with the expected archive hash. Reports were identical and `database_mutations` remained `0`.

| Outcome | Count |
|---|---:|
| inserted | 215 |
| updated | 0 |
| unchanged | 0 |
| reviewed | 144 |
| blocked | 37 |
| failed | 0 |

### Staged auxiliary records

- Source records: 254 staged; 215 proposed.
- Aliases: 4,203 staged; 4,098 unique; 105 duplicates; 3,905 loadable; 193 held.
- Evidence: 487 total; 447 loadable; 3 held; 37 blocked.
- Routes: 23 total; 21 loadable; 2 held.
- Accepted status split: 73 verified; 142 needs review.
- Review queue: 181 entries (144 review/hold + 37 blocked missing geometry).

## Collision and match decisions

- `INT-0092` (`Q130018`) and `INT-0252` (`Denali`) share `geonames:5868589`; both are held.
- No exact-key or proximity match to DoBIH. Name-only signals never merged records.
- Mauna Kea alias `White Mountain` overlaps DoBIH 20689/20724; insert retained.
- Table Mountain overlaps DoBIH 20572; insert retained.
- Sugarloaf Mountain overlaps DoBIH 15048/15696/20642; insert retained.
- Mount Ida overlaps DoBIH 16361; insert retained.
- `IR-0005` Mount Whitney Trail held: same-mountain evidence URL missing.
- `IR-0007` West Buttress held: parent mountain held and same-mountain evidence URL missing.

## Verification

- Full database-gated suite: **37 passed**.
- Ruff passed; mypy passed; `git diff --check` passed.
- Transaction rollback and repeat-import no-op behavior passed.
- `/api/mountain-lookup` has no diff.
- API workflow built and started; clean direct and proxied health requests returned `200 {"status":"ok"}`.
- `alembic check` reports historical constraint-name drift in restored 0001–0005 metadata. Upgrade/current, explicit schema checks, and all gated tests pass; no drift migration was generated or applied.

## Files changed or restored

- `summit-data-engine/.gitignore`
- `summit-data-engine/README.md`
- `summit-data-engine/alembic.ini`
- `summit-data-engine/alembic/env.py`
- `summit-data-engine/alembic/script.py.mako`
- `summit-data-engine/alembic/versions/0001_isolated_engine_schema.py`
- `summit-data-engine/alembic/versions/0002_evidence_rights_and_versioned_routes.py`
- `summit-data-engine/alembic/versions/0003_dobih_hill_catalogue.py`
- `summit-data-engine/alembic/versions/0004_release_fact_snapshots.py`
- `summit-data-engine/alembic/versions/0005_api_lookup_indexes.py`
- `summit-data-engine/alembic/versions/0006_international_catalogue.py`
- `summit-data-engine/pyproject.toml`
- `summit-data-engine/reports/`
- `summit-data-engine/reports/international-catalogue-dry-run-2026-09-07.json`
- `summit-data-engine/reports/international-catalogue-dry-run-2026-09-07.md`
- `summit-data-engine/src/summit_data_engine/__init__.py`
- `summit-data-engine/src/summit_data_engine/config/__init__.py`
- `summit-data-engine/src/summit_data_engine/config/policy.py`
- `summit-data-engine/src/summit_data_engine/config/settings.py`
- `summit-data-engine/src/summit_data_engine/db/__init__.py`
- `summit-data-engine/src/summit_data_engine/db/base.py`
- `summit-data-engine/src/summit_data_engine/db/models.py`
- `summit-data-engine/src/summit_data_engine/db/session.py`
- `summit-data-engine/src/summit_data_engine/dobih/__init__.py`
- `summit-data-engine/src/summit_data_engine/dobih/importer.py`
- `summit-data-engine/src/summit_data_engine/dobih/master_package.py`
- `summit-data-engine/src/summit_data_engine/dobih/reporting.py`
- `summit-data-engine/src/summit_data_engine/dobih/wales_review.py`
- `summit-data-engine/src/summit_data_engine/dobih/xlsx.py`
- `summit-data-engine/src/summit_data_engine/international/`
- `summit-data-engine/src/summit_data_engine/models/__init__.py`
- `summit-data-engine/src/summit_data_engine/models/domain.py`
- `summit-data-engine/src/summit_data_engine/util/__init__.py`
- `summit-data-engine/src/summit_data_engine/util/provenance.py`
- `summit-data-engine/tests/test_dobih_database_integration.py`
- `summit-data-engine/tests/test_dobih_master_package.py`
- `summit-data-engine/tests/test_dobih_wales_review.py`
- `summit-data-engine/tests/test_international_catalogue.py`
- `summit-data-engine/tests/test_international_database.py`
- `summit-data-engine/tests/test_migration_contract.py`

## Full review queue

### Review and hold records (144)

| Feature ID | Name | Status | Decision reason |
|---|---|---|---|
| INT-0088 | Mount Ararat | needs_review | source status needs_review |
| INT-0089 | Mount Olympus | needs_review | source status needs_review |
| INT-0090 | Mount Bazardüzü | needs_review | source status needs_review |
| INT-0092 | Q130018 | needs_review | package canonical-key collision: geonames:5868589 |
| INT-0093 | Mount Rushmore | needs_review | source status needs_review |
| INT-0094 | Mount Kailash | needs_review | source status needs_review |
| INT-0099 | Mauna Kea | needs_review | source status needs_review |
| INT-0100 | Mount Athos | needs_review | source status needs_review |
| INT-0101 | Mount Sinai | needs_review | source status needs_review |
| INT-0104 | Cho Oyu | needs_review | source status needs_review |
| INT-0106 | Q4675 | needs_review | source status needs_review |
| INT-0107 | Damavand | needs_review | source status needs_review |
| INT-0109 | Baekdu Mountain | needs_review | source status needs_review |
| INT-0112 | Mount Logan | needs_review | source status needs_review |
| INT-0113 | Zugspitze | needs_review | source status needs_review |
| INT-0114 | Table Mountain | needs_review | source status needs_review |
| INT-0115 | Ojos del Salado | needs_review | source status needs_review |
| INT-0116 | Popocatépetl | needs_review | source status needs_review |
| INT-0119 | Mount Tai | needs_review | source status needs_review |
| INT-0120 | Mount Erebus | needs_review | source status needs_review |
| INT-0124 | Mount Aragats | needs_review | source status needs_review |
| INT-0125 | Mount Parnassus | needs_review | source status needs_review |
| INT-0126 | Mount Hermon | needs_review | source status needs_review |
| INT-0127 | Triglav | needs_review | source status needs_review |
| INT-0128 | Citlaltepetl | needs_review | source status needs_review |
| INT-0129 | Kīlauea | needs_review | source status needs_review |
| INT-0130 | Khan Tengri | needs_review | source status needs_review |
| INT-0131 | Gangkhar Puensum | needs_review | source status needs_review |
| INT-0132 | Mount Kazbek | needs_review | source status needs_review |
| INT-0133 | Grossglockner | needs_review | source status needs_review |
| INT-0134 | Mount Pelée | needs_review | source status needs_review |
| INT-0135 | Mount Arafat | needs_review | source status needs_review |
| INT-0137 | Nanda Devi | needs_review | source status needs_review |
| INT-0138 | Terich Mir | needs_review | source status needs_review |
| INT-0139 | Hoverla | needs_review | source status needs_review |
| INT-0140 | Mount Roraima | needs_review | source status needs_review |
| INT-0141 | Mount Tabor | needs_review | source status needs_review |
| INT-0142 | Sněžka | needs_review | source status needs_review |
| INT-0143 | Eiger | needs_review | source status needs_review |
| INT-0144 | Semeru | needs_review | source status needs_review |
| INT-0145 | Sugarloaf Mountain | needs_review | source status needs_review |
| INT-0146 | Rysy | needs_review | source status needs_review |
| INT-0147 | Noshaq | needs_review | source status needs_review |
| INT-0148 | Gerlachovský štít | needs_review | source status needs_review |
| INT-0149 | Kebnekaise | needs_review | source status needs_review |
| INT-0150 | Ismoil Somoni Peak | needs_review | source status needs_review |
| INT-0151 | Musala | needs_review | source status needs_review |
| INT-0152 | Jengish Chokusu | needs_review | source status needs_review |
| INT-0153 | Mount Apo | needs_review | source status needs_review |
| INT-0154 | Adam's Peak | needs_review | source status needs_review |
| INT-0155 | Mount Emei | needs_review | source status needs_review |
| INT-0156 | Shkhara | needs_review | source status needs_review |
| INT-0157 | Nevado del Ruiz | needs_review | source status needs_review |
| INT-0158 | Monte Titano | needs_review | source status needs_review |
| INT-0160 | Taal Volcano | needs_review | source status needs_review |
| INT-0161 | Mount Ruapehu | needs_review | source status needs_review |
| INT-0162 | Galdhøpiggen | needs_review | source status needs_review |
| INT-0163 | Aneto | needs_review | source status needs_review |
| INT-0164 | Mulhacén | needs_review | source status needs_review |
| INT-0165 | Belukha Mountain | needs_review | source status needs_review |
| INT-0166 | Yushan Main Peak | needs_review | source status needs_review |
| INT-0167 | Mount Asama | needs_review | source status needs_review |
| INT-0168 | Devils Tower | needs_review | source status needs_review |
| INT-0169 | Mount Sinabung | needs_review | source status needs_review |
| INT-0170 | Mont Ventoux | needs_review | source status needs_review |
| INT-0171 | Mount Erciyes | needs_review | source status needs_review |
| INT-0172 | Huascarán | needs_review | source status needs_review |
| INT-0173 | Mount Herzl | needs_review | source status needs_review |
| INT-0174 | Nevado Sajama | needs_review | source status needs_review |
| INT-0175 | Mount Scopus | needs_review | source status needs_review |
| INT-0176 | Dykh-Tau | needs_review | source status needs_review |
| INT-0177 | Katla | needs_review | source status needs_review |
| INT-0178 | Moldoveanu Peak | needs_review | source status needs_review |
| INT-0179 | Korab | needs_review | source status needs_review |
| INT-0180 | Mount Lu | needs_review | source status needs_review |
| INT-0181 | Monte San Giorgio | needs_review | source status needs_review |
| INT-0182 | Ras Dashen | needs_review | source status needs_review |
| INT-0183 | Corcovado | needs_review | source status needs_review |
| INT-0184 | Jebel Barkal | needs_review | source status needs_review |
| INT-0185 | Mount Yamantau | needs_review | source status needs_review |
| INT-0186 | Mount Kerinci | needs_review | source status needs_review |
| INT-0187 | Pico Bolívar | needs_review | source status needs_review |
| INT-0188 | Mount Bromo | needs_review | source status needs_review |
| INT-0189 | Lenin Peak | needs_review | source status needs_review |
| INT-0190 | Rinjani | needs_review | source status needs_review |
| INT-0191 | Colima | needs_review | source status needs_review |
| INT-0192 | Pico do Fogo | needs_review | source status needs_review |
| INT-0193 | Halti | needs_review | source status needs_review |
| INT-0194 | Fansipan | needs_review | source status needs_review |
| INT-0195 | Mount Fitz Roy | needs_review | source status needs_review |
| INT-0196 | Hoher Dachstein | needs_review | source status needs_review |
| INT-0197 | Mount Elgon | needs_review | source status needs_review |
| INT-0198 | Monte Perdido | needs_review | source status needs_review |
| INT-0199 | Phou Bia | needs_review | source status needs_review |
| INT-0200 | Mount Nebo | needs_review | source status needs_review |
| INT-0201 | Pico da Neblina | needs_review | source status needs_review |
| INT-0204 | Pumori | needs_review | source status needs_review |
| INT-0205 | Mount Narodnaya | needs_review | source status needs_review |
| INT-0206 | Mount Saint Elias | needs_review | source status needs_review |
| INT-0207 | Mount Gerizim | needs_review | source status needs_review |
| INT-0208 | Emi Koussi | needs_review | source status needs_review |
| INT-0209 | Mount Pico | needs_review | source status needs_review |
| INT-0210 | Mount Helicon | needs_review | source status needs_review |
| INT-0211 | Gyachung Kang | needs_review | source status needs_review |
| INT-0212 | Muztagh Ata | needs_review | source status needs_review |
| INT-0213 | Mount Ontake | needs_review | source status needs_review |
| INT-0214 | Aiguille du Midi | needs_review | source status needs_review |
| INT-0215 | Jezercë | needs_review | source status needs_review |
| INT-0216 | Haleakalā | needs_review | source status needs_review |
| INT-0217 | Puy de Dôme | needs_review | source status needs_review |
| INT-0218 | Coma Pedrosa | needs_review | source status needs_review |
| INT-0219 | Mount Ida | needs_review | source status needs_review |
| INT-0220 | Illimani | needs_review | source status needs_review |
| INT-0221 | Brocken | needs_review | source status needs_review |
| INT-0222 | Meron | needs_review | source status needs_review |
| INT-0223 | Pico Cristóbal Colón | needs_review | source status needs_review |
| INT-0224 | Kongur Tagh | needs_review | source status needs_review |
| INT-0225 | Mount Wilhelm | needs_review | source status needs_review |
| INT-0226 | Ama Dablam | needs_review | source status needs_review |
| INT-0227 | Mount Tahat | needs_review | source status needs_review |
| INT-0228 | Hkakabo Razi | needs_review | source status needs_review |
| INT-0229 | Monte Pissis | needs_review | source status needs_review |
| INT-0230 | Mount Baker | needs_review | source status needs_review |
| INT-0231 | Signal de Botrange | needs_review | source status needs_review |
| INT-0232 | Taranaki Maunga | needs_review | source status needs_review |
| INT-0233 | La Soufrière | needs_review | source status needs_review |
| INT-0234 | Nevado del Huila | needs_review | source status needs_review |
| INT-0235 | Mount Hiei | needs_review | source status needs_review |
| INT-0236 | Gjeravica | needs_review | source status needs_review |
| INT-0237 | Mount Amiata | needs_review | source status needs_review |
| INT-0238 | Maglić | needs_review | source status needs_review |
| INT-0239 | Masherbrum | needs_review | source status needs_review |
| INT-0240 | Namcha Barwa | needs_review | source status needs_review |
| INT-0241 | Nuptse | needs_review | source status needs_review |
| INT-0242 | Kamet | needs_review | source status needs_review |
| INT-0243 | Mount Tongariro | needs_review | source status needs_review |
| INT-0244 | Corno Grande | needs_review | source status needs_review |
| INT-0245 | Viso | needs_review | source status needs_review |
| INT-0246 | Mount Elbert | needs_review | source status needs_review |
| INT-0247 | Wildspitze | needs_review | source status needs_review |
| INT-0248 | Feldberg | needs_review | source status needs_review |
| INT-0249 | Gasherbrum IV | needs_review | source status needs_review |
| INT-0250 | Uludağ | needs_review | source status needs_review |
| INT-0252 | Denali | verified | package canonical-key collision: geonames:5868589 |

### Blocked missing-geometry records (37)

| Feature ID | Name | Status | Decision reason |
|---|---|---|---|
| INT-0002 | Mont Blanc de Courmayeur | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0008 | Liskamm (Eastern Summit) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0011 | Liskamm (Western Summit) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0013 | Picco Luigi Amedeo | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0019 | Schwarzhorn (Corno Nero) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0020 | Grand Combin (Grafeneire) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0021 | Dôme du Goûter | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0025 | Grand Pilier d’Angle | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0030 | Vincent Pyramid | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0031 | Grandes Jorasses (Pointe Walker) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0036 | Grand Combin (Valsorey) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0037 | Grandes Jorasses (Pointe Whymper) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0039 | Breithorn (Western Summit) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0040 | Breithorn (Central Summit) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0043 | Breithorn (Eastern Summit/ western Twin Peak) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0044 | Grand Combin (Tsessette) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0046 | Aiguilles du Diable (L’Isolée) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0047 | Aiguille Blanche de Peuterey | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0048 | Grandes Jorasses (Pointe Croz) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0049 | Aiguilles du Diable (Pointe Carmen) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0051 | Breithorn (Gendarm/ eastern Twin Peak) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0052 | Grande Rocheuse | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0054 | Aiguilles du Diable (Pointe Médiane) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0057 | Breithorn (Roccia Nera) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0058 | Aiguilles du Diable (Pointe Chaubert) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0059 | Mont Brouillard | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0060 | Grandes Jorasses (Pointe Marguerite) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0061 | Aiguilles du Diable (Corne du Diable) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0066 | Gross Fiescherhorn | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0067 | Vincent Pyramid (Punta Giordani/Giordanispetz) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0068 | Grandes Jorasses (Pointe Elena) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0071 | Aiguille du Jardin | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0074 | Hinter Fiescherhorn | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0076 | Dôme de Rochefort | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0077 | Barre des Écrins (Dôme de Neige) | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0079 | Punta Baretti | verified | MISSING_REQUIRED_GEOMETRY |
| INT-0082 | Les Droites | verified | MISSING_REQUIRED_GEOMETRY |

The accompanying JSON contains all decisions in machine-readable form.
