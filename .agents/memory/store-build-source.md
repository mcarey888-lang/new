---
name: Store build source
description: Preserve the tested workspace snapshot when shared development branches have newer independent changes.
---

Store builds must use the exact tested workspace snapshot, not whichever commit is newest on a shared development branch. If that remote branch has independent changes, push a separate release ref rather than replacing it or silently adding untested changes to the release.

**Why:** Shared map development and Replit workspace development can advance separately. Building directly from the shared branch can omit local fixes or include code not covered by the release checks.

**How to apply:** Compare the workspace and remote revisions before cloud builds, preserve collaborators' branches, and verify the cloud build's reported commit matches the tested release snapshot.

Android signing and Google Play upload credentials are separate. Automatic submission can validate the upload credential before compilation begins, so a missing upload credential can stop an otherwise buildable app during configuration.

**Why:** A GitHub-triggered production build resolved signing successfully but stopped before compilation because its automatic submission expected a private credential file available only in the workspace.

**How to apply:** Run build-only jobs when the cloud upload credential is unavailable. Upload the resulting bundle through Play Console, or configure managed submission credentials separately. Never commit a private service-account key just to make the cloud build find it.

Optional TestFlight test notes can block EAS submission scheduling without stopping the iOS build. Expo may restrict the changelog parameter to its Enterprise plan.

**Why:** The build started successfully, but automatic submission with test notes was rejected. Scheduling the same existing build again without the optional notes succeeded.

**How to apply:** After a partial build/submit failure, confirm the build exists before retrying. Reuse its build ID for submission without plan-restricted notes; do not create a duplicate build.

An App Store Connect upload number does not establish the number of a different, completed EAS artifact. Check the actual EAS build and compare the mobile source tree before changing version settings or creating a replacement.

**Why:** A low-numbered Apple upload appeared to require a rebuild, but a correctly numbered production artifact with the same mobile code was already complete and could be submitted directly. The origin of the lower-numbered upload was not established.

**How to apply:** Reuse a compatible finished artifact when its confirmed version/build exceeds the known store uploads. Report submission queuing separately from Apple processing, and do not claim the separate upload path's counter has been repaired without verifying it.
