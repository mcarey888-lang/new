# Published expedition source acquisition

Use free published tracks with commercial reuse permission. Missing sources
remain gaps; an ordinary footpath network or routing engine is not a named
walking itinerary.

## Current acquisition

`python3 scripts/prepare-published-expedition-source.py` captures the published
OpenStreetMap **Bein Alligin Trail** (relation 16155652) through Waymarked Trails.
It retains the original response, capture receipt, SHA-256, published member
order, attribution, ODbL licence links and factual comparison reference.
It neither downloads nor copies Walkhighlands' restricted GPX.

Only a single explicitly ordered continuous published chain is accepted.
Coordinates are converted from Web Mercator to WGS84, omitting duplicate
vertices at identical seams. No source ways are reordered or reversed. No
parking approach, return, connector, simplification or loop closure is added.
The source's approximately 37-metre endpoint separation is retained and
displayed for review. The source is community-mapped, not guide-certified.

Outputs are ignored generated files under
`generated-artifacts/expedition-published-sources/`. The findings CSV covers
all 32 required route groups and distinguishes retained source fragments from
new acquisitions and missing replacements. It is not an exhaustive assertion
that other sources do not exist.

## Preview and development import

Use the existing additive importer from the API package:

```
NODE_ENV=development pnpm exec tsx scripts/import-expedition-route-sources.ts --directory=../../generated-artifacts/expedition-published-sources/prepared
```

After preview succeeds, repeat with `--commit`. The importer guards development
scope, hashes source evidence, prevents duplicate revisions, and verifies
expeditions, stage definitions and review/approval history are unchanged.
It stores the original snapshot as a protected companion file. Nothing is
canonically bound, approved, activated or published by acquisition.

## Sources rejected in this pass

- Walking Britain: Helvellyn GPX is private-use only.
- Walkhighlands: exports are for personal use, not automatic app reuse.
- Yorkshire Dales official Three Peaks GPX: commercial reuse needs permission
  under the publisher's website terms. No restricted file was copied.
- OSM Three Peaks relation 5671418: branched source, not one ordered itinerary.
  Relation 5643210 is a different walk in Somerset.
- OSM Liathach relation 16155653: disconnected source chains.
- OSM Lochnagar relation 5649486: different walk from the White Mounth circuit.
- OSM Minffordd, Llanberis and Watkin sources do not supply the required complete
  return itineraries. Never synthesize their missing legs.

Tests: `python3 -m unittest scripts/test_published_expedition_source.py`.
