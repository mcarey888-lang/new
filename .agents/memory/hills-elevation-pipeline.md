---
name: Hills elevation pipeline
description: How the hills-unified API computes elevation gain — Overpass-first with terrain sampling, KNOWN_GAINS override, and AI fallback.
---

## Architecture (hills-unified.ts area lookup)

1. **Geocode** user location (Nominatim)
2. **Overpass** (`natural=peak` + `name` within radius) → real summit lat/lng + OSM `ele` tag
3. **OpenTopoData batch**: for each peak sample 4 terrain points at 1500m radius → `gain = summit_elev - min(base_samples)`
4. **KNOWN_GAINS table** (35+ UK hills) overrides computed gain — always wins
5. If ≥ 5 usable hills → return them (source: "overpass")
6. Else → **AI fallback** with LOOKUP_SYSTEM_PROMPT + terrain batch verification

## Capacity

- `SAMPLE_COUNT = 4`, `SAMPLE_RADIUS_M = 1500`, `MAX_PEAKS = 19`
- 19 × (1 + 4) = 95 points per OpenTopoData call — within the 100-point limit
- Overpass timeout: 20s; falls back to AI silently on failure

## Known limitations

- Alpine areas (Chamonix etc.): 1500m sample radius is too small relative to massive peaks → Overpass path typically returns < 5 usable hills → AI fallback kicks in (acceptable)
- Flat regions: Overpass returns few/no peaks → AI fallback (acceptable)

## Why KNOWN_GAINS wins over terrain

AI-provided trailhead coords are often misplaced (too high on the hill), making `summit - trailhead` too low. The KNOWN_GAINS table was researched from AllTrails + OS maps and is authoritative for the named hills it covers.

## Cache

- In-memory area cache: 30 min TTL, keyed by `loc|radius|minElev`
- Per-hill DB cache (`cached_hills` table): 7-day TTL, keyed by slug
- Clear DB cache with `DELETE FROM cached_hills` if values need refreshing
