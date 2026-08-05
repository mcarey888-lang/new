const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude pnpm's temporary _tmp_NNN directories from the file watcher.
// pnpm creates and immediately removes these during package installs, and
// Metro's FallbackWatcher crashes with ENOENT when they vanish mid-scan.
const { BlockList } = require("metro-config");
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/,
];

module.exports = config;
