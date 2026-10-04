import { useEffect, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as FS from "expo-file-system/legacy";
import { OsDayCacheStore, netConnectivity, type DisplayLease, type TileFiles } from "@/utils/osDayCacheStore";
import type { Connectivity } from "@/utils/tileSource";
import type { RoutePoint } from "@/utils/offRoute";
import { OsTileRateLimitError } from "@/utils/osTileRetry";

const API = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
export const OS_TILE_TEMPLATE = `${API}/map-tiles/os-outdoor/{z}/{x}/{y}.png`;
const files: TileFiles = {
  mkdir: path => FS.makeDirectoryAsync(path, { intermediates: true }),
  read: path => FS.readAsStringAsync(path),
  write: (path, text) => FS.writeAsStringAsync(path, text),
  list: async path => {
    const info = await FS.getInfoAsync(path);
    return info.exists && info.isDirectory ? FS.readDirectoryAsync(path) : [];
  },
  size: async path => {
    const info = await FS.getInfoAsync(path);
    return info.exists && !info.isDirectory ? info.size : null;
  },
  remove: path => FS.deleteAsync(path, { idempotent: true }),
  move: (from, to) => FS.moveAsync({ from, to }),
  copy: (from, to) => FS.copyAsync({ from, to }),
  download: async (url, to, signal) => {
    if (signal?.aborted) throw new Error("Map download cancelled.");
    // OS proxy returns no-store; do not inherit browser/server cache age.
    const task = FS.createDownloadResumable(url, to, { headers: { "Cache-Control": "no-cache" } });
    let rejectStopped: (error: Error) => void = () => {};
    const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
    let stopping: Promise<unknown> | null = null;
    const stop = (message: string) => {
      stopping ??= task.pauseAsync().catch(() => {});
      rejectStopped(new Error(message));
    };
    const abort = () => stop("Map download cancelled.");
    const timeout = setTimeout(() => stop("OS tile download timed out."), 15000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await Promise.race([task.downloadAsync(), stopped]);
      if (response?.status === 429) {
        await FS.deleteAsync(to, { idempotent: true });
        throw new OsTileRateLimitError(response.headers);
      }
      if (!response || response.status !== 200) throw new Error(`OS tile download failed (${response?.status ?? "timeout"}).`);
      const info = await FS.getInfoAsync(to);
      if (!info.exists || info.isDirectory || info.size === 0) throw new Error("Empty OS map tile.");
      const magic = await FS.readAsStringAsync(to, { encoding: FS.EncodingType.Base64, position: 0, length: 8 });
      if (magic !== "iVBORw0KGgo=") throw new Error("The OS tile server did not return a PNG image.");
      return info.size;
    } finally {
      clearTimeout(timeout); signal?.removeEventListener("abort", abort);
      // Drain native cancellation before the caller removes the partial file.
      if (stopping) await stopping;
    }
  },
};
const store = FS.documentDirectory
  ? new OsDayCacheStore(`${FS.documentDirectory}os-day-maps/`, files, `${API}/map-tiles/os-outdoor`)
  : null;
const listeners = new Set<() => void>();
let boot: Promise<unknown> | null = null;
const notify = () => listeners.forEach(fn => fn());
export function sweepOsDayMaps(): Promise<unknown> {
  if (!store) return Promise.reject(new Error("Native document storage is unavailable."));
  return store.sweep();
}
export function startOsDayMaps(): Promise<unknown> {
  if (!boot) boot = sweepOsDayMaps().catch(error => { boot = null; throw error; });
  return boot;
}
export async function downloadOsRoute(
  route: readonly RoutePoint[], connectivity: Connectivity,
  progress?: (fraction: number) => void, signal?: AbortSignal,
) {
  if (!store) throw new Error("Native document storage is unavailable.");
  try { return await store.downloadRoute(route, connectivity, progress, signal); }
  finally { notify(); }
}
export function useOsDayMap() {
  const [lease, setLease] = useState<DisplayLease | null>(null);
  const [connectivity, setConnectivity] = useState<Connectivity>("offline");
  const [error, setError] = useState<string | null>(null);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh(n => n + 1);
    listeners.add(listener);
    const stop = NetInfo.addEventListener(state => setConnectivity(netConnectivity(state)));
    return () => { listeners.delete(listener); stop(); };
  }, []);
  useEffect(() => {
    let closed = false;
    let generation = 0;
    let current: DisplayLease | null = null;
    let expiry: ReturnType<typeof setTimeout> | null = null;
    const hide = () => {
      generation++;
      setLease(null); // Remove native overlay before ANY asynchronous filesystem work.
      if (expiry) clearTimeout(expiry);
      if (current && store) void store.release(current).catch(e => setError(String(e)));
      current = null;
    };
    const prepare = async () => {
      hide();
      const ticket = generation;
      try {
        await startOsDayMaps();
        const preparingAt = performance.now();
        const next = await store!.display();
        if (__DEV__) console.info("OS day-map display prepared", {
          elapsedMs: Math.round(performance.now() - preparingAt),
          copiedBytes: next.copiedBytes,
        });
        if (closed || ticket !== generation || AppState.currentState !== "active") {
          await store!.release(next); return;
        }
        current = next;
        setError(null);
        setLease(next);
        // Expire slightly early so a React/native frame cannot run past the deadline.
        expiry = setTimeout(() => { void prepare(); }, Math.max(0, next.expiresAt - Date.now() - 1000));
      } catch (e) { if (!closed) setError(e instanceof Error ? e.message : String(e)); }
    };
    if (AppState.currentState === "active") void prepare();
    const app = AppState.addEventListener("change", state => {
      if (state === "active") void prepare();
      else hide();
    });
    // Detect wall-clock jumps while awake; future timestamps are also expired by dayCache.
    const clock = setInterval(() => {
      if (current && (Date.now() >= current.expiresAt - 1000 ||
          Date.now() < current.createdAt)) void prepare();
    }, 1000);
    return () => { closed = true; hide(); clearInterval(clock); app.remove(); };
  }, [revision, connectivity]);
  return { lease, connectivity, error };
}