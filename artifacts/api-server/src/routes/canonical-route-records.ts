import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createCanonicalRouteRecordHandler,
  type CanonicalRouteRecordQuery,
} from "../services/mountain/canonicalRouteRecord";

const RouteId = z.string().regex(/^sde:route:[^@:\s]+@[^@\s]+$/);
const MountainId = z.string().regex(/^sde:mountain:[^:\s]+$/);

export function parseCanonicalRouteRequest(query: unknown) {
  return z.object({ routeId: RouteId, mountainId: MountainId }).safeParse(query);
}

export function createCanonicalRouteRecordsRouter(query?: CanonicalRouteRecordQuery) {
  const router = Router();
  const read = createCanonicalRouteRecordHandler(query);
  router.get("/", async (req: Request, res: Response) => {
    const parsed = parseCanonicalRouteRequest(req.query);
    if (!parsed.success) return res.status(400).json({ status: "unavailable", reasons: ["invalid_identity"], record: null });
    const routeParts = parsed.data.routeId.slice("sde:route:".length).split("@");
    const mountainId = parsed.data.mountainId.slice("sde:mountain:".length);
    const result = await read(routeParts[0], routeParts[1], mountainId);
    return res.status(result.status === "unavailable" || result.status === "ambiguous" ? 404 : 200).json(result);
  });
  return router;
}

export default createCanonicalRouteRecordsRouter();