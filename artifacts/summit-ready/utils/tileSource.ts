import { isFresh, tileKey, type CachedTile, type TileAddress } from "./dayCache";

/**
 * Where a map tile comes from, and what to tell somebody when the answer is
 * "nowhere".
 *
 * The decision has three inputs — what is cached, what time it is, and whether
 * there is a signal — and the awkward case is the one that matters on a hill:
 * no signal, and the cached tile is past its 22-hour window.
 *
 * The licence does not bend for that. An OS tile outside its window may not be
 * drawn, however badly somebody needs it, so this resolver will not serve one.
 * That is exactly why the permanent OpenStreetMap layer exists: it is stored
 * under a licence with no expiry, so it is there when the OS cache is not. A
 * walker on a hill gets a map either way. They are told which one.
 *
 * The other deliberate choice: a fresh cached tile is served even when there
 * IS a signal. It is faster, it works in the patchy reception that is normal
 * on a hill rather than the clean offline the word implies, and OS bill per
 * transaction, so a refetch of a tile already held costs money for nothing.
 *
 * Pure. The caller passes the clock, the connectivity and the records.
 */

export type Connectivity =
  /** A usable connection. */
  | "online"
  /** No connection. */
  | "offline"
  /** A connection that answers sometimes. The normal state on a hill, and the
   *  reason cache-first is not just an optimisation. */
  | "metered";

export type TileSource =
  /** Draw the cached OS tile. Full Explorer detail. */
  | { kind: "cache"; key: string }
  /** Fetch it from OS. */
  | { kind: "network"; address: TileAddress }
  /** Draw the permanent OSM-derived tile instead, and say so. */
  | { kind: "fallback"; address: TileAddress; reason: FallbackReason }
  /** Nothing can be drawn here. */
  | { kind: "unavailable"; address: TileAddress; reason: FallbackReason };

export type FallbackReason =
  /** Held, but past the window the licence allows. */
  | "expired"
  /** Never cached, and no way to fetch it now. */
  | "not_cached"
  /** Cached bytes that cannot be trusted. */
  | "corrupt";

/**
 * Plain words for why the OS layer is not being drawn.
 *
 * Always says something. A blank reason is the state where a broken download
 * and ground nobody has mapped look identical, which is the mistake this
 * codebase has already made once.
 */
export function fallbackMessage(reason: FallbackReason): string {
  switch (reason) {
    case "expired":
      /* Not phrased as a fault. The 24-hour limit is a condition of the OS
         licence, so the honest thing is to name the refresh, not apologise. */
      return "Your Ordnance Survey maps have expired. Showing the standard map instead — download again for full detail.";
    case "not_cached":
      return "No Ordnance Survey map saved for here. Showing the standard map instead.";
    case "corrupt":
      return "Part of the saved map could not be read. Showing the standard map instead.";
  }
}

export interface ResolveOptions {
  /** Whether the permanent layer is on the device. Without it, a miss is a
   *  blank square rather than a coarser map. */
  fallbackAvailable: boolean;
}

/**
 * Which source serves one tile.
 *
 * Order matters, and it is cache first. An expired tile never becomes network
 * just because a signal appeared mid-walk — it becomes a fetch, which is the
 * same destination by an honest route.
 */
export function resolveTile(
  address: TileAddress,
  cache: ReadonlyMap<string, CachedTile>,
  now: number,
  connectivity: Connectivity,
  opts: ResolveOptions,
): TileSource {
  const key = tileKey(address.z, address.x, address.y);
  const held = cache.get(key);

  if (held && isFresh(held, now)) {
    /* Bytes of zero is a file that was created and never written. Serving it
       draws nothing and looks like a rendering fault, so it counts as a miss
       with a reason of its own. */
    if (held.bytes === 0) {
      return downgrade(address, "corrupt", connectivity, opts);
    }
    return { kind: "cache", key };
  }

  const reason: FallbackReason = held ? "expired" : "not_cached";

  if (connectivity === "online" || connectivity === "metered") {
    /* Worth trying even on a metered link: a failed request costs a moment,
       and the alternative is a coarser map when a better one was available. */
    return { kind: "network", address };
  }

  return downgrade(address, reason, connectivity, opts);
}

