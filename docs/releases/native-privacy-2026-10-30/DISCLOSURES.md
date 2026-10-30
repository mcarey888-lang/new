# Provider/data assessment for the prepared candidate

These findings describe source/configuration, not a certification of an
installed binary's network traffic. The website policy deliberately separates
older live releases from these prepared controls. Public publication, production
schema/API activation and store submission have not occurred in this work.

## Both native platforms — requested/essential processing

Account name, email and user ID: account management/authentication and app
functionality (Clerk and app backend). Purchases: store/RevenueCat entitlement,
restore and billing processing, plus the service's subscription reporting.
Fitness/profile, saved precise/coarse location and GPS tracks, history,
achievements, uploaded photos/covers, community posts/comments/likes, support and
necessary diagnostics: requested app functionality, and product personalisation
where fitness/AI coaching/user content is used. Saved records are linked to
identity. Device permission or making a purchase is not advertising consent.
Map/weather/AI/storage/auth/billing providers receive the data necessary for
requested features. Processor transfers require the actual contractual Google
sharing-exception assessment, not an automatic blanket exemption.

Actual GPS/manual activity and progress totals are not analytics substitutes and
remain separate from expedition planning estimates. Declining optional
measurement does not disable sign-in, billing, recording or history.

## iOS

- Firebase Analytics starts disabled in native configuration; wrapper events
  require the explicit analytics choice. Permitted event properties are method,
  plan, value and currency; screen names/feature event names also describe usage.
- Firebase app-instance IDs, SDK device/network information and usage/purchase
  events are pseudonymous optional Analytics, not anonymous.
- No iOS Reddit relay path. IDFA support is excluded, IDFV collection disabled
  and Google advertising storage/user-data/personalisation signals denied.
- Source declares 13 linked, non-tracking Apple types: Name, Email Address,
  User ID, Fitness, Precise Location, Coarse Location, Photos or Videos,
  Other User Content, Purchase History, Product Interaction, Device ID,
  Customer Support and Other Diagnostic Data.
- App functionality applies to all except Device ID; Analytics additionally
  applies to User ID, Purchase History and Product Interaction, and is the Device
  ID purpose. Product Personalisation additionally applies to Fitness and Other
  User Content. These declarations do not modify App Store Connect forms.
- There is no source-configured cross-app advertising on iOS. Confirm the final
  binary/SDK traffic during owner device testing; do not infer every old build's
  automatic SDK collection from the new wrapper.

## Android

- Firebase follows the separate optional analytics choice, as above.
- Google AAID and SSAID collection are disabled; AD_ID and AdServices advertising
  permissions are blocked in the prepared Expo configuration. Installation UUIDs
  are not Google Advertising ID. Confirm the final merged AAB manifest.
- Separate optional advertising choice enables Reddit conversions. The app/server
  actually send installation UUID, conversion ID, timestamp, feature/conversion
  event, IP and user-agent. Valid purchase events additionally send subscription
  plan/product, value and currency. These are shared for Advertising or marketing,
  including Purchase history, App interactions and Device or other IDs.
- No email/name, numerical readiness/fitness scores, questionnaire text, photos
  or GPS track is included in the conversion schema. Feature event names still
  reveal app interaction; they must not be described as no data sharing.
- IP transmission is confirmed. Provider-side geo derivation/retention is not
  established by the relay code. Treat approximate location as potentially shared
  for advertising pending provider confirmation; do not certify its absence.
  Firebase/GA IP-derived geography similarly needs the provider processing
  assessment for Analytics. Coarse location is also collected for requested
  nearby functionality where used, independently of optional measurement.
- Old Android 94 lacks the new choice and has the older enabled advertising-ID
  configuration. Publishing a policy or API does not reconfigure that binary.
  The new API refuses its unconsented Reddit requests without breaking purchases.

## Website / browser app

Marketing GA script loads only after the website analytics choice; decline and
withdrawal persist, disable future measurement and remove its script/cookies.
Ads storage/user data/personalisation and Google signals are denied/disabled.
Browser-app code does not initialise native Firebase or Reddit.
Website choice is separate from a native app choice.

## Deletion and retention

Checkpointed app record/media cleanup and Clerk removal are distinct from
external erasure. RevenueCat customer deletion is attempted and its failure
recorded. Firebase, Reddit, AI/support/logs/backups and historically unattributed
records need provider/operator review; do not claim all are erased automatically.
Lawfully retained records are reported separately from pending erasure.
Store subscriptions must be cancelled with Apple/Google; app deletion is not
cancellation or a promise to erase legally required financial records.
An operator must establish actual legal basis, provider evidence and retention/
review arrangements. Neither a new retention period nor an erasure guarantee
has been invented. Client withdrawal stops future optional emission, not past
provider-held data.
