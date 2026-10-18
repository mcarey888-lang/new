# Replit prompt — wire up offline maps (Track One, Phases 1–3)

Paste everything below the line into Replit.

---

## Context before you change anything

We are adding offline Ordnance Survey maps to SummitReady. The decision logic
is already written and tested — 90 tests across three modules. Your job is the
plumbing underneath it, not the logic.

**Please read this whole message before editing. Two things in here will
surprise you.**

### Surprise one: the app has no offline map today, and never had one

I checked rather than assumed:

- `constants/capabilities.ts` has `routeOfflineDownload: false`, and
  `components/mountain/SelectedRoute.tsx` honestly tells the user "Offline
  route packaging is not part of this version of SummitReady."
- `expo-file-system` is not a dependency. Nothing writes map tiles to disk.
- There is no tile URL template anywhere in `app/`, `components/` or `utils/`.
  `components/TrailMapView.native.tsx` uses plain `react-native-maps`, which
  means Apple Maps or Google Maps tiles, streamed, with no OS layer at all.

So offline maps are not a half-finished feature with a bug in it. The layer was
never built. Nothing is broken and nothing needs unpicking — this is new work.
The honest "not part of this version" text was correct.

### Surprise two: do not use `tileCacheMaxAge` for the 24-hour rule

`react-native-maps` 1.20.1 already ships `UrlTile` with `tileCachePath`,
`tileCacheMaxAge` and `offlineMode`, so most of the disk work is done for you.
Use `tileCachePath`. **Do not rely on `tileCacheMaxAge` to enforce expiry.**

Its own documentation says why:

> to ensure map availability a stale (over max age) tile is served while a tile
> refresh process is started in the background

That is sensible behaviour for an ordinary map and wrong for ours. The OS
Standard Maps API licence permits a cache of up to 24 hours; a tile past that
window may not be drawn. A prop that deliberately serves stale tiles to keep
the map looking complete would put us outside the terms we pay under.

The same docs are explicit that the rest is ours:

> All cache management needs to be implemented by client e.g. deleting tiles to
> manage use of storage space etc.

That is what `utils/dayCache.ts` is for. It is the authority on what may be
drawn. The library holds the bytes; our code decides.

One convenient fit: `tileCachePath` stores tiles as `/{z}/{x}/{y}`, which is
exactly the key format `tileKey()` already produces.

---

## Step 1 — bring the three modules across

They are on branch `claude/route-map-server`. Each commit adds new files and
changes one line of `artifacts/summit-ready/package.json` (the vitest file
list). They overwrite nothing.

```
git fetch origin claude/route-map-server
git cherry-pick a717aae 1663961 e0f689f
```

If the `package.json` line conflicts, keep both sides' test filenames — the
only change is appending test files to `scripts.test`.

What arrives:

| File | What it decides |
|---|---|
| `utils/offlineRegions.ts` | Whether a walk is covered by what is on the phone |
| `utils/dayCache.ts` | Which tiles a walk needs, and when they must be deleted |
| `utils/tileSource.ts` | Where each tile comes from, and what to tell the user |

All three are pure: no file system, no network, no clock of their own. The
caller passes the time, the connectivity and the records. That is deliberate —
it is why the licence rule can be tested exhaustively.

Run `npm test` after the cherry-pick. Expect 890 of 892 passing. The two
failures are pre-existing mode-toggle tests, unrelated to this work.

## Step 2 — add the two dependencies

```
npx expo install expo-file-system @react-native-community/netinfo
```

`expo-file-system` for reading and deleting cached tiles. NetInfo for the
`Connectivity` value `tileSource` needs.

Map NetInfo to our three states:

- `isConnected && isInternetReachable` → `"online"`
- `isConnected && !isInternetReachable` → `"metered"`
- otherwise → `"offline"`

`"metered"` is not about data plans. It is the half-signal that is normal on a
hill — a connection that answers sometimes. It exists because that case needs
cache-first behaviour, not because it needs a warning.

## Step 3 — the tile source on the map

Add a `UrlTile` to the native map with `tileCachePath` pointing at a directory
under the app's document directory, and `offlineMode` driven by our
connectivity value.

**The OS API key must not reach the app.** We already have the pattern: the
api-server has `src/routes/map-tiles.ts`, which proxies tiles and keeps the
token server-side with a tileset allowlist and grid validation. Add an OS
route there the same way and point `urlTemplate` at our server, not at
`api.os.uk`. A key shipped in an app binary is a key published.

Platform caveat worth confirming before you build: these `UrlTile` cache props
are documented as Android plus **iOS with Apple Maps only**. If iOS is on the
Google provider, check this works there before assuming it does. If it does
not, say so rather than shipping a cache that silently does nothing on iPhone —
that would be worse than no offline map, because the user would trust it.

## Step 4 — download, sweep, and what the user sees

**Download.** On the route screen, call `tilesForRoute(route)` for the
addresses, `planFor(...)` for what is actually still needed, then fetch and
write them. Re-downloading a route mostly already cached should be quick,
because `planFor` already filters out what is in date.

**Sweep.** Call `sweep(cache, Date.now())` and delete every key it returns:

- on app start, and
- when the app comes back to the foreground.

Foreground matters more than start. The phone that has been in a pocket since
yesterday never "starts" — it wakes. That is exactly the case where tiles are
past their window.

Expiry here is a licence condition, not tidying up. It needs to be reliable
rather than best-effort.

**What the user sees.** `mapReadiness(...)` gives one answer for the whole
route and `readinessMessage(...)` gives the line to show. Put it **before the
walk starts**, where it is still a decision somebody can act on. Told halfway
up a hill it is only news.

Use the message as written. It quotes no tile counts on purpose — nobody
decides anything on "412 of 500 tiles", and a number that precise implies a
confidence about what is on screen that we do not have.

## Step 5 — the capability flag, last

`CAPABILITIES.routeOfflineDownload` stays `false` until downloading, sweeping
and offline drawing all actually work on a device. Flip it only then, in its own
commit.

`utils/routeEligibility.ts` reads that flag, and `routeEligibility.test.ts`
asserts it is currently false, so flipping it early turns the honest "not part
of this version" text into a button that does nothing. A download button that
lies is worse than an absent one — somebody would set off trusting it.

---

## Please do not

- **Change the logic in the three modules.** 90 tests cover them, several
  pinning decisions that are easy to undo by accident. If something looks wrong,
  say so rather than editing it.
- **Raise `CACHE_WINDOW_HOURS` from 22 to 24.** The 22 is deliberate margin: a
  phone asleep in a pocket or a drifted clock would otherwise serve tiles past
  the window. Expiring early costs one download; expiring late is a breach.
- **Make an expired OS tile drawable** because the user has no signal and needs
  a map. It is the tempting case and the answer is still no. The permanent
  OpenStreetMap fallback layer is the answer to it, and it is not built yet —
  until it is, offline gaps show as gaps.
- **Block or delay Start on anything map-related.** `shouldBlockStart()` returns
  false for every state on purpose. Offline-first Start must not wait, and a map
  is not a condition of walking.
- **Touch protected systems:** Training/Readiness, AI Coach, Elevation Bank,
  the activity engine, sync, auth, billing, the database schema or the Summit
  Data Engine. This work adds files and touches the map screen. Nothing else.
- **Run migrations or change the schema.** None of this needs either.

## When you are done

Report: which platforms you tested on a real device, whether the sweep actually
deleted tiles after the window (set the clock forward rather than waiting), what
`npm test` and typecheck say, and anything you could not make work. The last one
matters most — a known gap is workable, a hidden one is not.
