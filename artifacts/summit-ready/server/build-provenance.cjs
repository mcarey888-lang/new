const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

// Only source files, never environment files, credentials or user data.
const verificationFiles = [
  "artifacts/api-server/src/routes/summit-layer-script.ts",
  "artifacts/summit-ready/components/SharedTrackScreen.tsx",
  "artifacts/summit-ready/utils/mountainArtworkSlots.ts",
  "artifacts/summit-ready/scripts/build.js",
  "artifacts/summit-ready/server/serve.js",
  "artifacts/summit-ready/server/build-provenance.cjs",
  "artifacts/summit-ready/.replit-artifact/artifact.toml",
];

function captureBuildProvenance(root, builtAt, files = verificationFiles) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
  }
  let gitCommit = null, gitTreeDirty = null;
  try {
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^[a-f0-9]{40}$/.test(revision)) gitCommit = revision;
    gitTreeDirty = Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim());
  } catch { /* Published snapshots need not include Git; the source hash still works. */ }
  return {
    builtAt, gitCommit, gitTreeDirty,
    verificationSourceHash: hash.digest("hex"),
    verificationFiles: files,
  };
}

module.exports = { captureBuildProvenance };
