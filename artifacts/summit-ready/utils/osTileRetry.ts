/** Network plumbing only; never change the supplied tile/expiry decision modules. */
export function retryAfterMs(value: string | null | undefined, now = Date.now()): number {
  const text = value?.trim();
  if (!text) return 60000;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const ms = Math.ceil(Number(text) * 1000);
    return Number.isFinite(ms) ? ms : 60000;
  }
  const date = /^[A-Za-z]{3}, /.test(text) ? Date.parse(text) : NaN;
  return Number.isFinite(date) ? Math.max(0, date - now) : 60000;
}

export class OsTileRateLimitError extends Error {
  readonly waitMs: number;
  constructor(headers: Readonly<Record<string, string>>, now = Date.now()) {
    super("OS map server is busy. Saved tiles are kept; try downloading again later.");
    this.name = "OsTileRateLimitError";
    const value = Object.entries(headers).find(([name]) => name.toLowerCase() === "retry-after")?.[1];
    this.waitMs = retryAfterMs(value, now);
  }
}
const cancelled = () => new Error("Map download cancelled.");
export type OsRetryWait = (ms: number, signal?: AbortSignal) => Promise<void>;

export const waitForOsRetry: OsRetryWait = async (ms, signal) => {
  if (signal?.aborted) throw cancelled();
  // Long valid headers must not overflow native/JS timers and trigger an early retry.
  for (let remaining = ms; remaining > 0;) {
    const chunk = Math.min(remaining, 2147483647);
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(cancelled()); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, chunk);
      signal?.addEventListener("abort", abort, { once: true });
    });
    remaining -= chunk;
    if (signal?.aborted) throw cancelled();
  }
};

export async function withOsTileRetry(
  attempt: () => Promise<number>, signal?: AbortSignal,
  wait: OsRetryWait = waitForOsRetry,
): Promise<number> {
  // Five attempts maximum per tile; no endless retry loop or hidden bill.
  for (let retries = 0;; retries++) {
    if (signal?.aborted) throw cancelled();
    try { return await attempt(); }
    catch (error) {
      if (!(error instanceof OsTileRateLimitError) || retries >= 4) throw error;
      await wait(error.waitMs, signal);
    }
  }
}