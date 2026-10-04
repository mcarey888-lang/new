# Replit answer — push a separate branch

Pick **"Push a separate backup branch"**. Then paste the text below.

---

Please choose the separate branch, not the merge. Do not merge, and do not
push to `claude/route-map-server`.

## Why the merge is the wrong one

Your plan was to make GitHub's current app files match the workspace. That
would overwrite 21 commits of work the workspace has never had. Not just the
offline modules — the whole route map server and the tracking work:

- `src/routes/route-map-web.ts`, `path-snap.ts`, `route-profile.ts`,
  `route-gpx.ts`, `planned-routes.ts`, `map-tiles.ts` and their services
- `app/route-planner.tsx`
- `utils/offRoute.ts` and the off-route banner in `app/hike-tracking.tsx`
- `utils/routeProgress.ts` and the live marker in
  `components/mountain/ElevationProfile.tsx`

You are right that the previous commits stay reachable in the history. But the
branch tip is what anyone checks out, what the app builds from, and what I read
when reviewing. Work that only exists behind a merge commit is work that has
been removed in every practical sense.

This is also why those five chart tests failed on your tree: the workspace does
not have the branch's app changes. That is a reason to keep the two sides
apart, not to flatten one onto the other. The app has reverted on us once
already this month from exactly this shape of problem.

## What to do instead

Push your work to a new branch of its own:

```
git push -u origin HEAD:replit/offline-maps-plumbing
```

Nothing is overwritten, nothing needs reconciling, and both sides stay intact.
I will then read your filesystem, sweep and proxy code and combine the two
properly — file by file, with both versions in front of me — rather than one
side silently winning.

If that push is also rejected, tell me the exact error rather than working
around it.

## Still as before

- Leave `routeOfflineDownload` as `false`.
- Leave the API typecheck errors alone.
- Do not force-push anything, to any branch. You were right to rule that out.

Thank you for stopping to ask rather than merging. That was the right call —
the merge would have been expensive to undo.
