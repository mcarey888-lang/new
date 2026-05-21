import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the production domain, the Replit dev proxy, and same-origin requests.
// Requests with no Origin header (native app, curl) are also allowed.
const allowedOrigins = new Set<string>([
  "https://summitready.uk",
  "https://www.summitready.uk",
  ...(process.env.REPLIT_DOMAINS?.split(",").map(d => `https://${d.trim()}`) ?? []),
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
  }),
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// General limit: 120 req/min per IP across all /api routes.
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Strict limit for AI endpoints that call OpenAI (cost protection).
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment and try again." },
});

app.use("/api", generalLimiter);
app.use("/api/coach-assessment",   aiLimiter);
app.use("/api/alpine-assessment",  aiLimiter);
app.use("/api/mountain-lookup",    aiLimiter);
app.use("/api/hills-lookup",       aiLimiter);
app.use("/api/hills-search",       aiLimiter);
app.use("/api/hills-unified",      aiLimiter);
app.use("/api/adjust-plan",        aiLimiter);
app.use("/api/hill-detail",        aiLimiter);
app.use("/api/trail-start",        aiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
