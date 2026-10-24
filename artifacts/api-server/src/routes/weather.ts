import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { GetMountainWeatherQueryParams, GetMountainWeatherResponse } from "@workspace/api-zod";
import { getWeatherForecast, WeatherUnavailable } from "../services/weather";

const router: IRouter = Router();
const limit = rateLimit({
  windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many weather requests. Try again shortly." },
});

router.get("/weather/forecast", limit, async (req, res): Promise<void> => {
  const input = GetMountainWeatherQueryParams.safeParse(req.query);
  if (!input.success || req.query.lat === "" || req.query.lng === "") {
    res.status(400).json({ error: "Valid latitude and longitude are required." });
    return;
  }
  try {
    const forecast = await getWeatherForecast(input.data.lat, input.data.lng);
    res.set("Cache-Control", "public, max-age=300");
    res.json(GetMountainWeatherResponse.parse(forecast));
  } catch (error) {
    const reason = error instanceof WeatherUnavailable ? error.reason : "provider";
    req.log.warn({ reason }, "Weather temporarily unavailable");
    res.set("Cache-Control", "no-store");
    res.set("Retry-After", "60");
    res.status(reason === "limit" ? 429 : 503).json({
      error: "Weather forecast unavailable. Check a specialist forecast before setting out.",
    });
  }
});

export default router;
