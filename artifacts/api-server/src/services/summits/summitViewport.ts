/**
 * When the map should ask for summits again.
 *
 * Panning fires constantly, and a request per frame would be both slow and
 * rude to the database. But the opposite mistake is worse: skipping a fetch
 * that was needed leaves a blank patch of map that never fills, and nothing
 * tells the person it is missing.
 *
 * `shouldRefetch` is the whole decision, and it is written to be shipped as
 * well as tested. The script builder serialises this exact function into the
 * page, so what the browser runs is what the tests cover — there is no second
 * copy to drift. That is why it takes no imports, closes over nothing, and
 * uses only syntax a browser understands.
 */

export interface LoadedView {
  /** The rectangle actually fetched, including the pan margin. */
  minLat: number; maxLat: number; minLng: number; maxLng: number;
  /** Which zoom band it was fetched for. A different band means a different
   *  set of hills qualifies, so the same rectangle is no longer an answer. */
  band: string;
  /** Whether the server had to cut the list short. */
  truncated: boolean;
}

export interface NextView {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
  band: string;
}

/**
 * True when the visible rectangle is not already answered by what is loaded.
 *
 * Self-contained by design: serialised into the page verbatim.
 */
export function shouldRefetch(loaded: LoadedView | null, next: NextView): boolean {
  if (!loaded) return true;
  /* A different band changes which hills qualify, so the old rectangle no
     longer answers the question however well it covers the ground. */
  if (loaded.band !== next.band) return true;
  /* A truncated answer is a partial one. Panning inside it still needs asking
     again, because the hills that were cut may be exactly the ones now on
     screen. */
  if (loaded.truncated) return true;
  /* Covered by what we already hold. The loaded rectangle carries the pan
     margin, so this is true for any small movement, which is most of them. */
  return !(
    next.minLat >= loaded.minLat &&
    next.maxLat <= loaded.maxLat &&
    next.minLng >= loaded.minLng &&
    next.maxLng <= loaded.maxLng
  );
}

/**
 * The source for the browser, taken from the function above rather than
 * written twice.
 *
 * If this ever stops matching, it is because somebody gave `shouldRefetch` a
 * dependency it cannot have. The test suite checks for that.
 */
export function shouldRefetchSource(): string {
  return shouldRefetch.toString();
}
