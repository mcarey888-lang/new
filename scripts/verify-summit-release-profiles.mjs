import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Public build configuration only. Never read or print secret environment values.
const config = JSON.parse(readFileSync(new URL("../artifacts/summit-ready/eas.json", import.meta.url), "utf8"));
const production = config.build.production;
for (const name of ["preview", "production"]) {
  const profile = config.build[name];
  assert.equal(profile.environment, "production", `${name} must deliberately select production EAS configuration`);
  assert.equal(profile.env.EXPO_PUBLIC_DOMAIN, "summitready.uk", `${name} must use the production API`);
  assert.equal(profile.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    `${name} must use the same Clerk frontend as production`);
  assert.ok(profile.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_live_"),
    `${name} must not send development Clerk sessions to production`);
  assert.ok(!profile.env.EXPO_PUBLIC_MAP_BASE ||
    profile.env.EXPO_PUBLIC_MAP_BASE.replace(/\/+$/, "") === "https://summitready.uk/api",
    `${name} must not split map/activity operations onto another backend`);
}
assert.equal(config.build.preview.distribution, "internal");
assert.equal(config.build.preview.android.buildType, "apk");
console.log("PASS: preview and production intentionally share the live API and live Clerk frontend.");
console.log("Backend secret alignment and authenticated production round-trips remain separate release gates.");
