import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const require = createRequire(import.meta.url);
const { createExpoStaticServer } = require("../server/serve.js");
const { captureBuildProvenance } = require("../server/build-provenance.cjs");
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "summit-hosted-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  for (const platform of ["ios", "android"]) {
    await mkdir(join(root, platform));
    await writeFile(join(root, platform, "manifest.json"),
      JSON.stringify({ createdAt: "2026-10-18T18:00:00.000Z", platform }));
  }
  await writeFile(join(root, "build-info.json"), JSON.stringify({ verificationSourceHash: "fixture" }));
  const server: Server = createExpoStaticServer({ staticRoot: root, prefix: "/mobile" });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve())));
  return { root, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe("published hosted-bundle contract", () => {
  it.each(["ios", "android"])("serves %s manifest JSON, never a homepage", async platform => {
    const { base } = await fixture();
    const response = await fetch(`${base}/mobile/manifest`, { headers: { "expo-platform": platform } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("expo-protocol-version")).toBe("1");
    expect(await response.json()).toMatchObject({ platform, createdAt: "2026-10-18T18:00:00.000Z" });
  });
  it("exposes noncached build evidence and does not strip similarly named prefixes", async () => {
    const { base } = await fixture();
    const info = await fetch(`${base}/mobile/build-info.json`);
    expect(info.headers.get("cache-control")).toBe("no-store");
    expect(await info.json()).toEqual({ verificationSourceHash: "fixture" });
    expect((await fetch(`${base}/mobile-other/build-info.json`)).status).toBe(404);
  });
  it("returns a real error for a missing manifest rather than HTML 200", async () => {
    const { base, root } = await fixture();
    await rm(join(root, "ios", "manifest.json"));
    const response = await fetch(`${base}/mobile/manifest`, { headers: { "expo-platform": "ios" } });
    expect(response.status).toBe(404);
    expect(await response.json()).toHaveProperty("error");
  });
  it("fingerprints actual source bytes even when Git is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "summit-source-"));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    await writeFile(join(root, "source.js"), "first");
    const first = captureBuildProvenance(root, "2026-10-18T18:00:00Z", ["source.js"]);
    expect(first.gitCommit).toBeNull();
    expect(first.verificationSourceHash).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(join(root, "source.js"), "second");
    expect(captureBuildProvenance(root, first.builtAt, ["source.js"]).verificationSourceHash)
      .not.toBe(first.verificationSourceHash);
  });
  it("declares explicit path routing and stamps both manifests in the build pipeline", async () => {
    const config = await readFile(new URL("../.replit-artifact/artifact.toml", import.meta.url), "utf8");
    expect(config).toContain('router = "path"');
    expect(config).toContain('paths = [ "/mobile/" ]');
    const build = await readFile(new URL("../scripts/build.js", import.meta.url), "utf8");
    expect(build).toContain("manifest.extra.summitReadyBuild = provenance");
    expect(build).toContain('"build-info.json"');
    expect(build).toContain("Refusing to reuse an unrelated server");
  });
  it("keeps the marketing SPA's rewrites away from mobile/API paths and preserves its pages", async () => {
    const config = await readFile(new URL("../../summit-landing/.replit-artifact/artifact.toml", import.meta.url), "utf8");
    const source = await readFile(new URL("../../summit-landing/src/main.tsx", import.meta.url), "utf8");
    const rewrites = [...config.matchAll(/^from = "([^"]+)"$/gm)].map(match => match[1]);
    const matches = (route: string, pattern: string) => pattern.endsWith("/*")
      ? route.startsWith(pattern.slice(0, -1)) : route === pattern;
    for (const route of [...source.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]).filter(route => route !== "*"))
      expect(rewrites.some(pattern => matches(route, pattern)), `Missing landing rewrite for ${route}`).toBe(true);
    for (const route of ["/mobile/", "/mobile/manifest", "/mobile/ios/manifest.json", "/api/route-map"])
      expect(rewrites.some(pattern => matches(route, pattern)), `Landing must not swallow ${route}`).toBe(false);
  });
});
