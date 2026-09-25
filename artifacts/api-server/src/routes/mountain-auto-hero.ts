import { Router, type Request, type RequestHandler, type Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  getMountainAutoHeroStatus,
  isMountainHeroRequestId,
  MountainHeroRequestError,
  requestMountainAutoHero,
} from "../services/artwork/mountainAutoHeroService.js";

export interface MountainAutoHeroRouteDependencies {
  authenticatedUserId: (req: Request) => string | null;
  isMountainHeroRequestId: (id: string) => boolean;
  requestMountainAutoHero: typeof requestMountainAutoHero;
  getMountainAutoHeroStatus: typeof getMountainAutoHeroStatus;
}

export function createMountainAutoHeroHandlers(
  dependencies: MountainAutoHeroRouteDependencies = {
    authenticatedUserId: (req) => getAuth(req).userId,
    isMountainHeroRequestId,
    requestMountainAutoHero,
    getMountainAutoHeroStatus,
  },
) {
  const authenticatedUserId = (req: Request, res: Response): string | null => {
    const userId = dependencies.authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return null;
    }
    return userId;
  };

  const requestHero: RequestHandler = async (req, res) => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id;
    if (!dependencies.isMountainHeroRequestId(id)) return res.status(404).json({ error: "Mountain is unavailable" });
    try {
      const result = await dependencies.requestMountainAutoHero(
        id,
        userId,
        req.ip || req.socket.remoteAddress || "unknown",
      );
      if (result.status === "ready") return res.status(200).json({ status: "ready", imageUrl: result.imageUrl });
      return res.status(202).json({ status: "generating", jobId: result.jobId });
    } catch (error) {
      if (error instanceof MountainHeroRequestError) {
        if (error.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
        return res.status(error.statusCode).json({ error: error.message });
      }
      req.log.error({ err: error, mountainId: id, userId }, "Mountain auto hero request failed");
      return res.status(500).json({ error: "Mountain hero could not be requested" });
    }
  };

  const heroStatus: RequestHandler = async (req, res) => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id;
    if (!dependencies.isMountainHeroRequestId(id)) return res.json({ status: "unavailable" });
    try {
      return res.json(await dependencies.getMountainAutoHeroStatus(id));
    } catch (error) {
      req.log.error({ err: error, mountainId: id, userId }, "Mountain auto hero status failed");
      return res.status(500).json({ error: "Mountain hero status is unavailable" });
    }
  };

  return { requestHero, heroStatus };
}

const mountainAutoHeroHandlers = createMountainAutoHeroHandlers();
export const mountainAutoHeroRouter = Router();
mountainAutoHeroRouter.post("/:id/request-hero", requireAuth(), mountainAutoHeroHandlers.requestHero);
mountainAutoHeroRouter.get("/:id/hero-status", requireAuth(), mountainAutoHeroHandlers.heroStatus);