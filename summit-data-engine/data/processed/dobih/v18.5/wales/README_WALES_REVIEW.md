# Wales DoBIH review dataset

## Scope

This is a read-only preparation export. It has not been inserted into PostGIS or
the Summit Ready production database. It contains no AI-generated or AI-corrected
geographic facts. All records remain `source_backed`, `not_imported`, and pending
independent GPT and Claude review.

## Source and attribution

- Source organisation: The Database of British and Irish Hills (DoBIH)
- Release: v18.5
- Download URL: https://www.hill-bagging.co.uk/dobih-downloads/hillcsv.zip
- Retrieved: 2026-08-25T14:26:29+00:00
- Preserved ZIP: `data/raw/dobih/v18.5/hillcsv.zip`
- ZIP bytes: 2342737
- ZIP SHA-256: `0c39e13ac59dd3fa172ac21dd56dd0f6fef19a14af47c7a5a444cce691e9f021`
- Contained CSV: `DoBIH_v18_5.csv`
- CSV bytes: 13396947
- CSV SHA-256: `d27bc69dbb6d30a6f171ef277408831fe8763fc9043422f4e375e63f4cc190ea`
- Licence: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- Preferred attribution: The Database of British and Irish Hills v18.5,
  linked to https://www.hill-bagging.co.uk/dobih

The underlying summit dataset was created and is maintained by DoBIH, not Summit Ready.

## Wales filtering

The CSV schema was inspected at runtime. Every source record whose exact `Country`
value is `W` is included. No elevation, classification, popularity, or list-membership
threshold is applied. This produced 2654 Welsh records from
21576 total source records. England/Wales border records
remain included whenever DoBIH assigns `Country == W`.

## Field handling

All 105 source columns are retained in source
order. DoBIH's delimiter-format spaces around CSV header labels are removed so labels
such as ` Name` are exported as `Name`; source cell values themselves are preserved
verbatim. Separate normalized and review columns are appended. Blank source values
remain blank; no replacement values are fabricated. `canonical_id` is
`dobih:<Number>`.

## Deterministic QA

QA adds flags but never rejects or edits a source record. Checks cover missing,
duplicate, or invalid IDs; missing/duplicate names; coordinate presence and numeric
ranges; conservative plausible-Wales bounds (latitude 51.2–53.5, longitude -5.6–-2.4);
missing, invalid, or non-positive heights; invalid or negative prominence; invalid core
numeric fields; exact duplicate coordinates; malformed 6- and 10-figure OS grid
references; and source-backed England/Wales border signals.

A border signal is raised only when the DoBIH row itself names an adjacent English
county, uses an `EC` topographic section, or explicitly mentions both England and Wales
in its name/notes. It is a review flag, not a correction or exclusion.

## Deliverables

- `wales_dobih_full.csv`: all source and normalized review fields.
- `wales_dobih_review.xlsx`: the same records with filters, frozen headers, warning
  highlighting, and a summary sheet.
- `wales_dobih_summary.json`: source identity, counts, missing data, and QA totals.
- `wales_dobih_discrepancies.csv`: only records with deterministic QA warnings.
- `README_WALES_REVIEW.md`: this document.
