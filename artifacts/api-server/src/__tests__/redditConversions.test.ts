import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRedditEvent, sendRedditConversion } from "../services/redditConversions";

const base = {
  eventName: "first_open" as const,
  eventAt: 1_788_134_400_000,
  conversionId: "9cc8d542-2ac0-4cc8-9e86-c2028134bf64",
  installId: "df4fae12-0eb0-4f5f-b42c-64422cc9d031",
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.REDDIT_CAPI_ACCESS_TOKEN;
  delete process.env.REDDIT_PIXEL_ID;
});

describe("Reddit conversions", () => {
  it("builds an APP custom event without exposing the raw install ID", () => {
    const event = buildRedditEvent(base);
    expect(event.action_source).toBe("APP");
    expect(event.type).toEqual({ tracking_type: "CUSTOM", custom_event_name: "first_open" });
    expect(event.metadata.conversion_id).toBe(base.conversionId);
    expect(event.user.uuid).toMatch(/^[a-f0-9]{64}$/);
    expect(event.user.uuid).not.toBe(base.installId);
  });

  it("adds revenue metadata to PURCHASE events", () => {
    const event = buildRedditEvent({
      ...base,
      eventName: "purchase",
      plan: "monthly",
      value: 9.99,
      currency: "GBP",
    });
    expect(event.type).toEqual({ tracking_type: "PURCHASE" });
    expect(event.metadata).toMatchObject({ value: 9.99, currency: "GBP", item_count: 1 });
  });

  it("posts to Reddit v3 with the server-side bearer token", async () => {
    process.env.REDDIT_CAPI_ACCESS_TOKEN = "server-only-token";
    process.env.REDDIT_PIXEL_ID = "pixel-123";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRedditConversion({ ...base, testId: "TEST123" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v3/pixels/pixel-123/conversion_events");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer server-only-token");
    const payload = JSON.parse(init.body as string);
    expect(payload.data.test_id).toBe("TEST123");
    expect(JSON.stringify(payload)).not.toContain("server-only-token");
  });
});
