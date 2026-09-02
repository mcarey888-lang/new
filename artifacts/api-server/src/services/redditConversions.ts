export const REDDIT_EVENT_NAMES = [
  "first_open",
  "readiness_test_completed",
  "readiness_score_viewed",
  "subscription_started",
  "purchase",
] as const;

export type RedditEventName = (typeof REDDIT_EVENT_NAMES)[number];

export type RedditConversionInput = {
  eventName: RedditEventName;
  eventAt: number;
  conversionId: string;
  installId: string;
  plan?: string;
  value?: number;
  currency?: string;
  testId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type RedditEvent = {
  event_at: number;
  action_source: "APP";
  type: { tracking_type: "PURCHASE" | "CUSTOM"; custom_event_name?: string };
  metadata: {
    conversion_id: string;
    currency?: string;
    value?: number;
    item_count?: number;
    products?: Array<{ id: string; name: string; category: string; quantity: number; item_price?: number }>;
  };
  user: {
    uuid: string;
    ip_address?: string;
    user_agent?: string;
  };
};

export function buildRedditEvent(input: RedditConversionInput): RedditEvent {
  const isPurchase = input.eventName === "purchase";
  const hasRevenue =
    isPurchase &&
    typeof input.value === "number" &&
    Number.isFinite(input.value) &&
    input.value >= 0 &&
    typeof input.currency === "string" &&
    /^[A-Z]{3}$/.test(input.currency);

  return {
    event_at: input.eventAt,
    action_source: "APP",
    type: isPurchase
      ? { tracking_type: "PURCHASE" }
      : { tracking_type: "CUSTOM", custom_event_name: input.eventName },
    metadata: {
      conversion_id: input.conversionId,
      ...(hasRevenue
        ? {
            value: input.value,
            currency: input.currency,
            item_count: 1,
            products: [
              {
                id: input.plan ?? "summit-ready-premium",
                name: input.plan ?? "Summit Ready Premium",
                category: "subscription",
                quantity: 1,
                item_price: input.value,
              },
            ],
          }
        : {}),
    },
    user: {
      // Reddit validates this match key as an RFC-4122 UUID. This is a random,
      // app-generated installation ID and contains no account or contact data.
      uuid: input.installId,
      ...(input.ipAddress ? { ip_address: input.ipAddress } : {}),
      ...(input.userAgent ? { user_agent: input.userAgent } : {}),
    },
  };
}

export async function sendRedditConversion(input: RedditConversionInput): Promise<void> {
  const token = process.env.REDDIT_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.REDDIT_PIXEL_ID;

  if (!token || !pixelId) {
    throw new Error("Reddit CAPI is not configured");
  }

  const data: { events: RedditEvent[]; test_id?: string } = {
    events: [buildRedditEvent(input)],
  };
  if (input.testId) data.test_id = input.testId;

  const response = await fetch(
    `https://ads-api.reddit.com/api/v3/pixels/${encodeURIComponent(pixelId)}/conversion_events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`Reddit CAPI returned HTTP ${response.status}: ${body}`);
  }
}
