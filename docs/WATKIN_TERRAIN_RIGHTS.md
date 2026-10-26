# Watkin pilot: terrain contributor and reuse investigation

## Owner-confirmed route intent

The intended walk is **out-and-back along Watkin Path**, returning along the
same path, rather than a circular route. The owner confirmed this format for
the existing 13.11 km development draft. This is not a rights/access/safety
attestation, catalogue verification, accepted validation or publication approval.
Original route geometry, expedition figures and recorded activity remain intact.

## What was verified

All six zoom-14 Terrarium tiles used in the saved Watkin profile were downloaded
from their original provider URL and matched the original byte size and SHA-256.
Each response identified the same contributor through the provider's
`x-amz-meta-x-imagery-sources` header:

`eudem/eudem_dem_5deg_n50w005.tif`

This identifies the **EU-DEM source family and source filename for these exact
tile bytes**, not just a nearby footprint or a generic "open data" claim. It does
not prove the original source edition by itself, nor identify sources for any
other route. Tilezen documents this header as contributor evidence.

The machine-readable evidence report is:
`generated-artifacts/terrain-rights/watkin-06c6eef21a8d.json`.
It links the original manifest hash, all six original tile hashes, observed
contributors and ETags. Original profile/tile evidence was not edited.
Reproduce with:

```sh
pnpm --filter @workspace/api-server exec tsx scripts/capture-terrain-rights.ts \
  generated-artifacts/route-profile/watkin-4363b367997a-2026-10-25T19-51-45-606Z/terrain-manifest.json
```

## Reuse terms found

The AWS registry points to Tilezen's attribution document rather than granting
a universal new licence for all composite tiles. Tilezen requires EU-DEM credit:

> Produced using Copernicus data and information funded by the European Union -
> EU-DEM layers.

The EEA's official EU-DEM metadata describes full, open and free access under the
Copernicus conditions, requiring source acknowledgement, clear notice when data
is adapted/modified and no implication of EU endorsement. These terms support a
no-subscription reuse approach subject to those conditions, not an automatic
rights approval for this app. Original source-edition corroboration and the
owner's final recorded rights/profile review remain explicit acceptance work.
Do not substitute newer Copernicus DEM/WorldDEM licence terms for legacy EU-DEM.

Proposed public credit, to accompany any future released profile:

> Produced using Copernicus data and information funded by the European Union –
> EU-DEM layers. Terrain tiles: Mapzen/Tilezen. Profile resampled and ascent
> estimated by SummitReady; not EU-endorsed or surveyed.

Keep the source/attribution links reachable from the profile. Clearly label the
result as a modified, DEM-derived planning estimate. EU-DEM is a digital **surface**
model, not a guarantee of bare-earth surveyed heights. The EEA marks this legacy
product obsolete/no longer maintained; a zoom-14 pixel is not its native survey
resolution. Existing Watkin stage facts (13 km / 1,015 m), the separate pilot's
estimated 1,013 m ascent and GPS-recorded evidence have not been conflated or
replaced.

## Sources

- [AWS Terrain Tiles registry](https://registry.opendata.aws/terrain-tiles)
- [Tilezen contributor-header documentation](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)
- [Tilezen attribution and dataset terms](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
- [Official EEA EU-DEM metadata and reuse constraints](https://sdi.eea.europa.eu/catalogue/srv/api/records/19cff95e-61ac-45ed-8ee3-c43220d709cf)

No new paid provider was selected. No profile, route or rights record has been
automatically promoted to accepted or public.

## Additional source-edition investigation

The follow-on findings are retained separately in
`docs/WATKIN_TERRAIN_EDITION_EVIDENCE.json`; the original hashed report and
protected review companions have not been rewritten.

The provider's published footprint inventory contains one exact matching
`eudem_dem_5deg_n50w005.tif` record, with approximately 30.887 m nominal
resolution and a source-file URL. The complete compressed inventory was
streamed and hashed; its SHA-256 and matching properties are in the new report.

Metadata-only HTTP range reads of that source TIFF establish an 18,000 × 18,000
grid, one-arc-second pixels and geographic ETRS89 (EPSG:4258), covering the
five-degree tile beginning at -5° longitude / 55° latitude. Only **382 unique
metadata bytes** were sampled; the 625 MB raster was not downloaded, and its
whole-file hash is not known. The inspected primary TIFF metadata contains no
source-edition label.

This is strong corroboration of the older **EU-DEM v1.0** geographic product
described by Eurostat, rather than the native 25 m projected v1.1 product
described by the EEA. It is **not proof** of the upstream edition: rehosting or
resampling could preserve a filename/grid, and the inventory is not an
authenticated build manifest linking the original release bytes to our saved
output tiles. Do not turn this finding into automatic rights/profile approval.

**Do not confuse Terrain Tiles v1.1 with EU-DEM v1.1.** These are independent
release numbers. A 2017 Terrain Tiles release does not establish the edition of
its contributing European elevation dataset.

The remaining exact-edition gap needs provider/upstream provenance evidence,
not an owner assertion or a changed verification flag. All existing rights,
access, profile, catalogue and publication safeguards remain in effect.
