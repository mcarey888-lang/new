/**
 * Dynamic Expo config.
 *
 * `app.json` stays the base and holds everything static. This file exists for
 * the two values that must NOT be committed: the Google Maps Android key and
 * the Ordnance Survey Maps key. Both live in Replit Secrets, and static JSON
 * cannot read an environment variable, which is why they were never wired up
 * — the secrets existed but nothing carried them into the build.
 *
 * WHY `extra` FOR THE OS KEY
 * Expo only inlines environment variables into the client bundle when they are
 * prefixed `EXPO_PUBLIC_`. `OS_MAPS_KEY` is not, so it would be invisible at
 * runtime. This file runs in Node at build time, where it can read the bare
 * name, and passes it through `extra`, which ships in the manifest and is read
 * with `expo-constants`. Renaming the secret would work too; not renaming it
 * avoids breaking anything else that already reads it.
 *
 * NEITHER KEY IS SECRET ONCE SHIPPED. Both are sent from the device, so both
 * are extractable from the build. Keeping them out of git narrows who sees
 * them; what actually protects them is restriction at the provider — package
 * name plus signing certificate for the Android Maps key, and whatever the OS
 * Data Hub offers for the tile key. Set both.
 *
 * A missing key is not an error here. The map falls back to the platform
 * basemap and the tile layer is simply not drawn, so a developer without the
 * secrets still gets a working app.
 */

module.exports = ({ config }) => ({
  ...config,

  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      // Undefined when unset, which Expo omits rather than writing "undefined"
      // into the manifest.
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY || undefined },
    },
  },

  // iOS stays on Apple Maps: react-native-maps' default there, no key, no
  // billing. A tile overlay renders over either provider.

  extra: {
    ...config.extra,
    osMapsKey: process.env.OS_MAPS_KEY || undefined,
  },
});
