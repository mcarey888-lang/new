# Replit — why nothing snaps, and the fix

---

Route drawing has been failing with every section straight and no reason
given. The cause is not in the snapping engine, which has been working the
whole time. It never got asked.

## What is actually happening

`/api/path-snap` and `/api/route-profile` both return **500** with a ~1.9 kB
HTML stack page. Not a snapping failure — the requests are being refused by
the CORS check before any handler runs.

The allow-list in `app.ts` is built from `REPLIT_DOMAINS`, which gives a bare
hostname, so it holds `https://<host>`. The browser is on
`https://<host>:8080`, and sends that — **with the port** — as its Origin. The
lookup is an exact string match on a `Set`, so it misses, and
`callback(new Error(...))` turns into a 500 with a stack trace.

I reproduced it before changing anything:

| Origin header | Result |
|---|---|
| `https://<host>:8080` | **500, 1.4 kB HTML** |
| `https://<host>` | 200 |
| none | 200 |

That last row is why this was so hard to find. **A document GET sends no Origin
header at all**, so the page itself loaded perfectly and the map drew. Only the
`fetch` calls carried an Origin, so everything the page asked for was turned
away while the map around it looked healthy.

## Apply it

Two commits cherry-pick cleanly onto your branch — I tested this against
`backup/offline-os-maps-wiring-2026-10-04` in a scratch worktree, in this
order:

```
git fetch origin claude/route-map-server
git cherry-pick dedbd32 a58eae2
```

- `a58eae2` — the CORS fix. **This is the one that matters.**
- `dedbd32` — stops the page reading a rejected request as if it were a snap
  result, and gives map tiles their own rate-limit budget.

A third commit, `ed425ba`, **conflicts — do not cherry-pick it.** It changes
the same function your globe work sits beside. Apply it by hand instead, in
`src/routes/route-map-web.ts`:

```js
// add, next to  var ROUTE_COLOR = "#167DF7";
var SNAP_RADIUS_FLOOR_M = 25;
```

```js
// in snapRadiusM(), replace
  return Math.round(metresPerPixel * 20);
// with
  return Math.max(SNAP_RADIUS_FLOOR_M, Math.round(metresPerPixel * 45));
```

Your tree still has the old `* 20`. Two separate problems with it: 20 was
already found to be smaller than anyone can tap, and the scaling collapses at
the zoomed-in end — at zoom 19 it gives 3.6 m, which is finer than the offset
between aerial imagery and OpenStreetMap geometry, so a tap placed exactly on
the path somebody can SEE misses the path the data holds.

After that, `npx vitest run src/__tests__/routeMapDrawing.test.ts
src/__tests__/corsOrigin.test.ts` should give 38 passing. I ran exactly that on
a copy of your branch and it does.

## Your globe work is safe

I checked. `route-map-web.ts` on your branch carries the MapLibre 5 upgrade,
`syncTerrainForZoom`, the world-view pitch handling and the zoom-12 terrain
boundary — none of which is on my branch.

**Do not replace that file with mine, and do not let anything else overwrite
it.** The cherry-picks above leave it intact; I verified `syncTerrainForZoom`
and the MapLibre 5 script tag survive. That is also why `ed425ba` has to go in
by hand rather than as a commit.

## What the CORS change does and does not do

It forgives **the port, and only the port**, and only for a scheme and host
already on the allow-list. A lookalike host, the wrong scheme on a host we do
allow, an unparseable origin and an unknown host are all still refused. There
is a test for each of those.

It also stops a refusal arriving as a 500. Thrown into Express, a rejected
origin renders as a server fault — the server saying "I am broken" when it
means "I do not allow you". The request is still refused, with the same
blocking, before any handler runs. Only the answer changes: `403
origin_not_allowed`, a short JSON body instead of a stack trace. That 500 is
what sent me hunting a bug in the snapping engine that did not exist.

## One correction to my last message

I told you the shared 120-a-minute rate limiter was probably the cause. It was
not. Your Network tab showed 500, not 429, and that settled it.

The limiter change is still in `dedbd32` and still worth having — one map view
fetches dozens of tiles and a pan fetches hundreds, so map browsing really can
starve the rest of the API. But it was not this bug, and I should not have
presented it as the likely answer.

## Please leave alone

- The snapping engine (`path-snap.ts`, `pathNetworkSource.ts`,
  `pathSnapping.ts`). All three are identical on both branches and all three
  are working. Nothing in them needs touching.
- `routeOfflineDownload` stays `false`.
- The pre-existing API typecheck errors.

## When you are done

Load the route map, draw a line over a mapped path, and tell me what the
readout under the map says. If it still fails, the Network tab's status for
`path-snap` is the single most useful thing you can send — that one number is
what turned this from guesswork into a diagnosis.
