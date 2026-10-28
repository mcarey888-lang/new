import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpeditionDetailError, requestExpeditionDetail, retryAfterSeconds } from "./expeditionDetailRequest";

afterEach(() => vi.unstubAllGlobals());
describe("expedition detail requests", () => {
  it("loads the selected challenge and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ challenge: { challengeId: "id /1" } })));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestExpeditionDetail("/api", "id /1", signal)).toEqual({ challengeId: "id /1" });
    expect(fetcher).toHaveBeenCalledWith("/api/sx/challenges/id%20%2F1", { signal });
  });
  it("returns a useful throttling message and does not automatically retry or generate anything", async () => {
    const fetcher = vi.fn(async () => new Response("busy", { status: 429, headers: { "Retry-After": "12" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestExpeditionDetail("/api", "id", new AbortController().signal))
      .rejects.toMatchObject({ status: 429, retryAfterSeconds: 12, message: expect.stringContaining("Nothing has been changed") });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a stale or malformed response rather than showing another expedition", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ challenge: { challengeId: "other-id" } }))));
    await expect(requestExpeditionDetail("/api", "id", new AbortController().signal)).rejects.toBeInstanceOf(ExpeditionDetailError);
  });
  it("reports a missing expedition without a raw HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(requestExpeditionDetail("/api", "id", new AbortController().signal))
      .rejects.toMatchObject({ status: 404, message: "This expedition is no longer available." });
  });
  it("understands numeric and HTTP date retry headers with a safe missing-header wait", () => {
    expect(retryAfterSeconds("3.2")).toBe(4);
    expect(retryAfterSeconds("Wed, 28 Oct 2026 17:00:10 GMT", Date.parse("2026-10-28T17:00:00Z"))).toBe(10);
    expect(retryAfterSeconds("invalid")).toBe(60);
    expect(retryAfterSeconds(null)).toBe(60);
  });
});
