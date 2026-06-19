const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Removes android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK from the
 * generated AndroidManifest.xml. expo-audio adds this permission
 * automatically but the app only plays short celebration sounds in the
 * foreground — no background audio service is used — so the permission is
 * unnecessary and causes Google Play to require a compliance video.
 */
module.exports = function withRemoveMediaPlaybackPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];
    manifest["uses-permission"] = permissions.filter(
      (p) =>
        p.$?.["android:name"] !==
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
    );
    return config;
  });
};
