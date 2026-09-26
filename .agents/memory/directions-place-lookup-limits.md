---
name: Directions place lookup limits
description: Provider permission and trust boundaries for mountain parking directions.
---

Map-navigation credentials do not necessarily grant place search access. In this environment the configured Google Maps key returned PERMISSION_DENIED for both Places API versions and Geocoding; do not silently substitute a fabricated named car park search when this happens. Public OpenStreetMap Nominatim can provide nearby mapped parking features, but its public endpoint needs a distinctive User-Agent and globally rate-limited requests, and a mapped parking feature is neither a route start nor evidence that parking is legal.

**Why:** A generated “Tryfan North Ridge car park Eryri” search failed in Google Maps. Repeated Google Places attempts were permission-denied, while an OpenStreetMap bounded parking query resolved real features with variable coverage. GPS proximity confirms that a user visited a candidate, not its access rights.

**How to apply:** Show candidate provenance and explicit caveats, never save unvisited candidate pins in the shared database, and never retain the user's exact GPS fix when a confirmed parking feature's own coordinates suffice.