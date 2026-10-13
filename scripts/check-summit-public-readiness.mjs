// Read-only GET checks; no test accounts, secret access or database writes.
// Usage: node scripts/check-summit-public-readiness.mjs https://summitready.uk
const origin = new URL(process.argv[2]).origin;
const checks = [];
async function request(path, headers = {}) {
  return fetch(`${origin}${path}`, {
    headers, redirect: "manual", signal: AbortSignal.timeout(20000),
  });
}
async function check(name, fn) {
  try { checks.push({ name, ...(await fn()) }); }
  catch { checks.push({ name, passed: false, reason: "request_failed" }); }
}
await check("health", async () => {
  const r = await request("/api/healthz");
  return { passed: r.status === 200, status: r.status };
});
await check("map-code-revalidation", async () => {
  const r = await request("/api/route-map");
  await r.arrayBuffer();
  const etag = r.headers.get("etag"), cache = r.headers.get("cache-control");
  // Node fetch otherwise adds request Cache-Control:no-cache when an explicit
  // validator is present; Express correctly refuses a 304 for that request.
  // max-age=0 requests ordinary revalidation, like curl/browser conditional GET.
  const second = etag ? await request("/api/route-map", {
    "If-None-Match": etag, "Cache-Control": "max-age=0",
  }) : null;
  return { passed: r.status === 200 && /(?:^|[, ])no-cache(?:$|[, ])/i.test(cache ?? "") &&
      second?.status === 304, status: r.status, cacheControl: cache,
    hasEtag: !!etag, conditionalStatus: second?.status ?? null };
});
for (const path of ["/api/summits/search?q=Tryfan",
  "/api/summits?bbox=-4.05,53.05,-3.9,53.15&zoom=12"]) {
  await check(path, async () => {
    const r = await request(path), json = await r.json();
    const results = json.results ?? json.summits;
    return { passed: r.status === 200 && Array.isArray(results) && results.length > 0 &&
      results.every(pin => typeof pin.id === "string" && pin.id.length > 0),
    status: r.status, count: Array.isArray(results) ? results.length : null,
    error: json.error === "summit_catalogue_unavailable" ? json.error : null };
  });
}
for (const path of ["/api/recorded-hikes", "/api/planned-routes",
  "/api/activity-community/preferences", "/api/activities", "/api/canonical-history"]) {
  await check(`anonymous:${path}`, async () => {
    const r = await request(path);
    return { passed: r.status === 401 && /application\/json/i.test(r.headers.get("content-type") ?? "") &&
      !r.headers.has("location"), status: r.status,
    contentType: r.headers.get("content-type"), redirects: r.headers.has("location") };
  });
}
console.log(JSON.stringify({ origin, checkedAt: new Date().toISOString(), readOnly: true, checks }, null, 2));
if (checks.some(c => !c.passed)) process.exitCode = 1;
