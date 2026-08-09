const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude pnpm's temporary _tmp_NNN directories from the file watcher.
// pnpm creates and immediately removes these during package installs, and
// Metro's FallbackWatcher crashes with ENOENT when they vanish mid-scan.
//
// Note: blockList accepts a plain RegExp — do NOT require("metro-config") for
// BlockList; metro-config is a transitive dependency not present in EAS build
// environments and will crash the Metro bundler step during a cloud build.
const pnpmTmpPattern = /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/;

config.resolver = config.resolver ?? {};
const existing = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existing)
  ? [...existing, pnpmTmpPattern]
  : existing
  ? [existing, pnpmTmpPattern]
  : pnpmTmpPattern;

module.exports = config;
