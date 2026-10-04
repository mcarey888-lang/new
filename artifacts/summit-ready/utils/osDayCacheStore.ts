import { CACHE_WINDOW_MS, MAX_CACHE_ZOOM, MIN_CACHE_ZOOM, isFresh, planFor, sweep, tileKey, tilesForRoute, type CachedTile } from "./dayCache";
import { resolveTile, type Connectivity } from "./tileSource";
import type { RoutePoint } from "./offRoute";
import { withOsTileRetry, waitForOsRetry, type OsRetryWait } from "./osTileRetry";

/** Injectable IO: licence decisions remain in the three unchanged pure modules. */
export interface TileFiles {
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  list(path: string): Promise<string[]>;
  size(path: string): Promise<number | null>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  download(url: string, to: string, signal?: AbortSignal): Promise<number>;
}
export interface DisplayLease {
  path: string;
  createdAt: number;
  expiresAt: number;
  cache: Map<string, CachedTile>;
  copiedBytes: number;
}
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_DOWNLOAD_TILES = 4000;
export function osRouteSupported(route: readonly RoutePoint[]): boolean {
  return route.length > 0 && route.length <= 20000 && route.every(p =>
    Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
    p.latitude >= 49 && p.latitude <= 61.5 && p.longitude >= -9.5 && p.longitude <= 2.5);
}
const validRecord = (t: CachedTile): boolean =>
  Number.isInteger(t?.z) && t.z >= MIN_CACHE_ZOOM && t.z <= MAX_CACHE_ZOOM &&
  Number.isInteger(t.x) && t.x >= 0 && t.x < 2 ** t.z &&
  Number.isInteger(t.y) && t.y >= 0 && t.y < 2 ** t.z &&
  Number.isFinite(t.fetchedAt) && Number.isInteger(t.bytes) && t.bytes >= 0 && t.bytes <= 2 * 1024 * 1024;

export function netConnectivity(state: {
  isConnected: boolean | null; isInternetReachable: boolean | null;
}): Connectivity {
  if (state.isConnected && state.isInternetReachable) return "online";
  if (state.isConnected && !state.isInternetReachable) return "metered";
  return "offline";
}

