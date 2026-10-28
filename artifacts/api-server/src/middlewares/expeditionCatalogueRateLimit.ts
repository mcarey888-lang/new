import { rateLimit } from "express-rate-limit";

/** Public, database-only reads; never includes expedition generation or writes. */
export function isExpeditionCatalogueRead(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD")
    && (path === "/sx/featured" || path === "/sx/challenges" || path.startsWith("/sx/challenges/"));
}

export function createExpeditionCatalogueLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Expedition browsing is temporarily busy. Please wait a moment and try again." },
  });
}
