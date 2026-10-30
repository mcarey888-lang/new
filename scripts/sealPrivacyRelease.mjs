/**
 * Create durable policy-only Git refs and review exports WITHOUT checkout,
 * staging the workspace, publishing, database writes or starting native builds.
 * Temporary files are disposable: the pinned commit and patch are authoritative.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const baseline = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(baseline ?? "")) throw new Error("Supply a verified live baseline SHA.");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const git = (args, options = {}) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, ...options,
});
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const source = git(["rev-parse", "HEAD"]).trim();
const beforeStatus = git(["status", "--porcelain"]);
const releaseRef = "refs/heads/release/policy-website-20261030";
const backupRef = "refs/heads/backup/before-policy-release-20261030";
const evidence = {};
// This proves hosted mobile provenance, not every independently served artifact.
// Per-artifact deployment approval remains a documented publication gate.
for (const platform of ["android", "ios"]) {
  const response = await fetch("https://summitready.uk/mobile/manifest", {
    headers: { "expo-platform": platform, "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("json"))
    throw new Error("Live manifest is unavailable or an HTML fallback; stop.");
  const manifest = await response.json();
  const provenance = manifest.extra?.summitReadyBuild;
  if (provenance?.gitCommit !== baseline || provenance.gitTreeDirty !== false)
    throw new Error("Baseline is not the clean, live hosted-mobile source; stop.");
  evidence[platform] = { createdAt: manifest.createdAt, provenance };
}
const snapshot = JSON.parse(execFileSync(process.execPath,
  ["scripts/preparePrivacyRelease.mjs", baseline], { cwd: root, encoding: "utf8" }));
const snapshotReview = JSON.parse(fs.readFileSync(snapshot.review, "utf8"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "policy-index-"));
const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, "index") };
const expected = snapshotReview.changed;
git(["read-tree", baseline], { env });
for (const relative of expected) {
  const bytes = fs.readFileSync(path.join(snapshot.snapshot, relative));
  if (digest(bytes) !== snapshotReview.fileHashes[relative]) throw new Error("Overlay hash mismatch.");
  const blob = git(["hash-object", "-w", "--stdin"], { input: bytes }).trim();
  git(["update-index", "--add", "--cacheinfo", `100644,${blob},${relative}`], { env });
}
const tree = git(["write-tree"], { env }).trim();
function existingRef(ref) {
  try { return git(["rev-parse", "--verify", ref], { stdio: ["pipe", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}
let commit = existingRef(releaseRef);
if (commit) {
  if (git(["rev-parse", `${commit}^{tree}`]).trim() !== tree ||
      git(["rev-parse", `${commit}^`]).trim() !== baseline)
    throw new Error("Existing release differs. Do not overwrite a reviewed release ref.");
} else {
  commit = git(["commit-tree", tree, "-p", baseline], {
    input: `Prepare isolated privacy policy and website consent release\n\nBaseline: ${baseline}\nPre-existing work backup: ${source}\nExactly four website files. No backend, native or database changes.\n`,
  }).trim();
  git(["update-ref", releaseRef, commit, "0000000000000000000000000000000000000000"]);
}
const priorBackup = existingRef(backupRef);
if (priorBackup && priorBackup !== source) throw new Error("Existing backup differs; never overwrite it.");
if (!priorBackup) git(["update-ref", backupRef, source, "0000000000000000000000000000000000000000"]);
const actual = git(["diff", "--name-only", baseline, commit]).trim().split("\n").sort();
if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error("Release scope is not exactly four files.");
const output = path.join(root, "docs/releases/privacy-website-2026-10-30");
fs.mkdirSync(output, { recursive: true });
const patch = git(["diff", "--binary", baseline, commit]);
fs.writeFileSync(path.join(output, "policy-only.patch"), patch);
const privacy = git(["show", `${commit}:artifacts/summit-landing/src/pages/Privacy.tsx`]);
const policyText = privacy.slice(privacy.indexOf("<main"), privacy.indexOf("</main>"))
  .replace(/<[^>]+>/g, "").replace(/\{" "\}/g, " ").replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\n[ \t]+/g, "\n").trim();
fs.writeFileSync(path.join(output, "POLICY.txt"), policyText + "\n");
fs.writeFileSync(path.join(output, "live-evidence.json"), JSON.stringify({
  checkedAt: new Date().toISOString(), productionUrl: "https://summitready.uk",
  scope: "Hosted mobile source only; not independent proof of every website/API artifact", evidence,
}, null, 2) + "\n");
fs.writeFileSync(path.join(output, "review.json"), JSON.stringify({
  baseline, sourceHeadBeforePreparation: source, releaseRef, releaseCommit: commit,
  backupRef, backupCommit: source, changed: actual, fileHashes: snapshotReview.fileHashes,
  patchSha256: digest(patch), published: false, nativeBuildStarted: false,
  productionSchemaChange: false, githubPushVerified: false,
  approvalGates: [
    "Confirm current production artifact sources and baseline immediately before publication.",
    "Use a dedicated publication checkout; never normal Publish from the development tree.",
    "Inspect the actual Publish database diff; reject all schema/data changes for this website release.",
    "Review build, preview and rollback before approving publication.",
  ],
}, null, 2) + "\n");
if (git(["rev-parse", "HEAD"]).trim() !== source) throw new Error("Workspace HEAD changed unexpectedly.");
// Only generated review exports may have appeared; pre-existing work is untouched.
console.log(JSON.stringify({ commit, releaseRef, backupRef, backupCommit: source,
  baseline, output, workspaceHeadUnchanged: true, beforeStatus, published: false }, null, 2));
fs.rmSync(temp, { recursive: true, force: true });
