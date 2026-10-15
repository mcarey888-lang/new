# SummitReady — brief for an autonomous tester

For an agent driving the app directly: a browser against the web build, or
Maestro against an Android build. Read it all before you start.

## Rules

- **Do not edit source.** You are testing, not fixing. Report, do not repair.
- **Use a fresh test account.** Never the owner's.
- **You are writing to the production database.** The preview build uses the
  test sign-in instance but points at the live API, so every hike you record and
  every session you log becomes a real row under your test user. Say in your
  report roughly how much data you created.
- **Check before reporting a gap.** The "deliberately absent" list below is the
  design, not a backlog.

## Known trap — do not get stuck

The demo onboarding is a closed loop with no exit:

```
training-plan-ready → account → paywall → expedition-choose → expedition-concept
→ expedition-location → expedition-local-hills → expedition-dashboard
→ training-plan-ready → …
```

Enter `/onboarding-demo` and you cannot leave by tapping. Note it once as a
confirmed bug, restart, and move on. Do not keep going round.

## Deliberately absent — not bugs

- **Route data for almost every mountain.** Four routes in the whole catalogue
  are verified and all four are on Mount Fuji. "No routes" on a British hill is
  the catalogue being honest.
- **Photographs for most hills.** They draw a stylised illustration instead.
- **Ticks do not sync.** Device only; they do not survive a reinstall.
- **A tick credits nothing** — no ascent, no training, no expedition progress.
  Report it only if the UI implies otherwise.

On the web build also ignore: GPS recording, background tracking and purchases.
Those are native and do not work in a browser.

## Where the bugs actually are

1. **Offline.** Put the device in aeroplane mode.
   Starting a hike must never wait for network or GPS — a disabled or spinning
   Start is serious. Recording must continue and save locally. Sign-in with no
   network must say it cannot reach the service, not that it is still loading.
2. **Recording.** Start, run, pause, resume, finish.
   Does the timer survive backgrounding? Does the saved distance, ascent and
   time match what the screen showed? Try a very short recording, and one
   paused for a long time.
3. **Manual hike entry**, for when GPS fails. It is expected to credit no
   expedition stage. Report what the UI claims against what actually changes.
4. **Invented numbers.** Nothing may show a figure the app has not measured; a
   missing value renders as a dash, never as 0 and never as an estimate.
   Flag any of these on sight — they are old prototype values and must not
   appear in a build: 52%, 55%, 63%, 67%, Mont Blanc, Kilimanjaro, Everest,
   Helvellyn, Striding Edge, 950 m, 820 m, 10.4 km, 12,420, 88,429.
5. **Raw internal strings.** Expedition screens have shown "provenance
   unavailable", "status not provided", "identity unavailable" and bare
   summit/route IDs. Screenshot any you find.
6. **Empty states.** A brand new account must never show a blank or broken
   screen. Visit every tab before doing anything else and report what a new
   user sees.

## New this week — verify specifically

- Track opens on a map with a compact bottom sheet. The sheet collapses, and a
  tapped summit is not hidden behind it.
- While recording: one clock in the sheet header, three metrics below
  (Distance / Ascent / Avg pace), and a small elevation line that appears only
  once there are enough GPS readings.
- Tap a summit: a card appears with nearby car parks. Press "Plan a route to
  here" — **the car parks must stay on screen.**
- The card offers "Tick off as climbed". Ticking turns that summit's pin green;
  tapping again unticks it.

## Reporting

For each finding: what you did, what you expected, what happened, a screenshot,
and how serious you judge it. Keep confirmed reproductions separate from things
you saw once. At the end, list what you could not test and why.

Do not fix anything.
