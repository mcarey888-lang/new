---
name: EAS build monitoring in Replit sandbox
description: How to reliably kick off and monitor a long-running `eas build` from the agent shell without losing the submission.
---

Running `EAS_NO_VCS=1 npx eas build ...` in the foreground will hit the 120s bash tool timeout long before an Android/iOS build finishes (uploads + remote build queue commonly take 15-25+ min).

**How to apply:**
- Launch it detached: `setsid nohup env EAS_NO_VCS=1 npx eas build --platform <p> --profile <profile> --non-interactive < /dev/null > /tmp/eas_build.log 2>&1 & disown`. Plain `nohup ... &` without `setsid`/`disown`/stdin redirection is not reliable — the process can die silently mid-run (observed dying anywhere from immediately to ~2 min in, with no error in the log).
- The local CLI process is only needed long enough to finish the "Compressing/Uploading/Computing fingerprint" steps and print a build ID + `https://expo.dev/accounts/.../builds/<id>` URL. Once queued, the build runs server-side — if the local process later dies during "Waiting for build to complete", the build is unaffected.
- Poll actual status with `npx eas build:view <build-id> --json` (grep for `"status"` and `"artifacts"`) instead of relying on the local process's stdout. Status progresses `IN_QUEUE`/`IN_PROGRESS` → `FINISHED`/`ERRORED`. `artifacts.buildUrl` appears once finished.
- The signed GCS log file URLs in the JSON response are not plain text (some binary/compressed format that isn't standard gzip) — not worth decoding; rely on `build:view` status instead.
