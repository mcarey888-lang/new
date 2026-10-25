# Watkin pilot: terrain contributor and reuse investigation

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
