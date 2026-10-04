import { afterEach, describe, expect, it, vi } from "vitest";
import { OsTileRateLimitError, retryAfterMs, waitForOsRetry, withOsTileRetry } from "./osTileRetry";

afterEach(() => vi.useRealTimers());
describe("OS tile throttling without changing map decisions", () => {
  it("reads seconds and HTTP dates without retrying early", () => {
    const now = Date.parse("Sun, 04 Oct 2026 12:00:00 GMT");
    expect(retryAfterMs("10", now)).toBe(10000);
    expect(retryAfterMs("Sun, 04 Oct 2026 12:00:30 GMT", now)).toBe(30000);
    expect(retryAfterMs("Sun, 04 Oct 2026 11:59:00 GMT", now)).toBe(0);
    expect(retryAfterMs("0", now)).toBe(0);
    expect(retryAfterMs(undefined, now)).toBe(60000);
    expect(retryAfterMs("invalid", now)).toBe(60000);
    expect(retryAfterMs("-1", now)).toBe(60000);
    expect(new OsTileRateLimitError({ "ReTrY-AfTeR": "10" }).waitMs).toBe(10000);
  });
  it("waits the complete Retry-After interval and then resumes the same attempt", async () => {
    vi.useFakeTimers();
    const attempt = vi.fn().mockRejectedValueOnce(new OsTileRateLimitError({ "Retry-After": "10" })).mockResolvedValue(123);
    const result = withOsTileRetry(attempt);
    await vi.advanceTimersByTimeAsync(9999);
    expect(attempt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(123);
    expect(attempt).toHaveBeenCalledTimes(2);
  });
  it("bounds repeated throttling to five attempts", async () => {
    const attempt = vi.fn().mockRejectedValue(new OsTileRateLimitError({ "retry-after": "1" }));
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(withOsTileRetry(attempt, undefined, wait)).rejects.toBeInstanceOf(OsTileRateLimitError);
    expect(attempt).toHaveBeenCalledTimes(5);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([1000, 1000, 1000, 1000]);
  });
  it("does not retry unrelated transport or storage errors", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("storage permission denied"));
    const wait = vi.fn();
    await expect(withOsTileRetry(attempt, undefined, wait)).rejects.toThrow("storage permission denied");
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it("cancels backoff immediately, removing the timer and preventing another request", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const attempt = vi.fn().mockRejectedValue(new OsTileRateLimitError({ "retry-after": "60" }));
    const result = withOsTileRetry(attempt, controller.signal);
    const rejected = expect(result).rejects.toThrow("cancelled");
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start an already-cancelled request", async () => {
    const controller = new AbortController(); controller.abort();
    const attempt = vi.fn();
    await expect(withOsTileRetry(attempt, controller.signal)).rejects.toThrow("cancelled");
    expect(attempt).not.toHaveBeenCalled();
  });
  it("splits very long waits instead of overflowing a timer and retrying immediately", async () => {
    vi.useFakeTimers();
    let finished = false;
    const result = waitForOsRetry(2147483647 + 1000).then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(2147483647);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(finished).toBe(true);
  });
});