/** Never reconstruct age from mtime: UrlTile updates mtime even on cache reads. */
export class OsDayCacheStore {
  private held = new Map<string, CachedTile>();
  private queue: Promise<unknown> = Promise.resolve();
  private initialized = false;
  private sequence = 0;
  constructor(
    readonly root: string,
    private files: TileFiles,
    private tileBase: string,
    private now: () => number = Date.now,
    private retryWait: OsRetryWait = waitForOsRetry,
  ) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
  private async manifest(): Promise<void> {
    const pending = `${this.root}manifest.pending`;
    await this.files.write(pending, JSON.stringify([...this.held.values()]));
    await this.files.remove(`${this.root}manifest.json`);
    await this.files.move(pending, `${this.root}manifest.json`);
  }
  private async init(): Promise<void> {
    if (this.initialized) return;
    await this.files.mkdir(this.root);
    // Renderer bytes are disposable, never evidence that an offline download exists.
    await this.files.remove(`${this.root}display/`);
    await this.files.remove(`${this.root}pending/`);
    await this.files.mkdir(`${this.root}tiles/`);
    let records: unknown = [];
    // SDK moves do not promise atomic replacement on both platforms. A complete
    // pending manifest recovers the remove/move crash window without inventing age.
    for (const name of ["manifest.pending", "manifest.json"]) {
      if (await this.files.size(`${this.root}${name}`) === null) continue;
      try {
        const parsed: unknown = JSON.parse(await this.files.read(`${this.root}${name}`));
        if (Array.isArray(parsed) && parsed.every(validRecord)) { records = parsed; break; }
      } catch { /* A torn pending write can still fall back to the complete manifest. */ }
    }
    this.held.clear();
    if (Array.isArray(records)) {
      for (const record of records) {
        if (validRecord(record)) this.held.set(tileKey(record.z, record.x, record.y), { ...record });
      }
    }
    // Crash between tile move and manifest commit leaves an untrusted orphan.
    for (const z of await this.files.list(`${this.root}tiles/`)) {
      for (const x of await this.files.list(`${this.root}tiles/${z}/`)) {
        for (const y of await this.files.list(`${this.root}tiles/${z}/${x}/`)) {
          const key = `${z}/${x}/${y}`;
          if (!this.held.has(key)) await this.files.remove(`${this.root}tiles/${key}`);
        }
      }
    }
    this.initialized = true;
  }
  private async checked(): Promise<Map<string, CachedTile>> {
    await this.init();
    // Late native network callbacks can recreate a retired render directory.
    // Its conservative generation timestamp is still bounded independently.
    for (const name of await this.files.list(`${this.root}display/`)) {
      const createdAt = Number(name.split("-")[0]);
      if (!Number.isFinite(createdAt) || createdAt > this.now() || this.now() - createdAt >= CACHE_WINDOW_MS) {
        await this.files.remove(`${this.root}display/${name}/`);
      }
    }
    // An interrupted native writer must not leave unindexed staged OS bytes forever.
    for (const name of await this.files.list(`${this.root}pending/`)) {
      const fetchedAt = Number(name.split("-")[0]);
      if (!Number.isFinite(fetchedAt) || !isFresh({ fetchedAt }, this.now())) {
        await this.files.remove(`${this.root}pending/${name}`);
      }
    }
    const expired = new Set(sweep(this.held, this.now()).expired);
    for (const [key, record] of this.held) {
      if (!expired.has(key) && await this.files.size(`${this.root}tiles/${key}`) !== record.bytes) {
        expired.add(key);
        this.held.set(key, { ...record, bytes: 0 });
      }
    }
    // Do not report a successful sweep when a filesystem deletion failed.
    for (const key of expired) {
      await this.files.remove(`${this.root}tiles/${key}`);
      // Keep metadata, never bytes, so readinessMessage can still explain expiry.
    }
    if (this.held.size > MAX_DOWNLOAD_TILES * 2) {
      for (const [key, t] of [...this.held].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)) {
        if (this.held.size <= MAX_DOWNLOAD_TILES * 2) break;
        if (!isFresh(t, this.now()) || !t.bytes) this.held.delete(key);
      }
    }
    await this.manifest();
    return new Map([...this.held].map(([key, value]) => [key, { ...value }]));
  }
  snapshot(): Promise<Map<string, CachedTile>> {
    return this.serial(() => this.checked());
  }
  sweep(): Promise<Map<string, CachedTile>> { return this.snapshot(); }

  /** A separate directory prevents native cache writes/mtime changes from renewing age. */
  display(): Promise<DisplayLease> {
    return this.serial(async () => {
      const cache = await this.checked();
      const createdAt = this.now();
      const path = `${this.root}display/${createdAt}-${++this.sequence}/`;
      await this.files.mkdir(path);
      let expiresAt = createdAt + CACHE_WINDOW_MS;
      let copiedBytes = 0;
      try {
        for (const [key, record] of cache) {
          if (!record.bytes || !isFresh(record, createdAt + 1000)) continue;
          expiresAt = Math.min(expiresAt, record.fetchedAt + CACHE_WINDOW_MS);
          await this.files.mkdir(`${path}${record.z}/${record.x}/`);
          await this.files.copy(`${this.root}tiles/${key}`, `${path}${key}`);
          copiedBytes += record.bytes;
        }
        if (this.now() < createdAt || this.now() >= expiresAt) throw new Error("OS map display expired while preparing.");
        return { path, createdAt, expiresAt, cache, copiedBytes };
      } catch (error) {
        await this.files.remove(path);
        throw error;
      }
    });
  }
  release(lease: DisplayLease): Promise<void> {
    return this.serial(() => this.files.remove(lease.path));
  }
  async downloadRoute(
    route: readonly RoutePoint[], connectivity: Connectivity,
    progress?: (fraction: number) => void, signal?: AbortSignal,
  ): Promise<Map<string, CachedTile>> {
    if (connectivity === "offline") throw new Error("Connect to download Ordnance Survey maps.");
    if (!osRouteSupported(route)) {
      throw new Error("OS day maps require a valid route in Great Britain.");
    }
    const cache = await this.snapshot();
    const addresses = tilesForRoute(route);
    if (addresses.length > MAX_DOWNLOAD_TILES) throw new Error("This route is too large for one OS day-map download.");
    const plan = planFor(route, new Map([...cache].filter(([, t]) => t.bytes > 0)), this.now());
    let done = 0;
    for (const address of plan.missing) {
      if (signal?.aborted) throw new Error("Map download cancelled.");
      const key = tileKey(address.z, address.x, address.y);
      const current = await this.serial(async () => {
        const record = this.held.get(key);
        return record && await this.files.size(`${this.root}tiles/${key}`) === record.bytes
          ? new Map([[key, record]]) : new Map<string, CachedTile>();
      });
      const source = resolveTile(address, current, this.now(), connectivity, { fallbackAvailable: false });
      if (source.kind === "cache") { progress?.(++done / plan.missing.length); continue; }
      if (source.kind !== "network") throw new Error("This map tile cannot be downloaded.");
      const fetchedAt = this.now(); // Conservative: includes network latency in tile age.
      const pending = `${this.root}pending/${fetchedAt}-${++this.sequence}`;
      await this.files.mkdir(`${this.root}pending/`);
      try {
        const bytes = await withOsTileRetry(
          () => this.files.download(`${this.tileBase}/${key}.png`, pending, signal),
          signal, this.retryWait,
        );
        if (signal?.aborted) throw new Error("Map download cancelled.");
        if (bytes <= 0 || bytes > 2 * 1024 * 1024 || !isFresh({ fetchedAt }, this.now())) {
          throw new Error("Downloaded map tile is invalid or expired.");
        }
        await this.serial(async () => {
          const fresh = [...this.held].filter(([, t]) => isFresh(t, this.now()) && t.bytes > 0);
          let used = fresh.reduce((sum, [, t]) => sum + t.bytes, 0);
          let count = fresh.length;
          if (used + bytes > MAX_BYTES || count >= MAX_DOWNLOAD_TILES) {
            for (const [oldKey, old] of fresh.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)) {
              if (used + bytes <= MAX_BYTES && count < MAX_DOWNLOAD_TILES) break;
              await this.files.remove(`${this.root}tiles/${oldKey}`);
              this.held.delete(oldKey);
              used -= old.bytes;
              count--;
            }
          }
          await this.files.mkdir(`${this.root}tiles/${address.z}/${address.x}/`);
          await this.files.remove(`${this.root}tiles/${key}`);
          await this.files.move(pending, `${this.root}tiles/${key}`);
          this.held.set(key, { ...address, bytes, fetchedAt });
          // A crash can lose at most this batch; unindexed bytes are deleted at boot.
          if ((done + 1) % 16 === 0) await this.manifest();
        });
      } finally { await this.files.remove(pending); }
      progress?.(++done / plan.missing.length);
    }
    return this.snapshot(); // Recheck actual bytes and expiry, never fake completion.
  }
}