/**
 * Build-time values that reach the app through `app.config.js`.
 *
 * Kept behind a function rather than read inline so the one place that touches
 * `expo-constants` is here, and so a test can reason about a missing value
 * without mocking the module.
 */

import Constants from "expo-constants";

/**
 * The Ordnance Survey Maps key, or null.
 *
 * Null whenever `OS_MAPS_KEY` was not set at build time. That is a supported
 * state, not a failure: the map falls back to the platform basemap.
 */
export function osMapsKey(): string | null {
  const value = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.osMapsKey;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
