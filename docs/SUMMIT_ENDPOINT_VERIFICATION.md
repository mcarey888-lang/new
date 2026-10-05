# Summit pin endpoint — live verification

Checked 2026-10-05 against the workspace engine database, through the existing
`executeEngineReadOnlyQuery` pool. `SHOW transaction_read_only` returned `on`.
This is development verification, not a production deployment.

## Integration and safeguards

- Applied `9d1ce26` and `bde7a14` in order.
- Applied the endpoint and widest-band patches from `6774a79` and `9d80a68`.
- Preserved the existing `app.ts` entirely except for the requested GET `/summits`
  branch above `/map-tiles/`, using `mapTilesLimiter`.
- Preserved the OS Outdoor bypass, globe/terrain page and offline capability flag.
- No indexes, schema changes or engine data writes. No author SQL changes.
- 62 summit tests passed; including drawing/CORS and OS regressions, **117 tests passed**.
- API workflow rebuilt successfully and was restarted once.

## Requested EXPLAIN ANALYZE — verbatim

```text
Bitmap Heap Scan on mountains m  (cost=1.53..23.54 rows=3 width=16) (actual time=220.364..221.479 rows=24 loops=1)
  Recheck Cond: (geom && '0103000020E61000000100000005000000CDCCCCCCCCCC10C03D0AD7A3707D4A40CDCCCCCCCCCC10C03333333333934A403333333333330FC03333333333934A403333333333330FC03D0AD7A3707D4A40CDCCCCCCCCCC10C03D0AD7A3707D4A40'::geometry)
  Filter: ((prominence_m IS NOT NULL) AND (prominence_m >= '100'::double precision))
  Rows Removed by Filter: 76
  Heap Blocks: exact=37
  ->  Bitmap Index Scan on ix_mountains_geom_gist  (cost=0.00..1.52 rows=20 width=0) (actual time=220.145..220.147 rows=100 loops=1)
        Index Cond: (geom && '0103000020E61000000100000005000000CDCCCCCCCCCC10C03D0AD7A3707D4A40CDCCCCCCCCCC10C03333333333934A403333333333330FC03333333333934A403333333333330FC03D0AD7A3707D4A40CDCCCCCCCCCC10C03D0AD7A3707D4A40'::geometry)
Planning Time: 205.768 ms
Execution Time: 226.245 ms
```

This first plan was cold. The exact generated endpoint SQL was also checked
with its actual `padBBox` output and parameters at zoom 14. It returned 143 rows,
used `Index Scan using ix_mountains_geom_gist`, and used indexes for both
classification joins. That warmed plan reported execution time **2.122 ms**.

## Live requests

All four supplied URLs returned HTTP 200, including requests with the approved
HTTPS host and explicit `:8080` Origin. Summit responses use the 1,500/minute
map limiter and return `Cache-Control: public, max-age=300`.

| Requested rectangle / zoom | Pins | Truncated | Unknown ascent |
|---|---:|---|---:|
| Snowdonia `-4.2,52.98,-3.9,53.15`, 14 | 143 | false | 143 |
| Scotland `-8,54.5,-1.5,58.8`, 7 | 400 | true | 400 |
| Wales `-5,51.3,-3,53.5`, 7 | 11 | false | 11 |
| Britain `-8,50,-1,59`, 7 | 400 | true | 400 |

The exact Britain predicate, counted without its LIMIT for diagnosis, matches
**770** mountains. The 400-pin cap is genuinely excluding additional rows.

Scotland's returned display labels: 168 Munro, 185 Corbett, 27 Marilyn,
18 Wainwright and 2 Donald. The supplied rectangle includes northern Cumbria;
those Wainwrights are not being claimed as Scottish hills.

Wales returns Snowdon - Yr Wyddfa, Carnedd Llewelyn, Aran Fawddwy, Pen y Fan,
Glyder Fawr, Waun Fach, Cadair Idris - Penygadair, Moel Siabod, Moel Hebog,
Y Llethr and Pumlumon Fawr. The 500 m prominence alternative works.

Snowdonia also includes Tryfan (918 m), Glyder Fach (994 m) and Crib Goch (924 m).
The endpoint intentionally pads the requested bounds for panning, so some
returned points lie just beyond the unpadded rectangle.

## First three Snowdonia entries — verbatim

```json
[
  {
    "id": "d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd",
    "name": "Snowdon - Yr Wyddfa",
    "alternativeName": null,
    "lat": 53.068496,
    "lng": -4.076231,
    "heightM": 1085,
    "prominenceM": 1039,
    "classification": "Marilyn",
    "place": "Gwynedd, Wales",
    "ascent": {
      "kind": "unknown"
    }
  },
  {
    "id": "9475e721-65cc-42c4-81b6-474ac6a7bcbe",
    "name": "Carnedd Llewelyn",
    "alternativeName": null,
    "lat": 53.160168,
    "lng": -3.970333,
    "heightM": 1062,
    "prominenceM": 748,
    "classification": "Marilyn",
    "place": "Conwy, Gwynedd, Wales",
    "ascent": {
      "kind": "unknown"
    }
  },
  {
    "id": "2427f0f5-4ca7-4727-a1b9-3176c30a506e",
    "name": "Glyder Fawr",
    "alternativeName": null,
    "lat": 53.10147,
    "lng": -4.029164,
    "heightM": 1001,
    "prominenceM": 642,
    "classification": "Marilyn",
    "place": "Conwy, Gwynedd, Wales",
    "ascent": {
      "kind": "unknown"
    }
  }
]
```

## Name-splitting gap — not changed

The actual stored Snowdon name is `Snowdon - Yr Wyddfa`, not bracketed.
It is returned unchanged, with `alternativeName: null`. Thus this particular
expected primary/alternative split does **not** pass. The author implementation
does split bracketed alternatives: Pumlumon Fawr returns `Plynlimon` separately.
No name formatter or SQL correction was made locally.

Place labels are readable counties/countries, not numeric DoBIH region codes.
Every returned ascent in all four supplied calls is `{"kind":"unknown"}`.

## Warm timing and validation

Seven repeated Snowdonia HTTP requests directly to the running local API, consuming
the complete response each time: **6.22, 5.08, 4.92, 4.78, 4.65, 7.84, 4.78 ms**.
Median **4.92 ms**, range **4.65–7.84 ms**. These exclude public proxy/mobile network
latency and are not production timing guarantees. The initial cold call was
1,328.39 ms.

Malformed bbox and nonnumeric zoom return 400. Below the pin band, zoom 3 returns
200 with `{"summits":[],"truncated":false,"zoom":3}`.