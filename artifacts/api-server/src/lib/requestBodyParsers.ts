import express, { type IRouter, type ErrorRequestHandler } from "express";

/** Shared by the actual application and HTTP regressions; not a test-only
 * reconstruction of the route spelling or middleware order. */
export function mountRequestBodyParsers(app: IRouter): void {
  app.use("/api/atlas/upload", express.json({limit:"50mb"}));
  app.use("/api/recorded-hikes", express.json({limit:"48mb"}));
  app.use("/api/tracked-routes", express.json({limit:"12mb"}));
  app.use("/api/hill-session", express.json({limit:"48mb"}));
  app.use("/api/explore-hike", express.json({limit:"12mb"}));
  const defaultJson = express.json();
  app.use((req, res, next) => {
    // This router owns its 6 MB parser, after its development and admin-key
    // guards. Parsing here first would reject genuine pilot files at 100 KB.
    if (/^\/api\/admin\/route-reviews(?:\/|$)/i.test(req.path)) return next();
    return defaultJson(req, res, next);
  });
  const oversized: ErrorRequestHandler = (error, _req, res, next) => {
    if (error?.type !== "entity.too.large") { next(error); return; }
    res.status(413).json({error:"The recording exceeds this endpoint's upload limit. Keep the original on your device; it has not been acknowledged."});
  };
  app.use(oversized);
}
