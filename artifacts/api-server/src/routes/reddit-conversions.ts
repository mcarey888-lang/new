import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  REDDIT_EVENT_NAMES,
  sendRedditConversion,
  type RedditEventName,
} from "../services/redditConversions";

const router = Router();

const bodySchema = z.object({
  eventName: z.enum(REDDIT_EVENT_NAMES),
  eventAt: z.number().int().positive(),
  conversionId: z.string().uuid(),
  installId: z.string().uuid(),
  plan: z.string().trim().min(1).max(128).optional(),
  value: z.number().finite().nonnegative().max(100_000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

function clientIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.split(",", 1)[0]?.trim().replace(/^::ffff:/, "") || undefined;
}

router.post("/reddit-conversions", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid conversion event" });
    return;
  }

  // Reject stale/future client timestamps. Reddit accepts events up to seven days old,
  // but a tighter window limits replay and malformed client clocks.
  const now = Date.now();
  if (parsed.data.eventAt < now - 48 * 60 * 60 * 1000 || parsed.data.eventAt > now + 5 * 60 * 1000) {
    res.status(400).json({ error: "Event timestamp is outside the accepted window" });
    return;
  }

  try {
    await sendRedditConversion({
      ...parsed.data,
      ipAddress: clientIp(req.headers["x-forwarded-for"] as string | undefined) ?? req.ip,
      userAgent: req.get("user-agent")?.slice(0, 512),
    });
    res.status(202).json({ accepted: true });
  } catch (error) {
    logger.error({ err: error, eventName: parsed.data.eventName }, "Failed to forward Reddit conversion");
    res.status(503).json({ error: "Conversion service unavailable" });
  }
});

// Server-only verification path. Call it manually; never ship REDDIT_CAPI_TEST_KEY
// or Reddit's Events Testing ID in the mobile app.
router.post("/reddit-conversions/test", async (req, res) => {
  const testKey = process.env.REDDIT_CAPI_TEST_KEY;
  const testId = process.env.REDDIT_CAPI_TEST_ID;
  if (!testKey || !testId || req.get("x-reddit-test-key") !== testKey) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const eventName = REDDIT_EVENT_NAMES.includes(req.body?.eventName)
    ? (req.body.eventName as RedditEventName)
    : "first_open";

  try {
    await sendRedditConversion({
      eventName,
      eventAt: Date.now(),
      conversionId: randomUUID(),
      installId: randomUUID(),
      testId,
      ipAddress: clientIp(req.headers["x-forwarded-for"] as string | undefined) ?? req.ip,
      userAgent: req.get("user-agent")?.slice(0, 512),
      ...(eventName === "purchase" ? { plan: "reddit-capi-test", value: 1, currency: "GBP" } : {}),
    });
    res.status(202).json({ accepted: true, eventName });
  } catch (error) {
    logger.error({ err: error, eventName }, "Failed to send Reddit test conversion");
    res.status(503).json({ error: "Conversion service unavailable" });
  }
});

export default router;
