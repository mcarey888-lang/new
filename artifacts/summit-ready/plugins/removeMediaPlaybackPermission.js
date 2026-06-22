const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Removes android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK from the
 * generated AndroidManifest.xml. expo-audio adds this permission
 * automatically but the app only plays short celebration sounds in the
 * foreground — no background audio service is used — so the permission is
 * unnecessary and causes Google Play to require a compliance video.
 *
 * Two-step fix:
 * 1. Remove the uses-permission entry
 * 2. Remove foregroundServiceType="mediaPlayback" from any service that
 *    declares it — Android infers the permission requirement from the
 *    service type even without an explicit uses-permission entry.
 */
module.exports = function withRemoveMediaPlaybackPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Step 1: remove the uses-permission entry
    const permissions = manifest["uses-permission"] ?? [];
    manifest["uses-permission"] = permissions.filter(
      (p) =>
        p.$?.["android:name"] !==
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
    );

    // Step 2: strip foregroundServiceType="mediaPlayback" from all services
    const application = manifest.application?.[0];
    if (application?.service) {
      application.service = application.service.map((service) => {
        const fgType = service.$?.["android:foregroundServiceType"];
        if (!fgType) return service;

        // Remove "mediaPlayback" from the foregroundServiceType value
        // (it may be pipe-separated with other types e.g. "location|mediaPlayback")
        const cleaned = fgType
          .split("|")
          .map((t) => t.trim())
          .filter((t) => t !== "mediaPlayback")
          .join("|");

        const updated = { ...service.$};
        if (cleaned) {
          updated["android:foregroundServiceType"] = cleaned;
        } else {
          delete updated["android:foregroundServiceType"];
        }

        return { ...service, $: updated };
      });
    }

    return config;
  });
};