function downgrade(
  address: TileAddress,
  reason: FallbackReason,
  connectivity: Connectivity,
  opts: ResolveOptions,
): TileSource {
  if (connectivity !== "offline") return { kind: "network", address };
  return opts.fallbackAvailable
    ? { kind: "fallback", address, reason }
    : { kind: "unavailable", address, reason };
}

/* ── What the whole map can show right now ──────────────────────────────── */

export type MapReadiness =
  /** Every tile the route needs is cached and in date. */
  | { kind: "full" }
  /** Some of the route is on the OS layer, the rest on the fallback. */
  | { kind: "mixed"; osTiles: number; fallbackTiles: number; reason: FallbackReason }
  /** None of the OS layer is usable; the fallback is carrying the map. */
  | { kind: "fallback_only"; reason: FallbackReason }
  /** Nothing can be drawn offline. */
  | { kind: "no_map"; reason: FallbackReason }
  /** Online, so the map will load as it is panned. */
  | { kind: "streaming" };

/**
 * One answer for the whole route, for a banner rather than per tile.
 *
 * Reported before the walk starts, where it is still a decision somebody can
 * act on. Told halfway up it is only news.
 */
export function mapReadiness(
  needed: readonly TileAddress[],
  cache: ReadonlyMap<string, CachedTile>,
  now: number,
  connectivity: Connectivity,
  opts: ResolveOptions,
): MapReadiness {
  if (needed.length === 0) return connectivity === "offline" ? { kind: "full" } : { kind: "streaming" };

  let os = 0;
  let expired = 0;
  let absent = 0;
  let corrupt = 0;

  for (const address of needed) {
    const held = cache.get(tileKey(address.z, address.x, address.y));
    if (held && isFresh(held, now)) {
      if (held.bytes === 0) corrupt += 1;
      else os += 1;
    } else if (held) expired += 1;
    else absent += 1;
  }

  if (os === needed.length) return { kind: "full" };

  /* Which reason to lead with when there is more than one. Expiry first: it is
     the one the person can fix in a minute by downloading again, and the one
     that explains a map that worked yesterday. */
  const reason: FallbackReason = expired > 0 ? "expired" : corrupt > absent ? "corrupt" : "not_cached";

  if (connectivity !== "offline") return { kind: "streaming" };

  const missing = needed.length - os;
  if (!opts.fallbackAvailable) {
    return os === 0 ? { kind: "no_map", reason } : { kind: "mixed", osTiles: os, fallbackTiles: 0, reason };
  }
  if (os === 0) return { kind: "fallback_only", reason };
  return { kind: "mixed", osTiles: os, fallbackTiles: missing, reason };
}

/**
 * The banner line, or null when there is nothing worth saying.
 *
 * No tile counts. Nobody decides anything on "412 of 500 tiles", and a number
 * that precise suggests a precision about what is on screen that it does not
 * have.
 */
export function readinessMessage(readiness: MapReadiness): string | null {
  switch (readiness.kind) {
    case "full":
    case "streaming":
      return null;
    case "mixed":
      return readiness.fallbackTiles === 0
        ? "Part of this route has no map without a signal."
        : `Part of this route is on the standard map. ${fallbackMessage(readiness.reason)}`;
    case "fallback_only":
      return fallbackMessage(readiness.reason);
    case "no_map":
      return readiness.reason === "expired"
        ? "Your Ordnance Survey maps have expired and there is no offline map for this route. Download again before you set off."
        : "No offline map for this route. The map will not work without a signal.";
  }
}

/** Whether the person should be stopped before setting off rather than told. */
export function shouldBlockStart(_readiness: MapReadiness): boolean {
  /* Never. A map is not a condition of walking, and an app that refuses to
     start tracking because of a tile cache would be worse than one that draws
     a grey square. Kept as a named function so the answer is written down
     rather than left for somebody to decide differently later. */
  return false;
}
