const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// With use_frameworks! :linkage => :static, CocoaPods sets DEFINES_MODULE=YES
// for all pods, making them strict "framework modules" that reject non-modular
// header includes. React-Core is NOT declared with :modular_headers => true in
// RN 0.81.5, so RNFBApp (a framework module) can't #import <React/RCTConvert.h>.
//
// Fix: set DEFINES_MODULE=NO for all RNFB* targets in post_install.
// They remain compiled as static frameworks (required for pod install) but lose
// the "framework module" designation, which lifts the non-modular header restriction.

module.exports = function withDefinesModuleOff(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const GUARD = "RNFB_DEFINES_MODULE_OFF";
      if (podfile.includes(GUARD)) {
        return config;
      }

      // Simple Ruby: for every RNFB* pod target, disable DEFINES_MODULE.
      const rubyFix =
        "  # RNFB_DEFINES_MODULE_OFF — disable framework-module restriction for firebase pods\n" +
        "  installer.pods_project.targets.each do |target|\n" +
        "    if target.name.start_with?('RNFB')\n" +
        "      target.build_configurations.each do |build_config|\n" +
        "        build_config.build_settings['DEFINES_MODULE'] = 'NO'\n" +
        "      end\n" +
        "    end\n" +
        "  end\n";

      const OPEN = "post_install do |installer|";
      const openIdx = podfile.indexOf(OPEN);

      if (openIdx !== -1) {
        // Walk forward from after the opening to find the matching closing `end`.
        let depth = 1;
        let closeIdx = -1;
        let pos = openIdx + OPEN.length;

        while (pos < podfile.length) {
          const nextNewline = podfile.indexOf("\n", pos);
          const lineEnd = nextNewline === -1 ? podfile.length : nextNewline;
          const line = podfile.slice(pos, lineEnd).trim();

          if (
            line.includes(" do |") ||
            line.endsWith(" do") ||
            /^(if|unless|while|until|for|begin|def |class |module |case )\b/.test(
              line
            )
          ) {
            depth++;
          } else if (
            line === "end" ||
            line.startsWith("end ") ||
            line.startsWith("end\t") ||
            line.startsWith("end#")
          ) {
            depth--;
            if (depth === 0) {
              closeIdx = pos;
              break;
            }
          }
          pos = lineEnd + 1;
        }

        if (closeIdx !== -1) {
          podfile =
            podfile.slice(0, closeIdx) +
            rubyFix +
            podfile.slice(closeIdx);
        } else {
          const insertAt = openIdx + OPEN.length;
          podfile =
            podfile.slice(0, insertAt) + "\n" + rubyFix + podfile.slice(insertAt);
        }
      } else {
        podfile += "\npost_install do |installer|\n" + rubyFix + "end\n";
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
