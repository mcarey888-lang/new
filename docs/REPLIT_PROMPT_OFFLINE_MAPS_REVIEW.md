# Replit — review of `backup/offline-os-maps-wiring-2026-10-04`

I have read the code. One real bug, two things to check on a device, one small
risk. Everything else is sound, and several decisions are better than what I
asked for.

---

## Things you got right that I did not ask for

**The mtime insight.** Your comment — *"Never reconstruct age from mtime:
UrlTile updates mtime even on cache reads"* — is the best catch in the branch.
Had age come from mtime, every read would have renewed it and tiles would never
have expired. The cache would have looked like it was working while quietly
sitting outside the licence. I did not think of that.

**The separate display directory.** The renderer writes into `tileCachePath`,
so pointing it at the authoritative store would have let native writes
contaminate the records that decide expiry. Copying into a short-lived lease
keeps the authority clean.

**Lease expiry at the earliest tile, not the lease.** `expiresAt` is the
minimum across every tile, so the overlay dies when the *oldest* tile runs out.
Conservative in the right direction.

**Not logging the fetch error object,** because a thrown fetch error can carry
the upstream URL and the URL carries `?key=`. That is a real way keys end up in
logs, and you logged only `z/x/y`.

**The OS attribution line.** A licence condition I never mentioned. Thank you.

**`PROVIDER_DEFAULT` on the MapView.** That puts iOS on Apple Maps, which is
exactly where `UrlTile` caching is supported, so you have answered my iPhone
concern at the code level. It still needs confirming on a handset, but the
choice is right.

I verified by hash that `dayCache.ts`, `tileSource.ts`, `offlineRegions.ts`,
`offRoute.ts` and `routeProgress.ts` are byte-identical to the originals, and
that `tileCacheMaxAge` is not used anywhere. Both as asked.

---

## The bug: a long route will fail its download on a fast connection

In `map-tiles.ts`:

```js
if (++budget.count > 1000 || ++osGlobal.count > 3000) {
  res.set("Retry-After", "60").status(429).end(); return;
}
```

1,000 tiles per IP per minute. I measured what a route actually needs using
`tilesForRoute` at the shipped zoom range:

| Walk | Tiles |
|---|---|
| 5 km | 219 |
| 10 km | 378 |
| 20 km | 708 |
| 30 km | 1,038 |

Those are straight lines, which is the cheapest possible shape — a horseshoe or
a wandering valley route covers more ground and needs more.

So a 30 km walk needs more tiles than one minute's budget allows. Whether it
fails depends on connection speed, which is the worst property a bug can have:

- Slow mobile data: ~150 ms a tile, so 1,000 tiles spans two or three minute
  windows, each one under the cap. It works.
- Home wifi: ~30 ms a tile, so 1,000 tiles arrive inside one window. It hits
  the cap at tile 1,001.

And nothing retries. `download()` throws on any non-200, `downloadRoute` does
not catch it, so one 429 aborts the whole route download. Someone preparing for
a big day, on good wifi, gets a failure — while the same route on a worse
connection succeeds.

**Please fix both halves:**

1. Raise the per-IP budget so one honest route download fits with room to
   spare. The cap is there to stop a runaway client costing money, and it can
   do that at a much higher number — a route is capped at 4,000 tiles anyway.
2. Handle 429 in the client: respect `Retry-After`, wait, and resume. The
   partial download already survives, because `planFor` skips what is on disk,
   so a resume is cheap. A failed download that could have waited ten seconds
   is not a good trade.

Please also reconsider the global 3,000/minute for the same reason: three
people downloading routes at once would collide.

---

## Two things only a device can answer

**Does `req.ip` mean anything in deployment?** Behind a load balancer or proxy,
`req.ip` is the proxy's address unless Express `trust proxy` is set — in which
case every user shares one 1,000/minute budget and the bug above becomes
everyone's. Worth checking what it actually resolves to in the deployed app.

**How long does `display()` take?** It copies every fresh tile into a new lease
directory, and it runs on every foreground. For a 30 km route that is about
1,000 file copies each time the app comes back, and roughly 35 MB duplicated
while the lease is held, so peak disk is double what the download reported.
That may be fine, or it may be a visible stall every time somebody checks the
map on a hill. Please time it with a real route on a real phone.

---

## A smaller risk worth knowing about

`manifest()` writes the pending file, removes `manifest.json`, then moves the
pending one into place. A crash between the remove and the move leaves no
manifest, and `init()` then treats every tile on disk as an orphan and deletes
the lot.

It fails in the safe direction — deleting rather than over-retaining is the
right way round for a licence — so this is not urgent. But it throws away a
whole download for a crash at one unlucky moment. If `move` can overwrite an
existing destination, dropping the `remove` closes the window entirely. Worth a
look, not worth blocking on.

---

## What stays as it is

The flag stays `false`. The `__DEV__` escape in `OsMapTiles` and the
attribution is a reasonable way to preview without flipping it, and you
disclosed it, which is what matters.

Once the rate limit is fixed and you have timings from a phone, this is ready
for me to merge into `claude/route-map-server`. Good work.
