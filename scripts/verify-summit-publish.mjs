// Read-only acceptance check. No tokens, mutations, AI calls or mobile builds.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { captureBuildProvenance } = require("../artifacts/summit-ready/server/build-provenance.cjs");
const [baseArgument, ...options] = process.argv.slice(2);
if (!baseArgument) throw new Error("Usage: node scripts/verify-summit-publish.mjs <production URL> --after=<ISO time> [--asset-origin=<URL>]");
const base = new URL(baseArgument);
const after = options.find(value => value.startsWith("--after="))?.slice(8);
if (!after || !Number.isFinite(Date.parse(after))) throw new Error("A valid --after=<ISO time> is required");
const allowedOrigins = new Set([base.origin, ...options
  .filter(value => value.startsWith("--asset-origin=")).map(value => new URL(value.slice(15)).origin)]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = captureBuildProvenance(root, new Date().toISOString());
const checks = [];
async function check(name, run) {
  try { checks.push({ name, passed: true, evidence: await run() }); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); }
}
async function get(url, headers = {}) {
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache", ...headers },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${new URL(url).pathname}`);
  return response;
}
for (const platform of ["ios", "android"]) {
  await check(`${platform} hosted manifest and bundle`, async () => {
    const url = new URL("/mobile/manifest", base);
    url.searchParams.set("verification", String(Date.now()));
    const response = await get(url, { "expo-platform": platform });
    const type = response.headers.get("content-type") ?? "";
    if (!/application\/(?:expo\+)?json/i.test(type))
      throw new Error(`Expected JSON manifest; received ${type}. Do not treat homepage HTTP 200 as success.`);
    const manifest = await response.json();
    if (!(Date.parse(manifest.createdAt) > Date.parse(after)))
      throw new Error(`Manifest is not newer than ${after}`);
    const provenance = manifest.extra?.summitReadyBuild;
    if (provenance?.verificationSourceHash !== expected.verificationSourceHash)
      throw new Error("Manifest source fingerprint does not match this workspace's verification files");
    const asset = new URL(manifest.launchAsset?.url);
    if (asset.protocol !== "https:" || !allowedOrigins.has(asset.origin))
      throw new Error("Launch asset origin is not explicitly allowed");
    const bundle = await get(asset);
    const bytes = Buffer.from(await bundle.arrayBuffer());
    const text = bytes.toString();
    for (const token of ["summitTickToggled", "summitready_summit_ticks", "heroSlotRevision"]) {
      if (!text.includes(token)) throw new Error(`Hosted bundle is missing ${token}`);
    }
    return {
      createdAt: manifest.createdAt, provenance, assetUrl: asset.href,
      bundleSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}
await check("live summit tick and parking synthesis", async () => {
  const url = new URL("/api/route-map", base);
  url.searchParams.set("verification", String(Date.now()));
  const response = await get(url);
  const text = await response.text();
  for (const token of ["summitTickToggled", "setSummitTicks", "keepSummitCardForPlanning();",
    "refreshSummitTick(summitCardLast.p)"]) {
    if (!text.includes(token)) throw new Error(`Live map script is missing ${token}`);
  }
  const planStart = text.indexOf('document.getElementById("summitPlanRoute").onclick');
  const plan = text.slice(planStart, text.indexOf("\n  };", planStart));
  if (!plan.includes("keepSummitCardForPlanning()") || plan.includes("hideSummitCard("))
    throw new Error("Planning handler does not retain the summit popup");
  const tickStart = text.indexOf("function setSummitTicks");
  const tick = text.slice(tickStart, text.indexOf("\n}", tickStart));
  if (tick.includes("showSummitCard(") || tick.includes("hideSummitCard("))
    throw new Error("Tick update rebuilds or closes the parking popup");
  if (response.headers.get("cache-control") !== "no-cache")
    throw new Error("Map page is missing Cache-Control: no-cache");
  return { cacheControl: response.headers.get("cache-control"), etag: response.headers.get("etag"),
    note: "Served-code verification, not a browser interaction or phone test." };
});
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), expectedVerificationSourceHash: expected.verificationSourceHash, checks }, null, 2));
if (checks.some(result => !result.passed)) process.exitCode = 1;
