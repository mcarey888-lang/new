/** Builds a reviewable /tmp release snapshot. NEVER publishes or changes HEAD.
 * Only the policy + website consent are overlaid onto the supplied live commit. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const baseline = process.argv[2];
if (!baseline || !/^[a-f0-9]{40}$/.test(baseline)) throw new Error("Supply the verified live 40-character commit, not HEAD.");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "summitready-policy-release-"));
const archive = path.join(temp, "baseline.tar");
const out = path.join(temp, "release"); fs.mkdirSync(out);
execFileSync("git", ["archive", baseline, "-o", archive], { cwd: root });
execFileSync("tar", ["-xf", archive, "-C", out]); fs.unlinkSync(archive);
function hashes(dir, prefix = "") {
  const result = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name), full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, hashes(full, relative));
    else if (entry.isFile()) result[relative] = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
  }
  return result;
}
const before = hashes(out);
const base = "artifacts/summit-landing/";
for (const relative of ["src/pages/Privacy.tsx", "src/components/WebsitePrivacy.tsx"]) {
  fs.copyFileSync(path.join(root, base, relative), path.join(out, base, relative));
}
const index = path.join(out, base, "index.html");
const oldIndex = fs.readFileSync(index, "utf8");
const nextIndex = oldIndex.replace(/\s*<!-- Google tag \(gtag\.js\) -->\s*<script[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/, "\n    <!-- Analytics is opt-in via WebsitePrivacy. -->");
if (nextIndex === oldIndex && oldIndex.includes("googletagmanager.com")) throw new Error("Unrecognised baseline analytics tag: manual review required.");
fs.writeFileSync(index, nextIndex);
const main = path.join(out, base, "src/main.tsx");
let content = fs.readFileSync(main, "utf8");
if (!content.includes('import App from "./App";') || !content.includes("</BrowserRouter>")) throw new Error("Unrecognised baseline root: manual review required.");
content = content.replace('import App from "./App";', 'import App from "./App";\nimport { WebsitePrivacy } from "./components/WebsitePrivacy";')
  .replace("</BrowserRouter>", "<WebsitePrivacy />\n  </BrowserRouter>");
fs.writeFileSync(main, content);
const after = hashes(out);
const changed = Object.keys(after).filter(key => after[key] !== before[key]).sort();
const allowed = ["index.html", "src/main.tsx", "src/pages/Privacy.tsx", "src/components/WebsitePrivacy.tsx"].map(p => base + p).sort();
if (JSON.stringify(changed) !== JSON.stringify(allowed)) throw new Error("Unexpected changed files; release rejected.");
const review = { baseline, source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), changed, fileHashes: Object.fromEntries(changed.map(key => [key, after[key]])), published: false, warning: "Snapshot only. Native/backend privacy changes are NOT included; policy describes their rollout. Recheck live baseline and build/review this snapshot before any publication. Do not use normal Publish from the current workspace." };
fs.writeFileSync(path.join(temp, "review.json"), JSON.stringify(review, null, 2));
console.log(JSON.stringify({ snapshot: out, review: path.join(temp, "review.json"), changed, published: false }, null, 2));
