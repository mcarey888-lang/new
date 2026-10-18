// Exercise the installed production artifact router, not just the Node handler.
// Isolated temporary fixtures: no application credentials, APIs or databases.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const root = await mkdtemp(join(tmpdir(), "summit-production-router-"));
const routerPort = await freePort();
const expoPort = await freePort();
let router;
let output = "";
try {
  await writeFile(join(root, ".replit"), '[deployment]\nrouter = "application"\n');
  const mobile = join(root, "artifacts/mobile");
  const landing = join(root, "artifacts/landing");
  await mkdir(join(mobile, ".replit-artifact"), { recursive: true });
  await mkdir(join(landing, ".replit-artifact"), { recursive: true });
  await mkdir(join(landing, "public"));
  await writeFile(join(landing, "public/index.html"), "<html>marketing fixture</html>");
  await writeFile(join(landing, ".replit-artifact/artifact.toml"), `
kind = "web"
previewPath = "/"
title = "Marketing fixture"
version = "1.0.0"
id = "landing"
[[services]]
name = "web"
paths = ["/"]
localPort = 26110
[services.production]
serve = "static"
publicDir = "artifacts/landing/public"
`);
  let config = await readFile(resolve("artifacts/summit-ready/.replit-artifact/artifact.toml"), "utf8");
  config = config.replaceAll("20885", String(expoPort))
    .replace(/run = \[ "pnpm", "--filter", "@workspace\/summit-ready", "run", "serve" \]/,
      `run = ["${process.execPath}", "${join(mobile, "fixture.cjs")}"]`);
  await writeFile(join(mobile, ".replit-artifact/artifact.toml"), config);
  const handler = resolve("artifacts/summit-ready/server/serve.js");
  for (const platform of ["ios", "android"]) {
    await mkdir(join(mobile, platform));
    await writeFile(join(mobile, platform, "manifest.json"),
      JSON.stringify({ platform, extra: { summitReadyBuild: { verificationSourceHash: "router-fixture" } } }));
  }
  await writeFile(join(mobile, "build-info.json"), JSON.stringify({ verificationSourceHash: "router-fixture" }));
  await writeFile(join(mobile, "bundle.js"), "/* fixture launch asset */");
  await writeFile(join(mobile, "fixture.cjs"), `
require(${JSON.stringify(handler)}).createExpoStaticServer({
  staticRoot: __dirname, prefix: "/mobile"
}).listen(${expoPort}, "127.0.0.1");
`);
  router = spawn(process.env.ARTIFACT_ROUTER_BIN || "artifact-router", [], {
    cwd: root, env: { PATH: process.env.PATH, HOME: tmpdir(), PORT: String(routerPort) },
    detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  router.on("error", error => { output += error.message; });
  router.stdout.on("data", chunk => { output += chunk; });
  router.stderr.on("data", chunk => { output += chunk; });
  const base = `http://127.0.0.1:${routerPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Production router did not start:\n${output}`);
  for (const platform of ["ios", "android"]) {
    const response = await fetch(`${base}/mobile/manifest`, { headers: { "expo-platform": platform } });
    const text = await response.text();
    console.log(JSON.stringify({ path: "/mobile/manifest", platform, status: response.status,
      contentType: response.headers.get("content-type"), body: text.slice(0, 250) }));
    assert.equal(response.status, 200, output);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    const manifest = JSON.parse(text);
    assert.equal(manifest.platform, platform);
    assert.equal(manifest.extra.summitReadyBuild.verificationSourceHash, "router-fixture");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  for (const path of ["/mobile/build-info.json", "/mobile/bundle.js", "/mobile/ios/manifest.json"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, path);
  }
  assert.match(await (await fetch(base)).text(), /marketing fixture/);
  assert.equal((await fetch(`${base}/mobile-other/manifest`)).status, 404);
  console.log("PASS: production artifact router → Expo manifests/assets; marketing root preserved");
} finally {
  if (router?.pid) {
    try { process.kill(-router.pid, "SIGTERM"); } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  await rm(root, { recursive: true, force: true });
}
