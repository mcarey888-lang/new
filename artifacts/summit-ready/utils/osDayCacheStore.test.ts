import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OsDayCacheStore, netConnectivity, type TileFiles } from "./osDayCacheStore";
import { CACHE_WINDOW_MS, tileKey, tilesForRoute } from "./dayCache";
import { mapReadiness, readinessMessage } from "./tileSource";

const route = [{ latitude: 56.796, longitude: -5.003 }];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c6x8AAAAASUVORK5CYII=", "base64");
let root: string, clock: number, downloads: number, files: TileFiles, store: OsDayCacheStore;
beforeEach(async () => {
  root = `${await fs.mkdtemp(join(tmpdir(), "summit-os-cache-test-"))}/`;
  clock = 1_800_000_000_000; downloads = 0;
  files = {
    mkdir: async p => { await fs.mkdir(p, { recursive: true }); },
    read: p => fs.readFile(p, "utf8"),
    write: (p, text) => fs.writeFile(p, text),
    list: async p => { try { return await fs.readdir(p); } catch { return []; } },
    size: async p => { try { const stat = await fs.stat(p); return stat.isFile() ? stat.size : null; } catch { return null; } },
    remove: p => fs.rm(p, { recursive: true, force: true }),
    move: (a, b) => fs.rename(a, b), copy: (a, b) => fs.copyFile(a, b),
    download: async (_url, p) => { downloads++; await fs.writeFile(p, png); return png.length; },
  };
  store = new OsDayCacheStore(root, files, "https://fixture.invalid/tiles", () => clock);
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
describe("native day-cache plumbing using actual temporary disk files", () => {
  it("downloads route tiles and reuses fresh verified bytes", async () => {
    const cache = await store.downloadRoute(route, "online");
    expect(cache.size).toBe(tilesForRoute(route).length);
    const first = downloads;
    await store.downloadRoute(route, "metered");
    expect(downloads).toBe(first);
    expect(mapReadiness(tilesForRoute(route), cache, clock, "offline", { fallbackAvailable: false }).kind).toBe("full");
  });
  it("clock-forward expiry physically deletes bytes and retains only the reason", async () => {
    const saved = await store.downloadRoute(route, "online");
    clock += CACHE_WINDOW_MS;
    const expired = await store.sweep();
    for (const key of saved.keys()) expect(await files.size(`${root}tiles/${key}`)).toBeNull();
    expect(readinessMessage(mapReadiness(tilesForRoute(route), expired, clock, "offline", { fallbackAvailable: false }))).toContain("expired");
  });
  it("does not renew immutable ages when renderer reads or changes its own files", async () => {
    const saved = await store.downloadRoute(route, "online");
    const lease = await store.display();
    const key = saved.keys().next().value!;
    await fs.utimes(`${lease.path}${key}`, new Date(clock + CACHE_WINDOW_MS), new Date(clock + CACHE_WINDOW_MS));
    clock += CACHE_WINDOW_MS;
    await store.sweep();
    expect(await files.size(`${root}tiles/${key}`)).toBeNull();
    expect(lease.expiresAt).toBe(clock);
    await store.release(lease);
    expect(await files.size(`${lease.path}${key}`)).toBeNull();
  });
  it("restart deletes renderer leftovers and expired downloaded tiles", async () => {
    const saved = await store.downloadRoute(route, "online");
    const lease = await store.display();
    clock += CACHE_WINDOW_MS + 1;
    const restarted = new OsDayCacheStore(root, files, "https://fixture.invalid", () => clock);
    await restarted.sweep();
    for (const key of saved.keys()) expect(await files.size(`${root}tiles/${key}`)).toBeNull();
    expect(await files.list(lease.path)).toEqual([]);
  });
  it("sweeps an expired render directory recreated by a late native callback", async () => {
    await store.snapshot();
    const retired = `${root}display/${clock}-late/`;
    await files.mkdir(retired);
    await fs.writeFile(`${retired}late-tile`, png);
    clock += CACHE_WINDOW_MS;
    await store.sweep();
    expect(await files.list(retired)).toEqual([]);
  });
  it("future timestamps fail closed after a backwards clock change", async () => {
    const saved = await store.downloadRoute(route, "online");
    clock--;
    await store.sweep();
    for (const key of saved.keys()) expect(await files.size(`${root}tiles/${key}`)).toBeNull();
  });
  it("corrupt and missing bytes are redownloaded rather than counted as ready", async () => {
    await store.downloadRoute(route, "online");
    const t = tilesForRoute(route)[0]!;
    const key = tileKey(t.z, t.x, t.y);
    await fs.writeFile(`${root}tiles/${key}`, "");
    const bad = await store.snapshot();
    expect(bad.get(key)?.bytes).toBe(0);
    const first = downloads;
    await store.downloadRoute(route, "online");
    expect(downloads).toBe(first + 1);
    expect(await files.size(`${root}tiles/${key}`)).toBe(png.length);
  });
  it("deletion failure rejects the display instead of serving an expired tile", async () => {
    await store.downloadRoute(route, "online");
    clock += CACHE_WINDOW_MS;
    files.remove = async p => { if (p.includes("/tiles/")) throw new Error("disk deletion refused"); await fs.rm(p, { recursive: true, force: true }); };
    await expect(store.display()).rejects.toThrow("deletion refused");
  });
  it("a failed fetch leaves no completed record and cleans the partial file", async () => {
    files.download = async (_url, path) => { await fs.writeFile(path, "partial"); throw new Error("no signal"); };
    await expect(store.downloadRoute(route, "metered")).rejects.toThrow("no signal");
    expect((await store.snapshot()).size).toBe(0);
    expect(await files.list(`${root}pending/`)).toEqual([]);
  });
  it("aborted and offline requests never start a download", async () => {
    await expect(store.downloadRoute(route, "offline")).rejects.toThrow("Connect");
    const abort = new AbortController(); abort.abort();
    await expect(store.downloadRoute(route, "online", undefined, abort.signal)).rejects.toThrow("cancelled");
    expect(downloads).toBe(0);
  });
  it("deletes a crash orphan instead of inventing its fetched-at time", async () => {
    await store.snapshot();
    await files.mkdir(`${root}tiles/11/1/`);
    await fs.writeFile(`${root}tiles/11/1/1`, png);
    const restarted = new OsDayCacheStore(root, files, "https://fixture.invalid", () => clock);
    await restarted.snapshot();
    expect(await files.size(`${root}tiles/11/1/1`)).toBeNull();
  });
  it("maps NetInfo half-signal and unknown reachability as specified", () => {
    expect(netConnectivity({ isConnected: true, isInternetReachable: true })).toBe("online");
    expect(netConnectivity({ isConnected: true, isInternetReachable: false })).toBe("metered");
    expect(netConnectivity({ isConnected: true, isInternetReachable: null })).toBe("metered");
    expect(netConnectivity({ isConnected: null, isInternetReachable: null })).toBe("offline");
  });
});