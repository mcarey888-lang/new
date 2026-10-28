import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { clearOverpassRequestState, OVERPASS_ENDPOINTS, requestOverpass } from "../services/overpassRequest";
import { logger } from "../lib/logger";

const query = '[out:json][timeout:7];node["natural"="peak"]["name"](around:25000,53.7,-2.33);out body;';
const result = { elements: [{ type: "node", id: 123, lat: 53.71, lon: -2.33, tags: { name: "Real Fell" } }] };
const good = (body = result) => ({ ok: true, status: 200, json: async () => body });
const bad = (status = 502, retryAfter?: string) => ({
  ok: false, status, headers: new Headers(retryAfter ? { "retry-after": retryAfter } : {}),
});
beforeEach(() => {
  clearOverpassRequestState();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bounded, respectful Overpass requests", () => {
  it("posts the documented form with identifying headers and caches a complete response", async () => {
    const mock = vi.fn().mockResolvedValue(good());
    vi.stubGlobal("fetch", mock);
    expect(await requestOverpass(query)).toEqual(result);
    expect(await requestOverpass(query)).toEqual(result);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe(OVERPASS_ENDPOINTS[0]);
    const init = mock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(new URLSearchParams(init.body).get("data")).toBe(query);
    expect(init.headers["User-Agent"]).toContain("SummitReady/");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });
  it("shares one network request between simultaneous identical searches", async () => {
    let finish!: (value: unknown) => void;
    const mock = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", mock);
    const one = requestOverpass(query);
    const two = requestOverpass(query);
    expect(one).toBe(two);
    finish(good());
    expect(await one).toEqual(result);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("pauses failed providers and prefers a working independent mirror", async () => {
    const mock = vi.fn().mockResolvedValueOnce(bad()).mockResolvedValue(good());
    vi.stubGlobal("fetch", mock);
    expect(await requestOverpass(query)).toEqual(result);
    expect(await requestOverpass(query + " ")).toEqual(result);
    expect(mock.mock.calls.map(c => c[0])).toEqual([
      OVERPASS_ENDPOINTS[0], OVERPASS_ENDPOINTS[1], OVERPASS_ENDPOINTS[1],
    ]);
  });
  it.each(["120", new Date("2030-01-01T00:02:00Z").toUTCString()])("honours Retry-After %s rather than repeatedly hitting overloaded providers", async retryAfter => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const mock = vi.fn().mockResolvedValue(bad(429, retryAfter));
    vi.stubGlobal("fetch", mock);
    await expect(requestOverpass(query)).rejects.toThrow("HTTP 429");
    await vi.advanceTimersByTimeAsync(31_000);
    await expect(requestOverpass(query)).rejects.toThrow("temporarily paused");
    expect(mock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(90_000);
    mock.mockResolvedValue(good());
    expect(await requestOverpass(query)).toEqual(result);
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it("rejects partial HTTP 200 data and never caches it as an empty area", async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce(good({ ...result, remark: "runtime error: timed out" } as typeof result))
      .mockResolvedValueOnce(good({ elements: [] }));
    vi.stubGlobal("fetch", mock);
    expect(await requestOverpass(query)).toEqual({ elements: [] });
    expect(await requestOverpass(query)).toEqual({ elements: [] });
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it("bounds a stalled response body and does not race the public mirrors", async () => {
    vi.useFakeTimers();
    const mock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(() => {}) })
      .mockResolvedValueOnce(good());
    vi.stubGlobal("fetch", mock);
    const work = requestOverpass(query);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await work).toEqual(result);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("does not resend an invalid query to multiple providers", async () => {
    const mock = vi.fn().mockResolvedValue(bad(400));
    vi.stubGlobal("fetch", mock);
    await expect(requestOverpass(query)).rejects.toThrow("HTTP 400");
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("sanitises diagnostics rather than logging queries or credential-bearing error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`failure at https://secret:key@example.org/?data=${query}`)));
    await expect(requestOverpass(query)).rejects.toThrow("network or response error");
    const logs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logs).not.toContain("secret:key");
    expect(logs).not.toContain("53.7");
  });
});
