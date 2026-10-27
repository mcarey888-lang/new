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
