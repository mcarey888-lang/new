# Replit — verify the summit pin endpoint against the real database

---

Thank you for the catalogue audit. It answered the question and moved most of
the design: prominence and classifications are exactly what the map needed,
and the GiST index on `geom` means the migration I was about to ask you to
sign off on is unnecessary.

I have built the query and endpoint on that. I cannot reach the database from
my environment, so **the SQL has never returned a real row.** It is tested for
shape and safety only. That is what I need from you.

## 1. Bring it across

Two apply cleanly onto your branch. I tested this against
`backup/offline-os-maps-wiring-2026-10-04` at `ea8fc48` in a scratch worktree:

```
git fetch origin claude/route-map-server
git cherry-pick 9d1ce26 bde7a14
```

The third touches `app.ts`, where you have since added the `os-outdoor`
bypass, so it conflicts. Take it without committing and resolve by hand:

```
git cherry-pick -n 6774a79 9d80a68
```

Then in `app.ts`, keep your version entirely and add this immediately above
the existing `/map-tiles/` branch:

```js
  // Summit pins ride the map budget: the map asks for them on every pan, for
  // the same reason and at the same rate as tiles.
  if (req.method === "GET" && req.path === "/summits") {
    return mapTilesLimiter(req, res, next);
  }
```

Keep your limiter name and your `os-outdoor` bypass. I verified this
resolution: 62 tests pass and both the bypass and the globe work survive.

## 2. The one that matters — does it use the index?

```sql
EXPLAIN ANALYZE
SELECT m.id FROM public.mountains AS m
WHERE m.geom && ST_MakeEnvelope(-4.2, 52.98, -3.9, 53.15, 4326)
  AND m.prominence_m IS NOT NULL AND m.prominence_m >= 100;
```

**Please paste the plan back.** I need to see `Index Scan using
ix_mountains_geom_gist` or a bitmap scan over it. If it says `Seq Scan`, the
whole design needs revisiting before anything is built on top, because the map
runs this on every pan.

## 3. Does it return the right hills?

Start the server and call it. Snowdonia, zoomed in:

```
GET /api/summits?bbox=-4.2,52.98,-3.9,53.15&zoom=14
```

I would expect Yr Wyddfa around 1085 m, Tryfan, the Glyderau, Crib Goch.
Please send the first few entries verbatim so I can check the shape.

Three things I specifically want to know:

- Does the **name** come back split? `"Yr Wyddfa"` with `"Snowdon"` as the
  alternative, or whichever way round DoBIH writes it — not one string with
  square brackets in it.
- Is the **place** readable? It should say something like `"Gwynedd, Wales"`,
  not the catalogue region code `"17A: ..."`.
- Is **ascent** `{"kind":"unknown"}` on every one? It should be. There are 23
  route facts against 21,792 mountains, so anything else means a number is
  coming from somewhere it should not.

## 4. The zoomed-out band

```
GET /api/summits?bbox=-8,54.5,-1.5,58.8&zoom=7     (Scotland)
GET /api/summits?bbox=-5,51.3,-3,53.5&zoom=7       (Wales)
```

Scotland should come back full of Munros and Corbetts. **Wales is the one I
want checked**, because I got this wrong and fixed it an hour ago.

The widest band originally filtered on Munros, Corbetts and Wainwrights alone.
Those are Scottish and Lake District lists, so Wales, Ireland, the Peak
District and Dartmoor came back completely empty — a map of Britain with no Yr
Wyddfa on it. There is now a second way in: 500 m of prominence, which works
everywhere a list does not.

So Wales at zoom 7 should return a handful of hills, not zero. If it returns
zero, the fix did not work and I need to know.

## 5. Two numbers

- **How long** does the Snowdonia call take, warm?
- At zoom 7 over the whole of Britain (`bbox=-8,50,-1,59`), does the response
  say `"truncated": true`? It probably should, and I want to know the cap is
  actually biting rather than silently never reached.

## What not to do

- **Do not add any index.** The one that matters already exists. If the plan
  shows a sequential scan, tell me and we will work out why rather than
  reaching for a new index.
- **Do not write to the engine database.** This is read-only, through the
  existing read-only pool.
- Leave `routeOfflineDownload` as `false`.

## If something is wrong

Send me the error and the plan rather than fixing the SQL. I would rather
correct my own query than have two versions of it.
