/** Read-only review gate. Does not publish, migrate or build native binaries. */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const directory = "docs/releases/privacy-website-2026-10-30";
const review = JSON.parse(fs.readFileSync(`${directory}/review.json`, "utf8"));
const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const commit = git(["rev-parse", review.releaseRef]);
requireThat(commit === review.releaseCommit, "Release ref moved.");
requireThat(git(["rev-parse", `${commit}^`]) === review.baseline, "Release parent is not baseline.");
requireThat(git(["rev-parse", review.backupRef]) === review.backupCommit, "Backup ref moved.");
const changed = git(["diff", "--name-only", review.baseline, commit]).split("\n").sort();
requireThat(JSON.stringify(changed) === JSON.stringify([...review.changed].sort()) && changed.length === 4,
  "Release scope changed.");
for (const file of changed) {
  const bytes = execFileSync("git", ["show", `${commit}:${file}`]);
  requireThat(hash(bytes) === review.fileHashes[file], `Release content changed: ${file}`);
}
requireThat(hash(fs.readFileSync(`${directory}/policy-only.patch`)) === review.patchSha256,
  "Review patch changed.");
const text = fs.readFileSync(`${directory}/POLICY.txt`, "utf8");
for (const phrase of [
  "prepared but not yet deployed", "Existing Android releases",
  "Existing iOS releases", "Current deletion request",
  "Publishing this policy does not repair the live deletion implementation",
  "not a guarantee of provider erasure", "Website serving this revision",
]) requireThat(text.includes(phrase), `Missing rollout qualification: ${phrase}`);
const protectedChanges = git(["diff", "--name-only", review.backupCommit, "--",
  "artifacts/summit-ready", "artifacts/api-server", "lib/db",
  ":(exclude)artifacts/summit-ready/scripts/check-privacy-declarations.py"]);
requireThat(!protectedChanges, `Pre-existing native/API/database work changed:\n${protectedChanges}`);
if (process.argv.includes("--remote")) {
  const refs = git(["ls-remote", "--heads", "origin", review.releaseRef, review.backupRef]);
  for (const [ref, sha] of [[review.releaseRef, commit], [review.backupRef, review.backupCommit]])
    requireThat(refs.split("\n").some(line => line.split(/\s+/)[0] === sha && line.endsWith(ref)),
      `Remote ref not verified: ${ref}`);
}
console.log("PASS: pinned four-file scope, hashes, backup, rollout wording and unchanged native/API/database sources.");
console.log("This is a source review gate, not permission to publish or proof of live backend/native behaviour.");
