/**
 * What this build of SummitReady can genuinely do.
 *
 * The approved Mountain Detail design offers "View in 3D" and "Download for
 * offline use" on a selected route. NEITHER CAPABILITY EXISTS IN PRODUCTION
 * TODAY — there is no 3D renderer, and no offline route/map packaging of any
 * kind. Rather than draw a control that cannot work, the screen asks here.
 *
 * These flags are deliberately not configuration. They are a statement of what
 * the app can do, so that when a capability is genuinely built, one flag flips
 * and the approved control appears — with its safety gate already in place
 * (`utils/routeEligibility.ts` still requires a verified route for offline).
 *
 * Do not set either of these true without the capability actually existing.
 */
export const CAPABILITIES = {
  /**
   * A 3D view of a canonical route.
   *
   * Absent. Production has 2D map thumbnails only, and choosing a 3D provider
   * carries licensing decisions that are not this batch's to make.
   */
  routeView3D: false,

  /**
   * Offline packaging of a verified route for navigation.
   *
   * Absent. There is no offline map or route package in production. Recorded
   * ACTIVITIES are already offline-first — that is a different thing and is
   * unaffected by this flag.
   */
  routeOfflineDownload: false,
} as const;

export type CapabilityName = keyof typeof CAPABILITIES;
