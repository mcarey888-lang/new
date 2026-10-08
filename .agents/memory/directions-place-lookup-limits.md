---
name: Directions place lookup limits
description: Provider permission and trust boundaries for mountain parking directions.
---

Map-navigation credentials do not necessarily grant place search access. In this environment the configured Google Maps key returned PERMISSION_DENIED for both Places API versions and Geocoding; do not silently substitute a fabricated named car park search when this happens. Public OpenStreetMap Nominatim can provide nearby mapped parking features, but its public endpoint needs a distinctive User-Agent and globally rate-limited requests, and a mapped parking feature is neither a route start nor evidence that parking is legal.

**Why:** A generated “Tryfan North Ridge car park Eryri” search failed in Google Maps. Repeated Google Places attempts were permission-denied, while an OpenStreetMap bounded parking query resolved real features with variable coverage. GPS proximity confirms that a user visited a candidate, not its access rights.

**How to apply:** Keep GPS-confirmed destinations separate from suggestions, and never retain the user's exact GPS fix when a confirmed parking feature's own coordinates suffice.

On the route map, walker GPS-confirmed car parks must be green. OpenStreetMap search candidates must remain amber and visibly labelled unconfirmed; do not flatten these statuses to simplify the interface.

**Why:** The map author explicitly warns that an unconfirmed parking candidate can be a farm track. The distinction is intentional safety information, unlike the unwanted blanket uncertainty badges on Explore mountain details. A GPS visit still does not establish legal access rights.

**How to apply:** Preserve the confidence distinction through lookup responses, map markers and summit-card wording. Check real confirmed examples when available, and disclose when browser checks only encountered provisional candidates.

Shared, source-backed parking research is now explicitly requested: show options for a mountain and save the answer for later visitors. It may be cached without a visit, but must remain suggested parking, not confirmed entrance pins or route-start evidence. Use sourced names/addresses for map-provider resolution; never invent coordinates.

**Why:** On 2026-10-07 the user asked for AI parking lookup when locations are missing, with reusable answers so the next visitor can press Get directions. This supersedes the earlier blanket prohibition on caching unvisited candidates, not the GPS-confirmation or access-rights boundary.

**How to apply:** Ground research in actual retrieved sources, preserve mountain/region identity and source dates, refresh old answers, and keep brief access/signage guidance. A cached suggestion must not alter canonical route eligibility or shared confirmed parking.