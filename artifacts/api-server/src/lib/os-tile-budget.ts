/** Enough for a 4,000-tile route plus normal browsing, still a bounded paid API. */
export const OS_IP_TILES_PER_MINUTE = 6000;
export const OS_GLOBAL_TILES_PER_MINUTE = 24000;
const WINDOW_MS = 60000;
interface Window { start: number; count: number }

export class OsTileBudget {
  private ips = new Map<string, Window>();
  private global: Window | null = null;

  /** Zero grants a request. Otherwise return seconds until all limits reset. */
  take(ip: string, now = Date.now()): number {
    if (!this.global || now < this.global.start || now - this.global.start >= WINDOW_MS) {
      this.global = { start: now, count: 0 };
    }
    let local = this.ips.get(ip);
    if (!local || now < local.start || now - local.start >= WINDOW_MS) {
      if (this.ips.size >= 2048) this.ips.delete(this.ips.keys().next().value!);
      local = { start: now, count: 0 };
      this.ips.set(ip, local);
    }
    const waits = [
      local.count >= OS_IP_TILES_PER_MINUTE ? local.start + WINDOW_MS - now : 0,
      this.global.count >= OS_GLOBAL_TILES_PER_MINUTE ? this.global.start + WINDOW_MS - now : 0,
    ];
    const wait = Math.ceil(Math.max(...waits) / 1000);
    if (wait) return wait; // Rejected requests must not consume other users' allowance.
    local.count++;
    this.global.count++;
    return 0;
  }
}