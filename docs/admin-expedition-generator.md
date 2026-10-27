# Admin expedition generator

Open **Artwork Admin → Expeditions → Generate expedition**.

1. Enter the target mountain and the area where the local walking stages should be.
2. Optionally narrow the target by country/region, set a 5–100 km search radius,
   choose a difficulty preference, and enter any positive whole-number walking allowance.
   These are not consecutive calendar dates, and unused days do not create filler stages.
   The generated catalogue draft itself supports up to 30 stages.
3. Click **Generate expedition**. If the target mountain or its route is ambiguous,
   explicitly select/narrow the match and retry.
4. Review the unsaved draft: name, description, individual stages, distance,
   ascent, mountain links, reasons, limitations and ordering are editable.
5. Click **Create draft** to save a new catalogue record. Nothing is made
   available to app users at this step.
6. Use the normal owner-review controls to make it available deliberately.
   Artwork generation and image approval remain separate in the existing system.

## Trust and persistence

### Manual mountain selection

Choose **Choose my mountains**, enter the target and local walking area, and
use **Find mountains**. The same safety-filtered pool as the app is returned
with no preselected routes. Choose one route per summit; choosing an alternative
route replaces that summit's previous route. Selection and removal update the
ascent, distance, remaining amounts and symmetric match percentages immediately
using the app's shared calculation, without another provider request.

Use **Build draft** when the selection is ready, then review and save through
the existing editor. Every selected route needs a known distance. Routes with
missing identity cannot be selected. Changes to search inputs clear the pool
and selection to prevent stale choices being submitted. The draft has at most
30 stages; walking allowance remains independent of this limit.

**Use key** now verifies by refetching the protected expedition list. A saved
browser key is not proof of authentication. The key is never returned by the
server, logged or added to query keys.

- Generation uses the same target-resolution, local discovery and matching
  implementation as the app. It is not a second route-generation engine.
- Target fallback profiling can use AI. Local route selection remains the app's
  existing deterministic, provenance-labelled process.
- The response is an unsaved preview with a fresh ID, not a database write.
  Navigating away from a generated draft prompts before discarding it.
- Missing distance/ascent remains blank and prevents saving until supplied.
  Summit altitude and distance from the user are never substituted for route facts.
- Exact canonical summit IDs can be linked. Name-only and other provider IDs
  do not become catalogue IDs. Saving revalidates catalogue bindings through
  the existing import path.
- Estimates, missing source evidence and repeat suggestions remain explicit.
  No GPX or navigation geometry is fabricated by the authoring adapter.
- Saved drafts use the existing create-only importer. Existing IDs are never
  overwritten, and new drafts are not route-approved or image-approved.
- Existing saved expeditions, member activity, subscriptions and production
  settings are unchanged. The broader route-database acquisition remains paused.

## Verification

Backend checks cover draft adaptation, exact stage identity/order, absent
figures, repeat handling, admin authorization, invalid requests, explicit route
selection and bounded concurrent generation. Existing authoring and app-engine
regression tests are included.

Live paid generation is not run automatically as a verification step.
Browser checks use intercepted provider/persistence responses to exercise the
unsaved editor and payload contract without spending AI credits or changing
existing catalogue data.

## Expedition editor artwork

After creating or opening a saved expedition, scroll below the stages to
**Artwork → Choose artwork**. Save unsaved stage edits first. Search the approved
Signatures library, inspect all three image crops, then use **Assign to this
expedition → Confirm assign**. Existing images require a replacement checkbox.

Assignment copies the exact approved source version into the destination's own
artwork namespace, retains source lineage, and costs no AI generation. The source
is unchanged, and the destination remains at its existing availability status.
Later source regeneration/deletion cannot change the copied images.

Both source approval and destination revision are checked again on assignment.
Storage copying completes before publishing new image metadata. Generation and
assignment share a destination lock. If a database commit acknowledgement fails,
copied bytes are retained because a committed record might reference them;
refresh the expedition before retrying. Unreferenced files may remain in this
rare failure state rather than risking removal of referenced images.

## Expedition editor target comparison

Below the stages, **Target comparison → Load target comparison** resolves the
same target profile as the app, without searching for local routes. Loading may
use AI only when the target profile is not cached; it is always an explicit action.
Ambiguous mountain identities and multiple verified routes require a choice.

After loading, stage edits/additions/removals update ascent, distance, remaining
amounts and symmetric match percentages locally. Missing or invalid stage facts
show an incomplete comparison. Target name/route text changes clear the profile.
Scores are diagnostics, not recorded activity or route approval, and do not
overwrite existing stored match scores. Reloading the editor requires explicitly
loading the comparison again.
