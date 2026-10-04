# Replit follow-up — offline maps

---

Good work, and thank you for being straight about what you did not verify.
The clock test is the one that mattered most: advancing the injected clock and
watching real tile files get deleted is exactly the proof the 24-hour rule
needed, because expiry here is a licence condition rather than housekeeping.

Three things.

## 1. The five failing chart tests are my mistake, not yours

My last prompt said "if the package.json line conflicts, keep both sides' test
filenames." That was wrong, and it is what imported those failures.

`utils/elevationProfileLive.test.ts` scans
`components/mountain/ElevationProfile.tsx` for a live position marker that
exists only on the `claude/route-map-server` branch. On your tree that
component has no such marker, so the tests correctly report it absent. They are
not offline-map tests and they came along by accident.

Fix: remove that one filename from `scripts.test` in
`artifacts/summit-ready/package.json`. Do not cherry-pick the commit that would
satisfy it — it depends on earlier branch work and would pull in more than this
job needs.

Only these three filenames should have been added:

```
utils/offlineRegions.test.ts utils/dayCache.test.ts utils/tileSource.test.ts
```

If removing it does not take you back to the two known mode-toggle failures,
send me the exact failing test names and I will look.

## 2. The API typecheck failures are not yours

I checked on my branch: `artifacts/api-server` has 19 pre-existing typecheck
errors, in `adjust-plan.ts`, `alpine.ts`, `artwork.ts`, `coach.ts`,
`canonical-history.ts`, `objectStorage.ts` and two test files. Nothing to do
with maps.

So your reading is right and they are not yours to fix. Please leave them
alone — they are a separate job and not part of this one.

## 3. Please push the branch

This is the one I would ask for first.

Right now your workspace is the only copy of the work, and I cannot see any of
it, so I cannot review the filesystem or proxy code. We have been here once
before: your workspace diverged, and preserving three commits of real work took
a deliberate rescue before anything could be reset.

Push to `claude/route-map-server` so it is backed up and reviewable. Keep
`routeOfflineDownload` as `false` in that push — it should stay false until it
is proven on a phone, and pushing does not change that.

## Still open, and worth saying plainly

**The iPhone question.** Those `UrlTile` cache props are documented for Android
and for iOS on Apple Maps only. Until that is tested on an iPhone, we do not
know whether the cache does anything there. If the app uses the Google provider
on iOS, it may be writing tiles that are never read — which is worse than no
offline map, because somebody would set off trusting it. This is the highest
risk left and it can only be answered on a device.

**The web recorder.** Fine to leave. People walk with a phone, and the native
cache is where it matters. Worth a note in the report so nobody later assumes
web is covered.

**The gaps are still gaps.** Until the permanent OpenStreetMap layer is built,
an uncached area offline shows as nothing. That layer needs OSM extract data
that cannot be downloaded from my environment, so it needs to run on yours or
on a machine with open network access. Separate job, after this one is proven.
