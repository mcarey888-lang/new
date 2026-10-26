import { Router, json } from "express";
import type { Request, Response, ErrorRequestHandler } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";
import { requireAdminKey } from "../middlewares/requireAdminKey.js";
import {
  ReviewError, reviewDevelopmentEnabled, assertReviewDatabase, previewReview, previewResponse,
  listReviews, getReview, importReview, validateReview, decideReview, loadReviewFile,
} from "../services/routeReviewAdmin.js";
import type { PoolClient } from "@workspace/db";
import { expeditionRouteQueue } from "../services/expeditionRouteQueue.js";
import { listMapReviews, recordMapReview } from "../services/routeMapReview.js";
import { editReview } from "../services/routeReviewEdit.js";
import { constructedSourceMessage } from "../services/routeSourcePolicy.js";

export const routeReviewAdminRouter = Router();
const base = "/admin/route-reviews";
routeReviewAdminRouter.use(base, (_req, res, next): void => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!reviewDevelopmentEnabled()) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  next();
}, requireAdminKey, json({ limit: "6mb" }));

async function request(req: Request, res: Response, run: (client: PoolClient) => Promise<unknown>, status = 200) {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='12s'");
    await client.query("SET LOCAL lock_timeout='3s'");
    await assertReviewDatabase(client);
    if (req.params.id && !z.string().uuid().safeParse(req.params.id).success) throw new ReviewError(400, "Invalid review ID.");
    if (req.method === "POST" && req.params.id) {
      const existing = await getReview(client, String(req.params.id));
      if (existing.revision.sourceStatus === "withdrawn_constructed")
        throw new ReviewError(422, constructedSourceMessage);
    }
    const result = await run(client);
    await client.query("COMMIT");
    if (Buffer.isBuffer(result)) {
      res.setHeader("Content-Disposition", `attachment; filename="review-${String(req.params.name)}.json"`);
      return res.status(status).type("application/json").send(result);
    }
    return res.status(status).json(result);
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error instanceof ReviewError) return res.status(error.status).json({ error: error.message });
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    const code = (error as { code?: string }).code;
    req.log.error({ code: code ?? "review_unavailable" }, "Development route review operation failed");
    return res.status(code === "23505" || code === "23514" || code === "23503" ? 409 : 503).json({ error:
      code === "23505" ? "Duplicate candidate revision or stale decision. Reload; nothing was overwritten." :
      code === "23514" || code === "23503" ? "Database rejected this review: binding, rights, validation or decision history is not current. No changes saved." :
      "Development review or private evidence storage unavailable. No database changes saved." });
  } finally { client?.release(); }
}
routeReviewAdminRouter.get(base, (req, res) => request(req, res, c => listReviews(c, req.query.includeWithdrawn === "1")));
routeReviewAdminRouter.get(`${base}/expedition-queue`, (req, res) => request(req, res, expeditionRouteQueue));
routeReviewAdminRouter.post(`${base}/preview`, (req, res) => request(req, res, async c => previewResponse(await previewReview(c, req.body))));
routeReviewAdminRouter.post(`${base}/import`, (req, res) => request(req, res, c => importReview(c, req.body), 201));
routeReviewAdminRouter.get(`${base}/:id`, (req, res) => request(req, res, async c => ({
  ...await getReview(c, String(req.params.id)),
  mapReviews: await listMapReviews(c, String(req.params.id)),
})));
routeReviewAdminRouter.post(`${base}/:id/map-review`, (req, res) =>
  request(req, res, c => recordMapReview(c, String(req.params.id), req.body), 201));
routeReviewAdminRouter.post(`${base}/:id/edit`, (req, res) =>
  request(req, res, c => editReview(c, String(req.params.id), req.body), 201));
routeReviewAdminRouter.post(`${base}/:id/validate`, (req, res) => request(req, res, c => validateReview(c, String(req.params.id), req.body), 201));
routeReviewAdminRouter.post(`${base}/:id/decision`, (req, res) => request(req, res, c => decideReview(c, String(req.params.id), req.body), 201));
routeReviewAdminRouter.get(`${base}/:id/files/:name`, (req, res) => request(req, res, c => {
  const name = z.enum(["geometry", "profile", "terrain-manifest", "source-snapshot", "terrain-rights"]).parse(req.params.name);
  return loadReviewFile(c, String(req.params.id), name);
}));
const reviewBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Route review files exceed the 6 MB request limit. Nothing was saved." });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Route review request is not valid JSON. Nothing was saved." });
    return;
  }
  next(error);
};
routeReviewAdminRouter.use(base, reviewBodyError);
