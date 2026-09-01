# Reddit Conversions API setup

Summit Ready continues to use Firebase Analytics as its primary analytics system. The Android app mirrors only these milestones to the Replit API:

- `first_open`
- `readiness_test_completed`
- `readiness_score_viewed`
- `subscription_started`
- `purchase`

The API forwards them to Reddit CAPI v3 with `action_source: "APP"`. No Reddit credential is compiled into the Android app.

## Replit Secrets

Create these server-side secrets in the Replit project:

- `REDDIT_PIXEL_ID`: the Pixel ID shown in Reddit Events Manager
- `REDDIT_CAPI_ACCESS_TOKEN`: the conversion access token generated in Reddit Events Manager

For a temporary Events Testing run, also create:

- `REDDIT_CAPI_TEST_ID`: the current test ID copied from **Events Manager → Event Testing**
- `REDDIT_CAPI_TEST_KEY`: a long random value used only to protect the manual test endpoint

Never create `EXPO_PUBLIC_...` versions of these values. Never paste them into source control, the app bundle, screenshots, or chat.

## Events Testing

After deploying the API, run the following from Replit Shell. Substitute the test key locally; do not commit it:

```sh
curl -X POST https://summitready.uk/api/reddit-conversions/test \
  -H "Content-Type: application/json" \
  -H "X-Reddit-Test-Key: $REDDIT_CAPI_TEST_KEY" \
  -d '{"eventName":"first_open"}'
```

Repeat with `readiness_test_completed`, `readiness_score_viewed`, `subscription_started`, and `purchase`.

In Reddit **Events Manager → Event Testing**, each event should appear within a few seconds. Expand it and verify:

- setup method is Conversions API
- action source is APP
- the received Pixel ID is correct
- conversion ID is populated
- match keys include UUID and, when available, IP/user agent
- `purchase` contains GBP value and product metadata

Remove `REDDIT_CAPI_TEST_ID` and `REDDIT_CAPI_TEST_KEY` from Replit Secrets after testing. Production app events never include a test ID.

## Production verification

Install a fresh Android build, open it, finish the readiness questionnaire, view the dashboard score, and complete a store test purchase. Then check **Events Manager → Diagnostics** for malformed payloads, missing match keys, stale timestamps, or authorization errors. Counts in Reddit should be compared with the corresponding Firebase events; Firebase remains the source of truth.

The app retries `first_open` on a later launch if the API was unavailable. Other event forwarding is best-effort and never blocks the app or Firebase logging.
