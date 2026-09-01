# Tryfan evidence review

Internal review artifact only; no production integration.

## Mountain

- Status: **needs_review**
- OSM peak elevation: 917.5
- Decision: never automatically verified; independent human review required.

## Routes

### Tryfan North Ridge

- Status: **needs_review**
- Geometry: ordered_osm_member_topology; source IDs: none
- Definition: tryfan-north-ridge-definition
- Factual evidence / rights records: British Mountaineering Council, Ramblers, Royal Commission on the Ancient and Historical Monuments of Wales / Coflein
- DEM coverage: not_applicable_no_geometry
- Resolution diagnostics: ordered_relation_not_unique, acquisition_publication_blocked
- Metrics: unavailable
- Topology acquisition candidates (partial/rejected/unavailable records are diagnostics only and are never drawn as routes):
  - `partial` osm-north-ridge-three-fragments: Missing source-node chain: way 1136472277 ends at node 388197068 while the next ordered fragment way 1111458062 starts at node 30395756. No unnamed way, routing, snapping, or coordinate-proximity gap fill is permitted. Rights: ODbL topology is reusable with OpenStreetMap attribution, but incomplete topology is not publishable. Ways: 1136472277 v4 endpoints=(30395677, 388197068), 1111458062 v9 endpoints=(30395756, 30395793), 114871121 v9 endpoints=(30395793, 30395798).
  - `rejected` walking-britain-north-ridge-gpx: The publisher's stated private-use-only terms are incompatible with route geometry reuse. Rights: Copyright; private use only.
  - `rejected` ramblers-north-ridge-gpx: Unclear GPX and map reuse rights block acquisition. Rights: No explicit compatible geometry licence was found.
  - Hashed-PBF evaluation osm-north-ridge-three-fragments: needs_review; diagnostics: ordered_topology_gap; source IDs: way/1136472277, way/1111458062, way/114871121

### Tryfan South Ridge

- Status: **needs_review**
- Geometry: ordered_osm_member_topology; source IDs: none
- Definition: tryfan-south-ridge-definition
- Factual evidence / rights records: Ramblers, Walk Snowdonia, UKClimbing / Rockfax, Cicerone Press, Royal Commission on the Ancient and Historical Monuments of Wales / Coflein
- DEM coverage: not_applicable_no_geometry
- Resolution diagnostics: ordered_relation_not_unique, acquisition_publication_blocked
- Metrics: unavailable
- Topology acquisition candidates (partial/rejected/unavailable records are diagnostics only and are never drawn as routes):
  - `rejected` cicerone-south-ridge-guide-topology: The commercial guide is factual identity evidence only and cannot supply reusable topology. Rights: Commercial guide content is not licensed for route-geometry reuse.
  - `unavailable` south-ridge-open-topology-search: No accepted or partial exact source topology is available. Rights: ODbL topology would be reusable, but no complete named topology exists in the source.
  - Hashed-PBF evaluation south-ridge-open-topology-search: needs_review; diagnostics: none; source IDs: none

### Heather Terrace

- Status: **needs_review**
- Geometry: ordered_osm_member_topology; source IDs: none
- Definition: tryfan-heather-terrace-definition
- Factual evidence / rights records: Royal Commission on the Ancient and Historical Monuments of Wales / Coflein, Mud and Routes
- DEM coverage: not_applicable_no_geometry
- Resolution diagnostics: ordered_relation_not_unique, acquisition_publication_blocked
- Metrics: unavailable
- Topology acquisition candidates (partial/rejected/unavailable records are diagnostics only and are never drawn as routes):
  - `rejected` walking-britain-heather-terrace-gpx: The publisher's stated private-use-only terms are incompatible with route geometry reuse. Rights: Copyright; private use only.
  - `rejected` mud-routes-heather-terrace-gpx: GPX and attributed commercial map rights are unclear and therefore block reuse. Rights: No explicit compatible route-geometry reuse licence was found.
  - `unavailable` heather-terrace-open-topology-search: No accepted complete source-node topology is available. Rights: ODbL topology would be reusable, but no complete named topology exists in the source.
  - Hashed-PBF evaluation heather-terrace-open-topology-search: needs_review; diagnostics: none; source IDs: none

## DEM and rights

- Planned canonical Copernicus GLO-30 tiles: none
- Coverage status: not_applicable_no_resolved_geometry
- Supplied canonical Copernicus GLO-30 tiles: Copernicus_DSM_COG_10_N53_00_W004_00_DEM
- OSM route/summit data: © OpenStreetMap contributors, ODbL.
- Elevation: Copernicus DEM GLO-30, European Union / Copernicus.
- External factual sources and their geometry-reuse decisions are embedded in the manifest.
